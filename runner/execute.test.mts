import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { required, type Check, type Run, type Source } from "../shared/protocol.ts";
import { executeRun } from "./execute.mts";
import { applyPatch, authorizePatch, readSource, sourceHash } from "./patch.mts";
import { RunStore } from "./store.mts";
import { type BrowserResult } from "./verifier.mts";

const source: Source = { "index.html": "<main></main>", "styles.css": "body {}", "app.js": "render();" };
const replacement = (path: string, content: string) => ({ path, content });
const patch = (...replacements: ReturnType<typeof replacement>[]) => ({ explanation: "Update fixture", replacements });

function browserResult(candidate: Source, baseline: boolean, failed = false): BrowserResult {
  const checks: Check[] = baseline
    ? [{ id: "control", status: "failed" }, { id: "completion", status: "passed" }]
    : (Object.keys(required) as Check["id"][]).map((id) => ({
      id, status: failed && id === "persistence" ? "failed" : "passed",
    }));
  return { checks, hash: sourceHash(candidate), screenshot: Buffer.from("image"), trace: Buffer.from("trace") };
}

async function setup(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "proofpilot-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new RunStore(root);
  const run: Run = {
    id: randomUUID(), mode: "live", status: "CREATED", createdAt: new Date().toISOString(), events: [], attempts: [], artifacts: {},
  };
  await store.create(run);
  return { root, store, run };
}

test("rejects unauthorized, duplicate, oversized, malformed and unchanged patches", () => {
  for (const invalid of [null, patch(), patch(replacement("../app.js", "")), patch(replacement("runner/worker.mts", "")),
    patch(replacement("app.js", "one"), replacement("app.js", "two")),
    patch(replacement("app.js", "ü".repeat(16_385))),
    patch(replacement("app.js", "x".repeat(32_768)), replacement("styles.css", "x".repeat(32_768)), replacement("index.html", "x")),
    { ...patch(replacement("app.js", "test")), modelSaysPassed: true },
  ]) assert.throws(() => authorizePatch(invalid));
  assert.throws(() => applyPatch(source, authorizePatch(patch(replacement("app.js", source["app.js"])))), /unchanged/);
});

test("refuses symlinked fixture files", async (t) => {
  const { root } = await setup(t);
  await writeFile(join(root, "index.html"), source["index.html"]);
  await writeFile(join(root, "styles.css"), source["styles.css"]);
  await symlink(join(root, "index.html"), join(root, "app.js"));
  await assert.rejects(() => readSource(root), /regular files/);
});

test("rejects a patch, repairs cumulatively with assertion feedback, and binds artifacts to the passing candidate", async (t) => {
  const { store, run } = await setup(t);
  await executeRun(run, store, {
    original: async () => source,
    prepareVerifier: async () => async (candidate, baseline) => browserResult(candidate, baseline, candidate["styles.css"] === source["styles.css"]),
    generatorName: "Test generator",
    generate: async (candidate, feedback, index) => {
      if (index === 1) return { output: patch(replacement("test.ts", "untrusted")) };
      if (index === 2) {
        assert.match(feedback, /Patch rejected/);
        assert.deepEqual(candidate, source);
        return { output: patch(replacement("app.js", "archive();")) };
      }
      assert.match(feedback, /survives a page reload/);
      assert.equal(candidate["app.js"], "archive();");
      return { output: patch(replacement("styles.css", "main {}")) };
    },
  });
  const persisted = await store.read(run.id);
  assert.equal(persisted?.status, "VERIFIED");
  assert.equal(persisted.verifiedHash, sourceHash({ ...source, "app.js": "archive();", "styles.css": "main {}" }));
  const diff = String(await store.readArtifact(run, "attempt-3.diff"));
  assert.match(diff, /archive\(\);/);
  assert.match(diff, /main \{\}/);
  assert.equal(persisted.attempts[0].evidence, undefined);
  assert.equal(persisted.attempts[1].evidence?.checks.find(({ id }) => id === "persistence")?.status, "failed");
  assert.equal(await store.readArtifact(run, "manifest.json"), undefined);
});

test("stops after three failed candidates and preserves their evidence", async (t) => {
  const { store, run } = await setup(t);
  await executeRun(run, store, {
    original: async () => source,
    prepareVerifier: async () => async (candidate, baseline) => browserResult(candidate, baseline, true),
    generatorName: "Test generator",
    generate: async (_candidate, _feedback, index) => ({ output: patch(replacement("app.js", `archive(${index});`)) }),
  });
  const persisted = await store.read(run.id);
  assert.equal(persisted?.status, "FAILED");
  assert.equal(persisted.attempts.length, 3);
  assert.equal(persisted.verifiedHash, undefined);
  assert.equal(persisted.artifacts["attempt-3.zip"], "application/zip");
});

test("recovers an unfinished run without losing evidence or claiming verification", async (t) => {
  const { root, store, run } = await setup(t);
  run.status = "VERIFYING";
  run.verifiedHash = sourceHash(source);
  await store.writeArtifact(run, "attempt-1.zip", "application/zip", "trace");
  await store.save(run);
  const nextWorker = new RunStore(root);
  await nextWorker.recover();
  const recovered = await nextWorker.read(run.id);
  assert.equal(recovered?.status, "INTERRUPTED");
  assert.equal(recovered.verifiedHash, undefined);
  assert.equal((await nextWorker.readArtifact(recovered, "attempt-1.zip"))?.toString(), "trace");
});

test("records verifier setup failures without requesting a patch", async (t) => {
  const { store, run } = await setup(t);
  await executeRun(run, store, {
    original: async () => source,
    prepareVerifier: async () => { throw new Error("Chromium unavailable"); },
    generatorName: "Test generator",
    generate: async () => assert.fail("The worker should record the infrastructure error first."),
  });
  const persisted = await store.read(run.id);
  assert.equal(persisted?.status, "ERROR");
  assert.equal(persisted.events.at(-1)?.message, "Chromium unavailable");
  assert.equal(persisted.verifiedHash, undefined);
});

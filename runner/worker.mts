import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isLoopbackHost, workerPort, workerUrl } from "../shared/local.ts";
import { type Run } from "../shared/protocol.ts";
import { executeRun } from "./execute.mts";
import { liveEnabled, liveGenerator, liveGeneratorName, model, rehearsalGenerator } from "./generators.mts";
import { readSource } from "./patch.mts";
import { RunStore } from "./store.mts";
import { prepareVerifier } from "./verifier.mts";

const root = fileURLToPath(new URL("../", import.meta.url));
const store = new RunStore(process.env.PROOFPILOT_DATA_DIR ?? join(root, ".proofpilot/runs"));
let active = false;
let ready = false;

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

async function start(request: IncomingMessage, response: ServerResponse) {
  if (request.headers["content-type"]?.split(";")[0] !== "application/json") {
    return json(response, 415, { error: "Expected application/json." });
  }
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1024) return json(response, 413, { error: "Request is too large." });
  }
  let mode: unknown;
  try {
    mode = JSON.parse(body)?.mode;
  } catch {
    return json(response, 400, { error: "Invalid JSON request." });
  }
  if (mode !== "live" && mode !== "rehearsal") return json(response, 400, { error: "Choose Live AI or Rehearsal." });
  if (active) return json(response, 409, { error: "A run is already in progress." });
  if (mode === "live" && !liveEnabled()) return json(response, 422, { error: "Set AI_GATEWAY_API_KEY in .env.local and restart the worker." });

  active = true;
  const createdAt = new Date().toISOString();
  const run: Run = {
    id: randomUUID(), status: "CREATED", mode, createdAt, attempts: [], artifacts: {},
    events: [{ at: createdAt, status: "CREATED", message: "Run created." }],
  };
  try {
    await store.create(run);
  } catch (error) {
    active = false;
    throw error;
  }
  json(response, 202, { id: run.id });
  void executeRun(run, store, {
    original: () => readSource(join(root, "fixture")),
    prepareVerifier,
    generate: mode === "live" ? liveGenerator : rehearsalGenerator(root),
    generatorName: mode === "live" ? liveGeneratorName() : "Rehearsal script",
    modelId: mode === "live" ? model : undefined,
  }).catch((error) => {
    console.error("Unable to persist run state", error);
    // Exit so recovery can mark the unfinished run on the next worker start.
    process.exit(1);
  }).finally(() => { active = false; });
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  if (!isLoopbackHost(request.headers.host) || request.headers.origin) {
    return json(response, 403, { error: "Use the local dashboard." });
  }
  if (!ready) return json(response, 503, { error: "The runner is recovering." });
  const path = request.url ?? "";
  if (path === "/runs" && request.method === "POST") return start(request, response);
  if (request.method !== "GET") return json(response, 405, { error: "Method unavailable." });
  if (path === "/runs") return json(response, 200, { runs: await store.list(), active, live: liveEnabled() });

  const match = /^\/runs\/([a-f0-9-]{36})(?:\/artifacts\/([a-z0-9.-]+))?$/.exec(path);
  const run = match ? await store.read(match[1]) : undefined;
  if (!run) return json(response, 404, { error: "Run unavailable." });
  const name = match?.[2];
  if (!name) return json(response, 200, run);
  const data = await store.readArtifact(run, name);
  if (!data) return json(response, 404, { error: "Artifact unavailable." });
  response.writeHead(200, {
    "Content-Type": run.artifacts[name],
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=3600",
    "Content-Length": data.length,
    ...(name.endsWith(".zip") && { "Content-Disposition": `attachment; filename="${name}"` }),
  });
  response.end(data);
}

const server = createServer((request, response) => {
  void handle(request, response).catch((error) => {
    console.error(error);
    if (!response.headersSent) json(response, 500, { error: "The local worker could not access run data." });
  });
});
await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(workerPort, "127.0.0.1", resolve);
});
await store.recover();
ready = true;
console.log(`ProofPilot worker listening at ${workerUrl}`);

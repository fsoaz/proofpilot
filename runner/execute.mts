import { createHash } from "node:crypto";
import { createTwoFilesPatch } from "diff";
import { files, required, type Attempt, type Evidence, type Run, type Source, type Status } from "../shared/protocol.ts";
import { type Generator } from "./generators.mts";
import { applyPatch, authorizePatch, PatchError } from "./patch.mts";
import { type RunStore } from "./store.mts";
import { type BrowserResult, type BrowserVerifier } from "./verifier.mts";

type Dependencies = {
  original: () => Promise<Source>;
  prepareVerifier: () => Promise<BrowserVerifier>;
  generate: Generator;
  generatorName: string;
  modelId?: string;
};

export async function executeRun(run: Run, store: RunStore, dependencies: Dependencies) {
  async function transition(status: Status, message: string, attempt?: number) {
    run.events.push({ status, message, attempt, at: new Date().toISOString() });
    run.status = status;
    await store.save(run);
  }

  async function record(result: BrowserResult, prefix: string, diff?: string): Promise<Evidence> {
    const screenshot = `${prefix}.png`;
    const trace = `${prefix}.zip`;
    await store.writeArtifact(run, screenshot, "image/png", result.screenshot);
    await store.writeArtifact(run, trace, "application/zip", result.trace);
    return { screenshot, trace, hash: result.hash, checks: result.checks, diff };
  }

  try {
    await transition("BASELINING", "Capturing the original task board.");
    const verify = await dependencies.prepareVerifier();
    const original = await dependencies.original();
    let source = original;
    const baseline = await verify(original, true);
    run.baseline = await record(baseline, "baseline");
    await store.save(run);
    if (baseline.checks.find((check) => check.id === "control")?.status !== "failed"
      || baseline.checks.find((check) => check.id === "completion")?.status !== "passed") {
      throw new Error("The original board did not match its expected baseline.");
    }

    let feedback = "The baseline has no Archive completed action.";
    let sawAssertionFailure = false;
    const limit = run.mode === "rehearsal" ? 2 : 3;
    for (let index = 1; index <= limit; index++) {
      const attempt: Attempt = {
        index,
        origin: run.mode === "rehearsal" ? "Scripted" : "Model-generated",
        generator: dependencies.generatorName,
        model: dependencies.modelId,
        input: feedback,
      };
      run.attempts.push(attempt);
      const generating = index === 1 ? "GENERATING" : "REPAIRING";
      await transition(generating, index === 1 ? `Preparing the first ${attempt.origin.toLowerCase()} candidate.`
        : `Preparing a repair. ${feedback.split("\n")[0]}`, index);
      const generation = await dependencies.generate(source, feedback, index);
      attempt.model = generation.model ?? attempt.model;
      attempt.provider = generation.provider;
      await transition("VALIDATING_PATCH", "Checking replacement paths and file sizes.", index);
      let next: Source;
      try {
        const patch = authorizePatch(generation.output);
        next = applyPatch(source, patch);
        attempt.explanation = patch.explanation;
        attempt.patchHash = createHash("sha256").update(JSON.stringify(patch.replacements)).digest("hex");
      } catch (error) {
        if (!(error instanceof PatchError)) throw error;
        attempt.rejection = error.message;
        feedback = `Patch rejected. ${error.message}`;
        await store.save(run);
        continue;
      }
      await transition("APPLYING", "Staging the candidate for Chromium.", index);
      source = next;
      await transition("VERIFYING", "Running the fixed browser checks in a fresh container.", index);
      const result = await verify(source, false);
      const diff = `attempt-${index}.diff`;
      const text = files.filter((name) => original[name] !== source[name])
        .map((name) => createTwoFilesPatch(`a/${name}`, `b/${name}`, original[name], source[name], "", ""))
        .join("\n");
      await store.writeArtifact(run, diff, "text/plain", text);
      attempt.evidence = await record(result, `attempt-${index}`, diff);
      await store.save(run);
      const verified = Object.keys(required).every((id) => result.checks.some((check) => check.id === id && check.status === "passed"));
      if (verified) {
        run.verifiedHash = result.hash;
        await transition("VERIFIED", "Acceptance checks passed.", index);
        return;
      }

      sawAssertionFailure = true;
      const failures = result.checks.filter((check) => check.status === "failed");
      feedback = failures.map((failure) => `Failed check: ${required[failure.id]}.\n${failure.detail ?? ""}`).join("\n\n");
    }
    await transition(sawAssertionFailure ? "FAILED" : "ERROR", sawAssertionFailure
      ? "The attempt limit was reached. Acceptance checks remain unresolved."
      : "No valid candidate reached browser verification.");
  } catch (error) {
    delete run.verifiedHash;
    await transition("ERROR", error instanceof Error ? error.message : "Unexpected runner error.");
  }
}

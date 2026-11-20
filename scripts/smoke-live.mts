import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { liveEnabled, liveGenerator, liveGeneratorName } from "../runner/generators.mts";
import { applyPatch, authorizePatch, readSource, sourceHash } from "../runner/patch.mts";

if (existsSync(".env.local")) loadEnvFile(".env.local");
if (!liveEnabled()) {
  console.error("Live smoke test needs AI_GATEWAY_API_KEY in .env.local.");
  process.exit(1);
}
const source = await readSource("fixture");
const result = await liveGenerator(source, "There is no Archive completed action.", 1);
const patch = authorizePatch(result.output);
const candidate = applyPatch(source, patch);
console.log(JSON.stringify({
  generator: liveGeneratorName(),
  model: result.model,
  provider: result.provider,
  changed: patch.replacements.map(({ path }) => path),
  candidateHash: sourceHash(candidate),
}, null, 2));

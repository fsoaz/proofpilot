import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { files, type FileName, type Source } from "../shared/protocol.ts";

export type CandidatePatch = {
  explanation: string;
  replacements: { path: FileName; content: string }[];
};

export const patchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["explanation", "replacements"],
  properties: {
    explanation: { type: "string" },
    replacements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "content"],
        properties: { path: { type: "string", enum: [...files] }, content: { type: "string" } },
      },
    },
  },
} as const;

export class PatchError extends Error {}

function hasExactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

export function authorizePatch(value: unknown): CandidatePatch {
  if (!hasExactKeys(value, ["explanation", "replacements"])
    || typeof value.explanation !== "string" || !value.explanation.trim() || value.explanation.length > 800
    || !Array.isArray(value.replacements) || value.replacements.length < 1 || value.replacements.length > files.length) {
    throw new PatchError("Expected an explanation and one to three file replacements.");
  }

  const seen = new Set<string>();
  let total = 0;
  const replacements = value.replacements.map((replacement: unknown) => {
    if (!hasExactKeys(replacement, ["path", "content"])) throw new PatchError("Invalid replacement shape.");
    const { path, content } = replacement;
    if (typeof path !== "string" || !files.some((name) => path === name)) {
      throw new PatchError("Replacement path is outside the fixture allowlist.");
    }
    if (seen.has(path)) throw new PatchError("A replacement path appears more than once.");
    seen.add(path);
    if (typeof content !== "string" || content.includes("\u0000")) throw new PatchError("Replacement must be plain text.");
    const size = Buffer.byteLength(content);
    total += size;
    if (size > 32_768 || total > 65_536) throw new PatchError("Replacement exceeds the file or patch size limit.");
    return { path: path as FileName, content };
  });
  return { explanation: value.explanation, replacements };
}

export function applyPatch(source: Source, patch: CandidatePatch): Source {
  const candidate = { ...source };
  for (const { path, content } of patch.replacements) candidate[path] = content;
  if (sourceHash(candidate) === sourceHash(source)) throw new PatchError("The patch leaves the current candidate unchanged.");
  return candidate;
}

export function sourceHash(source: Source) {
  return createHash("sha256").update(JSON.stringify(files.map((name) => [name, source[name]]))).digest("hex");
}

export async function readSource(directory: string): Promise<Source> {
  if (!(await lstat(directory)).isDirectory()) throw new Error("The fixture must be a real directory.");
  const entries = await Promise.all(files.map(async (name) => {
    const path = join(directory, name);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.size > 32_768) throw new Error("Fixture files must be small regular files.");
    return [name, await readFile(path, "utf8")] as const;
  }));
  return Object.fromEntries(entries) as Source;
}

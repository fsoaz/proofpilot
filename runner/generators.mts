import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { feature, type Source } from "../shared/protocol.ts";
import { patchSchema } from "./patch.mts";

export const model = "openai/gpt-5.4";
export const eveUrl = "http://127.0.0.1:4319";
export const liveEnabled = () => Boolean(process.env.AI_GATEWAY_API_KEY);
export const liveGeneratorName = () => process.env.PROOFPILOT_GENERATOR === "gateway" ? "AI Gateway" : "Eve via AI Gateway";

export type Generation = { output: unknown; model?: string; provider?: string };
export type Generator = (source: Source, feedback: string, attempt: number) => Promise<Generation>;

export function rehearsalGenerator(root: string): Generator {
  return async (source, _feedback, attempt) => {
    const initial = attempt === 1;
    const content = initial
      ? await readFile(join(root, "rehearsal/archive.js"), "utf8")
      : source["app.js"].replace("/* persist archive */", "save();");
    return {
      output: {
        explanation: initial
          ? "Add Active and Archive views and move completed tasks into the archive in memory."
          : "Save tasks when archiving so their archived state survives a reload.",
        replacements: [{ path: "app.js", content }],
      },
    };
  };
}

const instructions = [
  "You are ProofPilot's candidate generator. Return a structured explanation and complete file replacements.",
  "Modify only the supplied HTML, CSS and JavaScript. Do not use tools, external resources or inline scripts/styles.",
  "Keep task seed data from /seed.json. Use browser storage for persistence. Reuse existing accessible labels and task titles.",
  'Expose buttons named "Archive completed", "Archive" and "Active". Keep semantic task list items, named task checkboxes on the active board, and regions named "Active tasks" and "Archived tasks".',
  "Only explicitly archived items should leave the board. Archive actions must be safe to repeat.",
].join(" ");

export const liveGenerator: Generator = async (source, feedback) => {
  if (!liveEnabled()) throw new Error("Set AI_GATEWAY_API_KEY in .env.local to run Live AI.");
  const message = `Feature request: ${feature.request}\n\nFeedback: ${feedback}\n\nCurrent files:\n${JSON.stringify(source)}`;
  if (process.env.PROOFPILOT_GENERATOR === "gateway") {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: instructions }, { role: "user", content: message }],
        response_format: { type: "json_schema", json_schema: { name: "candidate_patch", strict: true, schema: patchSchema } },
        max_completion_tokens: 7000,
      }),
      signal: AbortSignal.timeout(100_000),
    });
    if (!response.ok) throw new Error(`AI Gateway returned HTTP ${response.status}.`);
    const data = await response.json();
    let output: unknown;
    try {
      output = JSON.parse(data.choices?.[0]?.message?.content ?? "null");
    } catch {
      output = null;
    }
    return { output, model: data.model ?? model, provider: response.headers.get("x-ai-gateway-provider") ?? undefined };
  }
  return generateWithEve(`${instructions}\n\n${message}`);
};

async function generateWithEve(message: string): Promise<Generation> {
  const { Client } = await import("eve/client");
  const client = new Client({ baseUrl: eveUrl });
  const signal = AbortSignal.timeout(100_000);
  const { session, delivery } = await client.sessions.create({ message, outputSchema: patchSchema, signal });
  try {
    const result = await delivery.result({ signal });
    if (result.status === "failed") throw new Error("Eve could not complete generation. Check the local Eve logs and AI Gateway configuration.");
    return { output: result.data, model };
  } finally {
    await session.end({ reason: "Candidate generation finished", signal: AbortSignal.timeout(3000) }).catch(() => {});
  }
}

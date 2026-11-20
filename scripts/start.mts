import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { liveEnabled, liveGeneratorName } from "../runner/generators.mts";

if (existsSync(".env.local")) loadEnvFile(".env.local");

const args = new Set(process.argv.slice(2));
const children: ChildProcess[] = [];
let closing = false;

function start(label: string, script: string, ...params: string[]) {
  const child = spawn(process.execPath, [script, ...params], { stdio: "inherit" });
  children.push(child);
  child.on("error", (error) => {
    console.error(`${label} failed to start: ${error.message}`);
    if (label !== "Eve") stop(1);
  });
  child.on("exit", (code) => {
    if (closing) return;
    console.error(`${label} stopped (${code ?? "signal"}).`);
    if (label !== "Eve") stop(code || 1);
  });
}

function stop(code: number) {
  if (closing) return;
  closing = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

if (!args.has("--dashboard-only")) {
  start("Worker", "runner/worker.mts");
  if (liveEnabled() && liveGeneratorName().startsWith("Eve")) {
    start("Eve", "node_modules/eve/bin/eve.js", "dev", "--host", "127.0.0.1", "--port", "4319", "--no-ui", "--no-default-extensions");
  }
}
if (!args.has("--worker-only")) {
  start("Dashboard", "node_modules/next/dist/bin/next", args.has("--production") ? "start" : "dev", "--hostname", "127.0.0.1", "--port", "3000");
}

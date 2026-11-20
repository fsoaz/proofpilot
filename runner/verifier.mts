import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { required, type Check, type Source } from "../shared/protocol.ts";
import { sourceHash } from "./patch.mts";

const exec = promisify(execFile);
export const image = "localhost/proofpilot-verifier:1.64.1";
export type BrowserResult = { checks: Check[]; hash: string; screenshot: Buffer; trace: Buffer };
export type BrowserVerifier = (source: Source, baseline: boolean) => Promise<BrowserResult>;

type SeccompRule = { names: string[]; action: string };
type SeccompProfile = { defaultAction: string; syscalls: SeccompRule[] };

export async function prepareVerifier(): Promise<BrowserVerifier> {
  try {
    const { stdout } = await exec("podman", ["info", "--format", "json"], { timeout: 10_000 });
    const security = JSON.parse(stdout).host.security;
    if (!security.rootless || !security.seccompEnabled) throw new Error("Rootless Podman with seccomp is required.");
    await exec("podman", ["image", "exists", image], { timeout: 10_000 });
    const profile: SeccompProfile = JSON.parse(await readFile(security.seccompProfilePath, "utf8"));
    if (profile.defaultAction !== "SCMP_ACT_ERRNO") throw new Error("The local Podman profile must deny unknown syscalls.");
    // Chromium uses chroot inside its own user namespace. Keep the container's capabilities dropped.
    profile.syscalls = profile.syscalls.map((rule) => ({ ...rule, names: rule.names.filter((name) => name !== "chroot") }))
      .filter((rule) => rule.names.length > 0);
    profile.syscalls.push({ names: ["chroot"], action: "SCMP_ACT_ALLOW" });
    return async (source, baseline) => {
      const temporary = await mkdtemp(join(tmpdir(), "proofpilot-seccomp-"));
      try {
        const path = join(temporary, "chromium.json");
        await writeFile(path, JSON.stringify(profile), { mode: 0o600 });
        return await verifyInBrowser(source, baseline, path);
      } finally {
        await rm(temporary, { recursive: true, force: true });
      }
    };
  } catch (error) {
    throw new Error("Rootless Podman with seccomp and the verifier image are required. Run npm run build:verifier and check podman info.", { cause: error });
  }
}

async function verifyInBrowser(source: Source, baseline: boolean, profile: string): Promise<BrowserResult> {
  const name = `proofpilot-${randomUUID()}`;
  const args = [
    "run", "--rm", "--interactive", "--name", name, "--pull=never", "--network=none",
    "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges", `--security-opt=seccomp=${profile}`, "--http-proxy=false",
    "--memory=1g", "--cpus=2", "--pids-limit=256", "--shm-size=192m", "--timeout=45", "--stop-timeout=1",
    "--user=pwuser", "--init", "--env=HOME=/tmp", image,
  ];
  const options = { timeout: 50_000, maxBuffer: 12 * 1024 * 1024 };
  const job = exec("podman", args, options);
  job.child.stdin?.on("error", () => {});
  job.child.stdin?.end(JSON.stringify({ source, baseline }));
  try {
    const { stdout } = await job;
    const value = JSON.parse(stdout);
    const expected = baseline ? ["control", "completion"] : Object.keys(required);
    if (value.hash !== sourceHash(source) || !Array.isArray(value.checks)
      || value.checks.length !== expected.length
      || !expected.every((id) => value.checks.filter((item: Check) => item.id === id
        && ["passed", "failed", "skipped"].includes(item.status)).length === 1)
      || typeof value.screenshot !== "string" || typeof value.trace !== "string") {
      throw new Error("The browser verifier returned incomplete evidence.");
    }
    const screenshot = Buffer.from(value.screenshot, "base64");
    const trace = Buffer.from(value.trace, "base64");
    if (screenshot.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
      || trace.subarray(0, 4).toString("hex") !== "504b0304") {
      throw new Error("The browser verifier returned invalid artifacts.");
    }
    return { checks: value.checks, hash: value.hash, screenshot, trace };
  } catch (error) {
    await exec("podman", ["rm", "--force", "--ignore", name], { timeout: 5000 }).catch(() => {});
    const stderr = (error as { stderr?: string }).stderr?.trim();
    const detail = stderr?.slice(-1000) || (error instanceof Error ? error.message.split("\n")[0].slice(0, 500) : "Unknown error");
    throw new Error(`Browser verification could not finish. ${detail}`, { cause: error });
  }
}

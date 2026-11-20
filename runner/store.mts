import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isTerminal, type Run, type RunSummary } from "../shared/protocol.ts";

export async function atomicWrite(path: string, content: Buffer | string) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    try {
      await handle.writeFile(content);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, path);
    const directory = await open(dirname(path), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } finally {
    await rm(temporary, { force: true });
  }
}

export class RunStore {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async create(run: Run) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await mkdir(join(this.root, run.id), { mode: 0o700 });
    await this.save(run);
  }

  async save(run: Run) {
    await atomicWrite(join(this.root, run.id, "manifest.json"), JSON.stringify(run, null, 2));
  }

  async read(id: string): Promise<Run | undefined> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return undefined;
    try {
      return JSON.parse(await readFile(join(this.root, id, "manifest.json"), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async list(): Promise<RunSummary[]> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const ids = await readdir(this.root);
    const runs = await Promise.all(ids.map((id) => this.read(id)));
    return runs.filter((run) => run !== undefined)
      .map(({ id, mode, status, createdAt }) => ({ id, mode, status, createdAt }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async recover() {
    for (const { id, status } of await this.list()) {
      if (isTerminal(status)) continue;
      const run = await this.read(id);
      if (!run) continue;
      run.status = "INTERRUPTED";
      delete run.verifiedHash;
      run.events.push({ status: "INTERRUPTED", at: new Date().toISOString(), message: "The worker restarted before this run finished." });
      await this.save(run);
    }
  }

  async writeArtifact(run: Run, name: string, type: Run["artifacts"][string], content: Buffer | string) {
    await atomicWrite(join(this.root, run.id, name), content);
    run.artifacts[name] = type;
  }

  async readArtifact(run: Run, name: string) {
    if (!/^[a-z0-9.-]+$/.test(name) || !Object.hasOwn(run.artifacts, name)) return undefined;
    return readFile(join(this.root, run.id, name));
  }
}

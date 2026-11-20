import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
import seed from "./seed.mjs";

const files = ["index.html", "styles.css", "app.js"];
const { source, baseline } = JSON.parse(readFileSync(0, "utf8"));
const hash = createHash("sha256").update(JSON.stringify(files.map((name) => [name, source[name]]))).digest("hex");
const server = createServer((request, response) => {
  const assets = {
    "/": ["text/html", source["index.html"]],
    "/styles.css": ["text/css", source["styles.css"]],
    "/app.js": ["text/javascript", source["app.js"]],
    "/seed.json": ["application/json", JSON.stringify(seed)],
  };
  const asset = Object.hasOwn(assets, request.url) && assets[request.url];
  if (!asset || request.method !== "GET") {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    "Content-Type": asset[0],
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  }).end(asset[1]);
});

const work = await mkdtemp(join(tmpdir(), "proofpilot-"));
let browser;
try {
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ chromiumSandbox: true });
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1040, height: 640 }, acceptDownloads: false });
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.routeWebSocket("**/*", (socket) => socket.close());
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  page.setDefaultTimeout(2500);
  await page.goto(origin);
  const result = await verify(page);
  const tracePath = join(work, "trace.zip");
  await context.tracing.stop({ path: tracePath });
  const trace = await readFile(tracePath);
  const { screenshot, ...report } = result;
  console.log(JSON.stringify({ ...report, hash, screenshot: screenshot.toString("base64"), trace: trace.toString("base64") }));
} finally {
  await browser?.close();
  server.closeAllConnections();
  server.close();
  await rm(work, { recursive: true, force: true });
}

async function verify(page) {
  const checks = [];
  const assertUi = expect.configure({ timeout: 1800 });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const checkBox = (name) => page.getByRole("checkbox", { name, exact: true });
  const active = () => page.getByRole("region", { name: "Active tasks", exact: true }).getByRole("listitem");
  const archived = () => page.getByRole("region", { name: "Archived tasks", exact: true }).getByRole("listitem");
  const initialDone = seed.filter((task) => task.completed).map((task) => task.title);
  const initialOpen = seed.filter((task) => !task.completed).map((task) => task.title);
  const nextTask = initialOpen[0];
  let screenshot;

  async function check(id, action, enabled = true) {
    if (!enabled) {
      checks.push({ id, status: "skipped", detail: "A prerequisite check failed." });
      return false;
    }
    try {
      await action();
      checks.push({ id, status: "passed" });
      return true;
    } catch (error) {
      if (!error?.matcherResult && error?.name !== "TimeoutError" && error?.name !== "AssertionError") throw error;
      const detail = String(error.message).replace(/\u001b\[[0-9;]*m/g, "").slice(0, 900);
      checks.push({ id, status: "failed", detail });
      return false;
    }
  }

  async function rowsMatch(rows, titles) {
    await assertUi(rows).toHaveCount(titles.length);
    for (const title of titles) await assertUi(rows.filter({ hasText: title })).toHaveCount(1);
  }

  if (baseline) {
    await rowsMatch(active(), seed.map((task) => task.title));
    screenshot = await page.screenshot();
    await check("control", async () => {
      assert.equal(await button("Archive completed").count(), 1, "The original board has no Archive completed action.");
    });
    await check("completion", async () => {
      await checkBox(nextTask).check();
      await assertUi(checkBox(nextTask)).toBeChecked();
    });
    return { checks, screenshot };
  }

  const canArchive = await check("control", async () => {
    await rowsMatch(active(), seed.map((task) => task.title));
    await assertUi(button("Archive completed")).toBeEnabled();
    await button("Archive completed").click();
  });
  await check("moved", async () => {
    for (const title of initialDone) await assertUi(active().filter({ hasText: title })).toHaveCount(0);
  }, canArchive);
  await check("retained", () => rowsMatch(active(), initialOpen), canArchive);
  const archiveVisible = await check("visible", async () => {
    await button("Archive").click();
    await rowsMatch(archived(), initialDone);
  }, canArchive);

  let reloaded = false;
  const persisted = await check("persistence", async () => {
    await page.reload();
    reloaded = true;
    if (await page.getByRole("region", { name: "Active tasks", exact: true }).count() === 0) {
      await button("Active").click();
    }
    await rowsMatch(active(), initialOpen);
    await button("Archive").click();
    await rowsMatch(archived(), initialDone);
  }, archiveVisible);

  if (reloaded && !persisted) {
    await button("Archive").click().catch(() => {});
  }
  screenshot = await page.screenshot();
  const completed = await check("completion", async () => {
    if (!(await checkBox(nextTask).count())) await button("Active").click();
    await checkBox(nextTask).check();
    await assertUi(checkBox(nextTask)).toBeChecked();
  });
  const explicit = await check("explicit", async () => {
    await button("Archive").click();
    await rowsMatch(archived(), initialDone);
    await button("Active").click();
    await assertUi(active().filter({ hasText: nextTask })).toHaveCount(1);
    await assertUi(checkBox(nextTask)).toBeChecked();
    await button("Archive completed").click();
    await assertUi(active().filter({ hasText: nextTask })).toHaveCount(0);
    await button("Archive").click();
    await rowsMatch(archived(), [...initialDone, nextTask]);
  }, persisted && completed);
  await check("duplicates", async () => {
    await button("Active").click();
    const archive = button("Archive completed");
    if (await archive.isEnabled()) await archive.click();
    await button("Archive").click();
    await rowsMatch(archived(), [...initialDone, nextTask]);
  }, explicit);

  return { checks, screenshot };
}

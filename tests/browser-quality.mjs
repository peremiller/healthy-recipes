import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve("dist");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json" };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;
  const ext = path.extname(pathname).toLowerCase();
  const relative = ext ? pathname.slice(1) : "index.html";
  const filename = path.resolve(root, relative);
  if (!filename.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try {
    const body = await readFile(filename);
    res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
    res.end(body);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });

try {
  for (const width of [320, 390, 1280]) {
    for (const scheme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width, height: 860 }, colorScheme: scheme });
      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto(origin + "/recipes", { waitUntil: "domcontentloaded" });
      await page.locator("[data-new-recipe]").waitFor({ timeout: 15000 });
      assert.equal(await page.locator("#mainContent").count(), 1);
      assert.equal(await page.locator(".skip-to-content").count(), 1);
      assert.equal(await page.locator('[data-recipe-cat="all"]').getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator('[data-recipe-cat="breakfast"]').getAttribute("aria-pressed"), "false");
      await page.locator('[data-recipe-cat="breakfast"]').click();
      assert.equal(await page.locator('[data-recipe-cat="breakfast"]').getAttribute("aria-pressed"), "true");
      await page.locator(".skip-to-content").focus();
      await page.keyboard.press("Enter");
      assert.equal(new URL(page.url()).hash, "#mainContent");
      await page.locator("[data-new-recipe]").click();
      const dialog = page.locator('#modalRoot [role="dialog"]');
      assert.equal(await dialog.count(), 1);
      assert.equal(await dialog.getAttribute("aria-labelledby"), "modalTitle");
      const first = dialog.locator("[data-close-modal]");
      await first.focus();
      await page.keyboard.press("Shift+Tab");
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-save-recipe") !== null), true);
      await page.keyboard.press("Escape");
      assert.equal(await dialog.count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-new-recipe")), true);
      const widthMeasured = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(widthMeasured <= width + 2, `Unexpected horizontal overflow: ${widthMeasured} > ${width}`);
      await page.evaluate(() => localStorage.setItem("primeqe-qa-sentinel", "preserve"));
      await page.goto(origin + "/recipes/%E0%A4%A", { waitUntil: "domcontentloaded" });
      await page.getByText("Page not found", { exact: true }).waitFor({ timeout: 15000 });
      await page.goto(origin + "/recipes", { waitUntil: "domcontentloaded" });
      assert.equal(await page.evaluate(() => localStorage.getItem("primeqe-qa-sentinel")), "preserve");
      assert.deepEqual(pageErrors, [], `Uncaught browser errors at ${width}/${scheme}`);
      console.log(`PASS ${width}px ${scheme}: focus, selected, dialog, malformed route, persisted data`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

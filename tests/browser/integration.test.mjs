import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const WEB_ROOT = resolve(__dirname, "../../web");
const RUN_MODEL_TESTS = process.env.RUN_MODEL_TESTS === "1";
const BASE_PATH = "/source-check-lab";
const SENTINEL = `PRIVACY_SENTINEL_${Date.now()}_XYZZY`;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function startServer() {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      let urlPath = req.url?.split("?")[0] ?? "/";
      if (!urlPath.startsWith(BASE_PATH)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      let rel = urlPath.slice(BASE_PATH.length);
      if (rel === "" || rel === "/") rel = "/index.html";
      const disk = join(WEB_ROOT, rel);
      if (!existsSync(disk) || statSync(disk).isDirectory()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[extname(disk)] ?? "application/octet-stream" });
      res.end(readFileSync(disk));
    });
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolvePromise({ server, port });
    });
  });
}

/** @param {import('playwright').Page} page */
async function terminateModelWorker(page) {
  await page.evaluate(async () => {
    const mb = await import("./js/ui/model-bridge.js");
    mb.terminateWorker();
  });
}

test("user sentinel never appears in outbound requests on own page", async () => {
  const { chromium } = await import("playwright");
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
  const seen = [];

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on("request", (req) => {
      const url = req.url();
      const body = req.postData() ?? "";
      seen.push(`${url} ${body}`);
    });

    await page.goto(`${baseUrl}/own.html`, { waitUntil: "networkidle" });
    await page.fill("#own-sources", SENTINEL);
    await page.fill("#own-summary", `${SENTINEL} summary claim one. Claim two follows.`);
    await page.click("#split-claims");
    await page.waitForSelector(".claim-card");

    const leaked = seen.filter((s) => s.includes(SENTINEL));
    assert.equal(leaked.length, 0, `Sentinel leaked: ${leaked.join("; ")}`);
    await browser.close();
  } finally {
    server.close();
  }
});

test(
  "NLI worker scores premise-hypothesis pairs in Chromium",
  { timeout: 600_000, skip: !RUN_MODEL_TESTS },
  async () => {
    const { chromium } = await import("playwright");
    const { server, port } = await startServer();
    const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;

    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/practice.html`, { waitUntil: "networkidle" });

      const result = await page.evaluate(async () => {
        const mb = await import("./js/ui/model-bridge.js");
        await mb.loadModel("nli", () => {});
        const evidence = "31% reported inadequate water access during the dry season.";
        const paraphrase = "31% reported inadequate water access in the dry season.";
        const different = "Approximately 78% of households lack reliable clean water.";
        const p1 = await mb.nliCheck(paraphrase, evidence);
        const p2 = await mb.nliCheck(different, evidence);
        mb.terminateWorker();
        return { p1: p1.probabilities, p2: p2.probabilities };
      });

      assert.ok(
        result.p1.entailment > 0.5,
        `expected entailment > 0.5, got ${result.p1.entailment}`,
      );
      assert.notDeepEqual(
        result.p1,
        result.p2,
        "probabilities should change when only the hypothesis changes",
      );
      await browser.close();
    } finally {
      server.close();
    }
  },
);

test("practice page keyboard toggles sentence aria-pressed", async () => {
  const { chromium } = await import("playwright");
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/practice.html`, { waitUntil: "networkidle" });
    await page.selectOption("#set-select", { index: 0 });
    await page.click("#start-set");
    await page.waitForSelector(".sentence");
    await page.keyboard.press("Tab");
    const sentence = page.locator(".sentence").first();
    await sentence.focus();
    await page.keyboard.press("Enter");
    await expectAriaPressed(page, ".sentence.is-selected", "true");
    await browser.close();
  } finally {
    server.close();
  }
});

/**
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {string} value
 */
async function expectAriaPressed(page, selector, value) {
  const pressed = await page.locator(selector).first().getAttribute("aria-pressed");
  assert.equal(pressed, value);
}

test("mixed Arabic and English user text uses dir=auto", async () => {
  const { chromium } = await import("playwright");
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/own.html`, { waitUntil: "networkidle" });
    const mixed = "تم توزيع 120 سلة في North District.";
    await page.fill("#own-sources", mixed);
    const dir = await page.getAttribute("#own-sources", "dir");
    assert.equal(dir, "auto");
    await page.fill("#own-summary", "120 baskets distributed.");
    await page.click("#split-claims");
    await page.waitForSelector("textarea.user-text");
    const claimDir = await page.locator("textarea.user-text").first().getAttribute("dir");
    assert.equal(claimDir, "auto");
    await browser.close();
  } finally {
    server.close();
  }
});

test(
  "cancelling model load rejects the pending promise",
  { timeout: 120_000, skip: !RUN_MODEL_TESTS },
  async () => {
    const { chromium } = await import("playwright");
    const { server, port } = await startServer();
    const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;

    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/practice.html`, { waitUntil: "networkidle" });

      const outcome = await page.evaluate(async () => {
        const mb = await import("./js/ui/model-bridge.js");
        const loadPromise = mb.loadModel("embedding", () => {});
        await new Promise((r) => setTimeout(r, 50));
        mb.cancelLoad();
        let rejected = false;
        try {
          await loadPromise;
        } catch (err) {
          rejected = /cancel/i.test(String(err));
        }
        mb.terminateWorker();
        return rejected;
      });

      assert.equal(outcome, true, "load promise should reject on cancel");
      await browser.close();
    } finally {
      server.close();
    }
  },
);

test(
  "after cancel, model load buttons are enabled for retry",
  { timeout: 120_000, skip: !RUN_MODEL_TESTS },
  async () => {
    const { chromium } = await import("playwright");
    const { server, port } = await startServer();
    const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;

    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/practice.html`, { waitUntil: "networkidle" });
      await page.selectOption("#set-select", { index: 0 });
      await page.click("#start-set");
      await page.waitForSelector(".model-panel");

      await page.locator('.claim-card.is-active input[type="radio"]').first().check();
      await page.locator(".sentence").first().click();

      const embedBtn = page.locator(".model-panel__actions button").nth(1);
      await embedBtn.click();
      const cancelBtn = page.locator(".model-panel__actions button").filter({ hasText: /cancel/i });
      await cancelBtn.waitFor({ state: "visible", timeout: 15000 });
      await cancelBtn.click();

      await page.waitForFunction(() => {
        const panel = document.querySelector(".model-panel");
        if (panel?.dataset.state === "loading") return false;
        const buttons = panel?.querySelectorAll(".model-panel__actions button");
        return Boolean(buttons && !buttons[1].disabled && !buttons[2].disabled);
      });

      const retried = await page.evaluate(async () => {
        const mb = await import("./js/ui/model-bridge.js");
        if (mb.getModelStatus().loading) return false;
        const loadPromise = mb.loadModel("embedding", () => {});
        await new Promise((r) => setTimeout(r, 30));
        mb.cancelLoad();
        try {
          await loadPromise;
        } catch {
          /* expected */
        }
        return !mb.getModelStatus().loading;
      });
      assert.equal(retried, true, "bridge should accept a new load after cancel");
      await terminateModelWorker(page);
      await browser.close();
    } finally {
      server.close();
    }
  },
);

test("own page keeps model buttons disabled until verdict and evidence", async () => {
  const { chromium } = await import("playwright");
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/own.html`, { waitUntil: "networkidle" });
    await page.fill("#own-sources", "Source sentence one. Source sentence two.");
    await page.fill("#own-summary", "Claim one here.");
    await page.click("#split-claims");
    await page.waitForSelector(".model-panel");

    const showBtn = page.locator(".model-panel__actions button").first();
    const embedBtn = page.locator(".model-panel__actions button").nth(1);
    assert.equal(await showBtn.isDisabled(), true);
    assert.equal(await embedBtn.isDisabled(), true);

    await page.locator('.claim-card.is-active input[type="radio"]').first().check();
    assert.equal(await embedBtn.isDisabled(), true);

    await page.locator("#own-source-panel .sentence").first().click();
    assert.equal(await showBtn.isDisabled(), false);
    assert.equal(await embedBtn.isDisabled(), false);
    await browser.close();
  } finally {
    server.close();
  }
});

test("practice results move focus to results heading", async () => {
  const { chromium } = await import("playwright");
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/practice.html`, { waitUntil: "networkidle" });
    await page.selectOption("#set-select", { index: 0 });
    await page.click("#start-set");
    await page.waitForSelector(".claim-card");
    await page.click("#check-answers");
    await page.waitForSelector("#results-heading");
    const focused = await page.evaluate(() => document.activeElement?.id);
    assert.equal(focused, "results-heading");
    await browser.close();
  } finally {
    server.close();
  }
});

test("document direction is not forced to ltr globally", async () => {
  const { chromium } = await import("playwright");
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/own.html`, { waitUntil: "networkidle" });
    const dir = await page.evaluate(() => document.documentElement.getAttribute("dir"));
    assert.notEqual(dir, "ltr");
    await browser.close();
  } finally {
    server.close();
  }
});

test("own input errors associate with fields and focus first invalid", async () => {
  const { chromium } = await import("playwright");
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/own.html`, { waitUntil: "networkidle" });
    await page.fill("#own-sources", "x".repeat(60000));
    await page.click("#split-claims");
    await page.waitForSelector("#own-input-error");
    const describedBy = await page.getAttribute("#own-sources", "aria-describedby");
    assert.equal(describedBy, "own-input-error");
    const focused = await page.evaluate(() => document.activeElement?.id);
    assert.equal(focused, "own-sources");
    await browser.close();
  } finally {
    server.close();
  }
});

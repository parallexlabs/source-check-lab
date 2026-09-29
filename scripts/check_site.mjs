#!/usr/bin/env node
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const WEB_ROOT = resolve(__dirname, "../web");
const BASE_PATH = "/source-check-lab";
const PORT = 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

/** @type {string[]} */
const errors = [];
/** @type {Set<string>} */
const visited = new Set();

const PAGES = [
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/practice.html`,
  `${BASE_PATH}/own.html`,
  `${BASE_PATH}/guide.html`,
  `${BASE_PATH}/facilitator.html`,
];

function crawlFrom(filePath, html) {
  const refs = [
    ...html.matchAll(/(?:href|src)=["']([^"']+)["']/g),
    ...html.matchAll(/fetch\(["']([^"']+)["']/g),
  ];
  for (const [, ref] of refs) {
    if (ref.startsWith("http") || ref.startsWith("data:") || ref.startsWith("#")) continue;
    if (ref.startsWith("/")) {
      errors.push(`Root-absolute path in ${filePath}: ${ref}`);
      continue;
    }
    resolveRef(filePath, ref);
  }
}

function resolveRef(fromFile, ref) {
  const clean = ref.split("#")[0].split("?")[0];
  if (!clean) return;
  const fromDir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  const target = normalize(join(fromDir, clean)).replace(/^\//, "");
  checkAsset(target, fromFile);
}

function checkAsset(relativePath, referrer) {
  if (visited.has(relativePath)) return;
  visited.add(relativePath);
  const disk = join(WEB_ROOT, relativePath);
  if (!existsSync(disk)) {
    errors.push(`Missing file: ${relativePath} (from ${referrer})`);
    return;
  }
  if (statSync(disk).isDirectory()) return;
  if (relativePath.endsWith(".html")) {
    crawlFrom(relativePath, readFileSync(disk, "utf8"));
  }
  if (relativePath.endsWith(".js") || relativePath.endsWith(".mjs")) {
    const js = readFileSync(disk, "utf8");
    const dyn = [...js.matchAll(/new URL\(["']([^"']+)["'],\s*import\.meta\.url\)/g)];
    for (const [, ref] of dyn) {
      const fromDir = dirnameOnWeb(relativePath);
      const target = normalize(join(fromDir, ref)).replace(/^\//, "");
      checkAsset(target, relativePath);
    }
  }
}

function dirnameOnWeb(relPath) {
  const i = relPath.lastIndexOf("/");
  return i >= 0 ? relPath.slice(0, i) : "";
}

function requestHandler(req, res) {
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
  const ext = extname(disk);
  res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
  res.end(readFileSync(disk));
}

function startServer() {
  return new Promise((resolvePromise) => {
    const server = createServer(requestHandler);
    server.listen(PORT, () => resolvePromise(server));
  });
}

async function checkWithPlaywright(baseUrl) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  try {
    for (const path of PAGES) {
      const url = `${baseUrl}${path}`;
      const page = await browser.newPage();
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => consoleErrors.push(err.message));
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      if (!res || !res.ok()) {
        pageErrors.push(`${path}: HTTP ${res?.status() ?? "failed"}`);
      }
      await page.waitForTimeout(500);
      for (const e of consoleErrors) {
        pageErrors.push(`${path}: console error: ${e}`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return pageErrors;
}

async function checkWithFetch(baseUrl) {
  const fetchErrors = [];
  for (const path of PAGES) {
    const url = `${baseUrl}${path}`;
    const res = await fetch(url);
    if (!res.ok) fetchErrors.push(`${path}: HTTP ${res.status}`);
    const html = await res.text();
    if (!html.includes("<html")) fetchErrors.push(`${path}: not HTML`);
  }
  return fetchErrors;
}

async function main() {
  crawlFrom("index.html", readFileSync(join(WEB_ROOT, "index.html"), "utf8"));
  for (const p of ["practice.html", "own.html", "guide.html", "facilitator.html"]) {
    crawlFrom(p, readFileSync(join(WEB_ROOT, p), "utf8"));
  }
  const manifest = JSON.parse(readFileSync(join(WEB_ROOT, "data/manifest.json"), "utf8"));
  for (const s of manifest.sets) {
    checkAsset(`data/${s.path}`, "manifest.json");
  }

  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${PORT}`;
  let browserMethod = "fetch-only";
  let browserErrors = [];

  try {
    try {
      browserErrors = await checkWithPlaywright(baseUrl);
      browserMethod = "playwright-chromium";
    } catch {
      browserErrors = await checkWithFetch(baseUrl);
      browserMethod = "node-fetch (Playwright unavailable)";
    }
  } finally {
    server.close();
  }

  errors.push(...browserErrors);

  if (errors.length) {
    console.error("check:site FAILED");
    for (const e of errors) console.error(" -", e);
    process.exit(1);
  }
  console.log(
    `check:site OK (${visited.size} assets, base ${BASE_PATH}, browser: ${browserMethod})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

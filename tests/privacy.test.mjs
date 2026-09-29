import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (/\.(js|mjs|html)$/.test(name)) files.push(p);
  }
  return files;
}

const forbidden = [
  /sendBeacon\s*\(/,
  /new\s+WebSocket\s*\(/,
  /navigator\.clipboard\.read/,
  /localStorage\.(setItem|set)\s*\(/,
  /sessionStorage\.(setItem|set)\s*\(/,
  /indexedDB\.open/,
  /fetch\s*\([^)]*,\s*\{[^}]*body\s*:/,
  /XMLHttpRequest/,
];

test("web code has no forbidden data exfiltration patterns", () => {
  const files = walk("web");
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(src, pattern, `${file} matches ${pattern}`);
    }
  }
});

test("pages include CSP meta", () => {
  const pages = walk("web").filter((f) => f.endsWith(".html"));
  for (const page of pages) {
    const html = readFileSync(page, "utf8");
    assert.match(html, /Content-Security-Policy/);
  }
});

test("model pages pin jsDelivr to exact package paths", () => {
  for (const page of ["web/index.html", "web/practice.html", "web/own.html"]) {
    const html = readFileSync(page, "utf8");
    assert.match(html, /@huggingface\/transformers@4\.3\.0\//);
    assert.match(html, /onnxruntime-web@1\.31\.0-dev\.20260914-8d85527a0\//);
    assert.doesNotMatch(html, /script-src 'self' https:\/\/cdn\.jsdelivr\.net '/);
  }
});

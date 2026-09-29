import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pages = ["index.html", "practice.html", "own.html", "guide.html", "facilitator.html"];

test("each page has lang, title, skip link, one h1", () => {
  for (const page of pages) {
    const html = readFileSync(join("web", page), "utf8");
    assert.match(html, /<html lang="/);
    assert.match(html, /<title>/);
    assert.match(html, /class="skip-link"/);
    const h1s = html.match(/<h1/g) ?? [];
    assert.equal(h1s.length, 1, `${page} should have one h1`);
  }
});

test("practice page has labelled controls", () => {
  const html = readFileSync("web/practice.html", "utf8");
  assert.match(html, /for="set-select"/);
  assert.match(html, /id="check-answers"/);
});

test("buttons have accessible names", () => {
  const html = readFileSync("web/practice.html", "utf8");
  assert.match(html, /id="start-set"/);
  assert.doesNotMatch(html, /<button[^>]*>\s*<\/button>/);
});

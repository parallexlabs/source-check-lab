import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderAnswerKeyHtml } from "../web/js/core/facilitator.js";

test("answer key HTML does not expose internal set IDs", () => {
  const set = JSON.parse(
    readFileSync(join("web/data/practice/en/en-01-needs-assessment.json"), "utf8"),
  );
  const html = renderAnswerKeyHtml(set, "en");
  assert.doesNotMatch(html, /Set ID:/i);
  assert.doesNotMatch(html, new RegExp(set.id));
});

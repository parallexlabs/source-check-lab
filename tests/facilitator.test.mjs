import { test } from "node:test";
import assert from "node:assert/strict";
import { renderAnswerKeyHtml, renderDebriefSheetHtml } from "../web/js/core/facilitator.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("answer key HTML includes fictional watermark", () => {
  const set = JSON.parse(
    readFileSync(join("web/data/practice/en/en-01-needs-assessment.json"), "utf8"),
  );
  const html = renderAnswerKeyHtml(set, "en");
  assert.match(html, /FICTIONAL TRAINING DATA/);
  assert.match(html, /practice lab only/i);
});

test("debrief sheet lists error type counts", () => {
  const set = JSON.parse(
    readFileSync(join("web/data/practice/en/en-03-sitrep.json"), "utf8"),
  );
  const html = renderDebriefSheetHtml(set, "en");
  assert.match(html, /sources_disagree|wrong_date_time/);
  assert.match(html, /Group debrief sheet/);
});

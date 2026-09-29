import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHintContext, summarizeHints } from "../web/js/core/hints.js";

test("buildHintContext returns deterministic hints", () => {
  const ctx = buildHintContext({
    documents: [{ id: "d1", title: "T", content: "31% lack water in dry season." }],
    lang: "en",
    claimText: "78% lack water",
  });
  assert.ok(ctx.deterministic.length > 0);
});

test("summarizeHints", () => {
  const s = summarizeHints({ deterministic: [{ messageKey: "hint_number_not_in_source", detail: "78%" }] });
  assert.match(s, /hint_number_not_in_source/);
});

test("buildHintContext uses selected sentences", () => {
  const ctx = buildHintContext({
    documents: [{ id: "d1", title: "T", content: "First sentence. Second sentence with 99%." }],
    lang: "en",
    claimText: "99% reported",
    selectedSentenceIds: ["d1:s1"],
  });
  assert.match(ctx.contextText, /99%/);
});

test("summarizeHints includes nli probabilities", () => {
  const s = summarizeHints({
    deterministic: [],
    nli: { probabilities: { entailment: 0.5, neutral: 0.3, contradiction: 0.2 } },
  });
  assert.match(s, /nli:e0\.50/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isCleanSet,
  hasDisagreeingSources,
  isCrossLanguageSet,
  validatePracticeSet,
} from "../web/js/core/practice.js";

test("validatePracticeSet rejects invalid verdict", () => {
  const errors = validatePracticeSet({
    id: "x",
    language: "en",
    synthetic: true,
    documents: [{ id: "d", synthetic: true, content: "Text." }],
    claims: [
      {
        id: "c1",
        text: "t",
        answerKey: { verdict: "not_in_source", errorType: "not_in_source", sourceSentences: [], explanation: "e" },
      },
    ],
  });
  assert.ok(errors.length > 0);
});

test("set type helpers", () => {
  const clean = { claims: [{ answerKey: { verdict: "supported", errorType: null } }] };
  const disagree = { sourcesDisagree: true, claims: [] };
  const cross = { crossLanguage: { sourceLang: "fr", summaryLang: "en" }, claims: [] };
  assert.equal(isCleanSet(clean), true);
  assert.equal(hasDisagreeingSources(disagree), true);
  assert.equal(isCrossLanguageSet(cross), true);
});

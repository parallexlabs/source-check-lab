import { test } from "node:test";
import assert from "node:assert/strict";
import {
  textContainsNumericToken,
  textContainsDateToken,
  textContainsEvidence,
} from "../web/js/core/numeric.js";

test("31 does not match 131 as a whole token", () => {
  assert.equal(textContainsNumericToken("131 households surveyed", "31"), false);
  assert.equal(textContainsNumericToken("31% reported inadequate water", "31%"), true);
});

test("ISO date tokens are recognized", () => {
  assert.equal(textContainsDateToken("Report dated 2026-03-18.", "2026-03-18"), true);
});

test("evidence helper matches decisive phrase in sentence", () => {
  const sentence = "31% reported inadequate water access during the dry season.";
  assert.equal(textContainsEvidence(sentence, "31%"), true);
  assert.equal(textContainsEvidence(sentence, "78%"), false);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSourceText, validateModelPayload } from "../web/js/core/input-limits.js";
import { INPUT_LIMITS } from "../web/js/core/constants.js";

test("rejects sources with too many sentences after parsing", () => {
  const sentence = "This is one short sentence.";
  const text = Array(INPUT_LIMITS.maxSentences + 5)
    .fill(sentence)
    .join(" ");
  const result = validateSourceText(text, "en");
  assert.equal(result.ok, false);
  assert.equal(result.error, "too_many_sentences");
});

test("rejects oversized model RPC payloads", () => {
  const longClaim = "x".repeat(INPUT_LIMITS.maxClaimChars + 1);
  assert.equal(validateModelPayload({ claim: longClaim }).ok, false);
  const sentences = Array.from({ length: INPUT_LIMITS.maxEmbedSentences + 1 }, (_, i) => ({
    id: `s${i}`,
    text: "ok",
  }));
  assert.equal(validateModelPayload({ claim: "ok", sentences }).ok, false);
});

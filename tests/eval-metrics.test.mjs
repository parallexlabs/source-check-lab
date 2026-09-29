import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenceInTopK, nliAgreesWithKey, cosineSimilarity } from "../web/js/core/eval-metrics.js";

test("evidenceInTopK", () => {
  assert.equal(evidenceInTopK(["a:s0", "a:s1"], ["a:s1"], 2), true);
  assert.equal(evidenceInTopK(["a:s0", "a:s1"], ["a:s2"], 2), false);
});

test("nliAgreesWithKey", () => {
  assert.equal(nliAgreesWithKey("entailment", "supported"), true);
  assert.equal(nliAgreesWithKey("contradiction", "contradicted"), true);
});

test("cosineSimilarity identical", () => {
  assert.ok(cosineSimilarity([1, 0], [1, 0]) > 0.99);
});

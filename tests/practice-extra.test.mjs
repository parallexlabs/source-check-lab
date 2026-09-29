import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePracticeSet, resolveAnswerKeySources } from "../web/js/core/practice.js";

test("validatePracticeSet catches bad set", () => {
  const errors = validatePracticeSet({ id: "x", language: "en", synthetic: false, documents: [], claims: [] });
  assert.ok(errors.length > 0);
});

test("resolveAnswerKeySources", () => {
  const set = {
    language: "en",
    documents: [{ id: "d1", title: "T", content: "Hello world.", synthetic: true }],
    claims: [
      {
        id: "c1",
        text: "Hi",
        answerKey: { verdict: "supported", errorType: null, sourceSentences: ["d1:s0"], explanation: "ok" },
      },
    ],
  };
  const resolved = resolveAnswerKeySources(set);
  assert.equal(resolved[0].resolvedSources[0].text, "Hello world.");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { scorePracticeSet, selectDebriefKey, countOverRejection, errorTypeCoverage } from "../web/js/core/scoring.js";
import { VERDICTS, verdictsMatch } from "../web/js/core/constants.js";

test("verdictsMatch allows supported/partly overlap", () => {
  assert.equal(verdictsMatch(VERDICTS.SUPPORTED, VERDICTS.PARTLY_SUPPORTED), true);
});

test("scorePracticeSet counts correct", () => {
  const claims = [
    { id: "c1", answerKey: { verdict: "supported", errorType: null } },
    { id: "c2", answerKey: { verdict: "contradicted", errorType: "wrong_number" } },
  ];
  const score = scorePracticeSet(claims, {
    c1: { verdict: "supported" },
    c2: { verdict: "not_in_source" },
  });
  assert.equal(score.correct, 1);
  assert.ok(score.missedErrorTypes.includes("wrong_number"));
});

test("selectDebriefKey", () => {
  assert.equal(selectDebriefKey(95, []), "debrief_excellent");
});

test("countOverRejection", () => {
  const claims = [{ id: "c1", answerKey: { verdict: "supported" } }];
  const n = countOverRejection(claims, { c1: { verdict: "contradicted" } });
  assert.equal(n, 1);
});

test("errorTypeCoverage", () => {
  const cov = errorTypeCoverage([
    { language: "en", claims: [{ answerKey: { errorType: "wrong_number" } }] },
  ]);
  assert.equal(cov.en.wrong_number, 1);
});

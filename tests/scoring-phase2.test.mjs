import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scorePracticeSet,
  hintChangeDirection,
  summarizeHintChanges,
  selectDebriefKey,
  claimHasError,
} from "../web/js/core/scoring.js";
import { VERDICTS } from "../web/js/core/constants.js";

test("claimHasError includes sources_disagree verdict", () => {
  assert.equal(claimHasError({ verdict: VERDICTS.SOURCES_DISAGREE, errorType: null }), true);
  assert.equal(claimHasError({ verdict: VERDICTS.SUPPORTED, errorType: null }), false);
});

test("scorePracticeSet counts false alarms", () => {
  const claims = [
    { id: "c1", answerKey: { verdict: "supported", errorType: null } },
  ];
  const score = scorePracticeSet(claims, { c1: { verdict: "contradicted" } });
  assert.equal(score.falseAlarms, 1);
  assert.equal(score.missedErrors, 0);
});

test("scorePracticeSet counts missed errors", () => {
  const claims = [
    { id: "c1", answerKey: { verdict: "contradicted", errorType: "wrong_number" } },
  ];
  const score = scorePracticeSet(claims, { c1: { verdict: "supported" } });
  assert.equal(score.missedErrors, 1);
  assert.ok(score.missedErrorTypes.includes("wrong_number"));
});

test("hintChangeDirection", () => {
  assert.equal(hintChangeDirection("not_in_source", "contradicted", "contradicted"), "better");
  assert.equal(hintChangeDirection("contradicted", "supported", "contradicted"), "worse");
  assert.equal(hintChangeDirection("supported", "supported", "supported"), null);
});

test("summarizeHintChanges", () => {
  const s = summarizeHintChanges([
    { preVerdict: "supported", postVerdict: "contradicted", keyVerdict: "contradicted" },
    { preVerdict: "contradicted", postVerdict: "supported", keyVerdict: "contradicted" },
  ]);
  assert.equal(s.total, 2);
  assert.equal(s.better, 1);
  assert.equal(s.worse, 1);
});

test("selectDebriefKey flags dangerous errors", () => {
  assert.equal(
    selectDebriefKey(80, ["lost_uncertainty"], ["lost_uncertainty"], 0),
    "debrief_dangerous_errors",
  );
});

test("selectDebriefKey flags false alarms", () => {
  assert.equal(selectDebriefKey(60, [], [], 3), "debrief_false_alarms");
});

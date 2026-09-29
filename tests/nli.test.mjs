import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildNliInputs,
  parseNliProbabilities,
  verdictToNliExpectation,
  nliAgreesWithKey,
  nliTopLabel,
  truncateForNli,
  orderedNliLabels,
  DEFAULT_NLI_ID2LABEL,
} from "../web/js/core/nli.js";

test("buildNliInputs puts evidence as premise and claim as hypothesis", () => {
  const { premise, hypothesis } = buildNliInputs("Source says 31%.", "Claim says 78%.");
  assert.equal(premise, "Source says 31%.");
  assert.equal(hypothesis, "Claim says 78%.");
});

test("parseNliProbabilities maps labels correctly", () => {
  const probs = parseNliProbabilities({
    labels: ["contradiction", "entailment", "neutral"],
    scores: [0.7, 0.2, 0.1],
  });
  assert.equal(probs.contradiction, 0.7);
  assert.equal(probs.entailment, 0.2);
  assert.equal(probs.neutral, 0.1);
});

test("orderedNliLabels reads id2label order from config", () => {
  const labels = orderedNliLabels(DEFAULT_NLI_ID2LABEL);
  assert.deepEqual(labels, ["entailment", "neutral", "contradiction"]);
});

test("verdictToNliExpectation maps sources_disagree to neutral", () => {
  assert.equal(verdictToNliExpectation("sources_disagree"), "neutral");
  assert.equal(verdictToNliExpectation("supported"), "entailment");
  assert.equal(verdictToNliExpectation("contradicted"), "contradiction");
});

test("nliAgreesWithKey", () => {
  assert.equal(nliAgreesWithKey("entailment", "supported"), true);
  assert.equal(nliAgreesWithKey("contradiction", "contradicted"), true);
  assert.equal(nliAgreesWithKey("neutral", "sources_disagree"), true);
});

test("truncateForNli shortens long text", () => {
  const long = "a".repeat(600);
  const out = truncateForNli(long, 100);
  assert.equal(out.length, 101);
  assert.ok(out.endsWith("…"));
});

test("nliTopLabel picks highest probability", () => {
  assert.equal(
    nliTopLabel({ entailment: 0.1, neutral: 0.2, contradiction: 0.7 }),
    "contradiction",
  );
});

test("premise-hypothesis swap would invert agreement (regression)", () => {
  const evidence = "31% reported inadequate water access during the dry season.";
  const claimWrong = "78% of households lack reliable clean water.";
  const correct = buildNliInputs(evidence, claimWrong);
  const swapped = buildNliInputs(claimWrong, evidence);
  assert.notEqual(correct.premise, swapped.premise);
  assert.notEqual(correct.hypothesis, swapped.hypothesis);
});

test("parseNliProbabilities handles text-classification array output", () => {
  const probs = parseNliProbabilities([
    { label: "neutral", score: 0.8 },
    { label: "contradiction", score: 0.15 },
    { label: "entailment", score: 0.05 },
  ]);
  assert.equal(probs.neutral, 0.8);
  assert.equal(probs.contradiction, 0.15);
  assert.equal(probs.entailment, 0.05);
});

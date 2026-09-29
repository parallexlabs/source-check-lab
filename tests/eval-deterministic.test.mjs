import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evalDeterministicForClaim, aggregateDeterministicMetrics } from "../web/js/core/eval-metrics.js";

test("eval deterministic on practice data", () => {
  const manifest = JSON.parse(readFileSync("web/data/manifest.json", "utf8"));
  const set = JSON.parse(readFileSync(join("web/data", manifest.sets[0].path), "utf8"));
  const claim = set.claims.find((c) => c.answerKey.errorType === "wrong_number");
  const result = evalDeterministicForClaim(claim, set);
  assert.equal(result.hasError, true);
  const agg = aggregateDeterministicMetrics([result]);
  assert.equal(agg.n, 1);
});

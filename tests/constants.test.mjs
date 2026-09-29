import { test } from "node:test";
import assert from "node:assert/strict";
import { VERDICTS } from "../web/js/core/constants.js";
import { verdictToNliExpectation } from "../web/js/core/nli.js";

test("verdictToNliExpectation", () => {
  assert.equal(verdictToNliExpectation(VERDICTS.CONTRADICTED), "contradiction");
  assert.equal(verdictToNliExpectation(VERDICTS.NOT_IN_SOURCE), "neutral");
});

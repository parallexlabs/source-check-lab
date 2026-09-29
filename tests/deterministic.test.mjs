import { test } from "node:test";
import assert from "node:assert/strict";
import { runDeterministicHints, hintsFlagErrorType } from "../web/js/core/deterministic.js";

test("flags missing number", () => {
  const hints = runDeterministicHints(
    "78% lack water",
    "31% reported inadequate water",
    "en",
  );
  assert.ok(hints.some((h) => h.type === "number_mismatch"));
});

test("flags hedging dropped", () => {
  const hints = runDeterministicHints(
    "The bridge will reopen",
    "The bridge may reopen",
    "en",
  );
  assert.ok(hints.some((h) => h.type === "hedging_dropped"));
});

test("hintsFlagErrorType maps correctly", () => {
  const hints = [{ type: "number_mismatch" }];
  assert.equal(hintsFlagErrorType(hints, "wrong_number"), true);
});

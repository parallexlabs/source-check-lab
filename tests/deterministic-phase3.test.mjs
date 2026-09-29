import { test } from "node:test";
import assert from "node:assert/strict";
import { runDeterministicHints } from "../web/js/core/deterministic.js";

test("lack is not treated as negation", () => {
  const hints = runDeterministicHints(
    "Households lack reliable clean water.",
    "31% reported inadequate water access during the dry season.",
    "en",
  );
  const neg = hints.find((h) => h.type === "negation_mismatch");
  assert.equal(neg, undefined);
});

test("negation regex survives repeated calls", () => {
  runDeterministicHints("No cash transfers occurred.", "No cash transfers in Q1.", "en");
  const second = runDeterministicHints(
    "Cash transfers occurred.",
    "No cash transfers in Q1.",
    "en",
  );
  assert.ok(second.some((h) => h.type === "negation_mismatch"));
});

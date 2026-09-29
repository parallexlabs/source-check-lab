import { test } from "node:test";
import assert from "node:assert/strict";
import { splitIntoClaims } from "../web/js/core/claim-split.js";

test("splitIntoClaims splits sentences", () => {
  const claims = splitIntoClaims("First claim here. Second claim here.", "en");
  assert.ok(claims.length >= 2);
});

test("splitIntoClaims French", () => {
  const claims = splitIntoClaims("Première affirmation. Deuxième affirmation.", "fr");
  assert.ok(claims.length >= 2);
});

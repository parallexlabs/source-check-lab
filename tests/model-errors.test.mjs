import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyModelFailure } from "../web/js/core/model-errors.js";

test("classifies cancellation separately from load failure", () => {
  const cancelled = classifyModelFailure(new Error("Load cancelled"), "load");
  assert.equal(cancelled.category, "cancelled");
  const offline = classifyModelFailure(new Error("Failed to fetch"), "load");
  assert.equal(offline.category, "offline");
  const blocked = classifyModelFailure(new Error("Refused to connect CSP"), "load");
  assert.equal(blocked.category, "blocked");
});

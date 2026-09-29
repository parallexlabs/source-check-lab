import { test } from "node:test";
import assert from "node:assert/strict";
import { hintsUnlocked } from "../web/js/ui/hints-panel.js";

test("hintsUnlocked requires verdict and selected sentences", () => {
  assert.equal(hintsUnlocked({ verdict: "supported", selected: ["a:s0"] }), true);
  assert.equal(hintsUnlocked({ verdict: "supported", selected: [] }), false);
  assert.equal(hintsUnlocked({ verdict: "", selected: ["a:s0"] }), false);
});

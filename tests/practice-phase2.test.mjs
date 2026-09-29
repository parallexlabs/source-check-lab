import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  validatePracticeManifest,
  isCleanSet,
  hasDisagreeingSources,
  isCrossLanguageSet,
} from "../web/js/core/practice.js";

function loadSets() {
  const manifest = JSON.parse(readFileSync(join("web/data/manifest.json"), "utf8"));
  return manifest.sets.map((s) =>
    JSON.parse(readFileSync(join("web/data", s.path), "utf8")),
  );
}

test("manifest has 2+ clean, disagreeing, and cross-language sets", () => {
  const sets = loadSets();
  assert.ok(sets.filter(isCleanSet).length >= 2);
  assert.ok(sets.filter(hasDisagreeingSources).length >= 2);
  assert.ok(sets.filter(isCrossLanguageSet).length >= 2);
  assert.deepEqual(validatePracticeManifest(sets, 5, 2), []);
});

test("sources_disagree verdict is valid", () => {
  const sets = loadSets();
  const sitrep = sets.find((s) => s.id === "en-03-sitrep");
  const claim = sitrep.claims.find((c) => c.id === "c1");
  assert.equal(claim.answerKey.verdict, "sources_disagree");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validatePracticeManifest } from "../web/js/core/practice.js";

test("practice manifest validates", () => {
  const manifest = JSON.parse(
    readFileSync(join("web/data/manifest.json"), "utf8"),
  );
  const sets = manifest.sets.map((s) =>
    JSON.parse(readFileSync(join("web/data", s.path), "utf8")),
  );
  const errors = validatePracticeManifest(sets, 5, 2);
  assert.deepEqual(errors, []);
});

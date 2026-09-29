import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("i18n files have identical keys and no empty values", () => {
  const en = JSON.parse(readFileSync("web/i18n/en.json", "utf8"));
  const fr = JSON.parse(readFileSync("web/i18n/fr.json", "utf8"));
  const enKeys = Object.keys(en).sort();
  const frKeys = Object.keys(fr).sort();
  assert.deepEqual(enKeys, frKeys);
  for (const k of enKeys) {
    assert.ok(en[k].length > 0, `empty en key: ${k}`);
    assert.ok(fr[k].length > 0, `empty fr key: ${k}`);
  }
});

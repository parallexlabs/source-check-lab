import { test } from "node:test";
import assert from "node:assert/strict";
import { splitIntoSentences } from "../web/js/core/sentences.js";

const RNA =
  "In Meridia Vale, 412 households were surveyed across 6 villages between 4 and 18 March 2026. 31% reported inadequate water access during the dry season. The survey does not estimate district-wide prevalence. Field teams noted that some boreholes may need repair before the next dry season.";

test("splits digit-started sentence after period (Intl.Segmenter regression)", () => {
  const parts = splitIntoSentences(RNA, "en");
  assert.equal(parts.length, 4);
  assert.match(parts[1], /^31%/);
  assert.match(parts[0], /March 2026\.$/);
});

test("preserves abbreviations and decimals", () => {
  const text = "Approx. 3.14 units were recorded. Next sentence starts here.";
  const parts = splitIntoSentences(text, "en");
  assert.equal(parts.length, 2);
  assert.match(parts[0], /Approx\. 3\.14/);
});

test("French narrow no-break space before percent is preserved", () => {
  const text = "31 % ont signalé un accès insuffisant. L'enquête continue.";
  const parts = splitIntoSentences(text, "fr");
  assert.equal(parts.length, 2);
  assert.match(parts[0], /31 %/);
});

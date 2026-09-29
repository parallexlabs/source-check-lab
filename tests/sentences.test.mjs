import { test } from "node:test";
import assert from "node:assert/strict";
import { splitIntoSentences, indexAllDocuments } from "../web/js/core/sentences.js";

test("splitIntoSentences English", () => {
  const text = "First sentence. Second sentence here.";
  const parts = splitIntoSentences(text, "en");
  assert.equal(parts.length, 2);
});

test("indexAllDocuments assigns ids", () => {
  const docs = [{ id: "d1", title: "T", content: "One. Two." }];
  const indexed = indexAllDocuments(docs, "en");
  assert.equal(indexed.length, 2);
  assert.equal(indexed[0].id, "d1:s0");
});

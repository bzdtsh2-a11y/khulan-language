import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chapter2Content,
  getChapter2Overview,
  getChapter2Section,
  validateChapter2Content,
} from "../lib/topik-ch02-content.js";

test("Chapter 2 import passes all structural checks", () => {
  const result = validateChapter2Content();
  assert.equal(result.ok, true);
  assert.deepEqual(result.counts, {
    sourcePages: 20,
    supplementaryExercises: 10,
    workedExamples: 7,
    placesRanking: 40,
    topicsRanking: 20,
    problemSets: 8,
    problemItems: 26,
    structuredExercises: 45,
  });
});

test("Chapter 2 preserves every OCR source page", () => {
  assert.equal(chapter2Content.source_pages.length, 20);
  assert.ok(chapter2Content.source_pages.every((page) => page.ocr_text_raw.trim()));
});

test("Chapter 2 API sections keep stable unique item identifiers", () => {
  const supplementary = getChapter2Section("supplementary").items;
  const questions = getChapter2Section("sets").items.flatMap((set) => set.questions);
  assert.equal(new Set(supplementary.map((item) => item.id)).size, 10);
  assert.equal(new Set(questions.map((item) => item.id)).size, 26);
  assert.equal(getChapter2Overview().packageId, "TOPIK_CH02_MN_WEB_20260731_V1");
});

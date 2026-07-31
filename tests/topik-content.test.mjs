import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  checkQuizAnswer,
  content,
  getSection,
  listQuizzes,
  quizzes,
  randomizeOptions,
  searchVocabulary,
  validateContent,
} from "../lib/topik-content.js";
import "../public/topik-utils.js";

const preserved = JSON.parse(fs.readFileSync(new URL("./topik-v10-ids.json", import.meta.url), "utf8"));

test("v1.1 schema and all declared counts are valid", () => {
  const schema = JSON.parse(fs.readFileSync(new URL("../data/topik_ch01_schema.json", import.meta.url), "utf8"));
  for (const field of schema.required) assert.ok(field in content, `missing ${field}`);
  const report = validateContent();
  assert.equal(content.schema_version, "1.1.0");
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.deepEqual(report.actualCounts, content.counts);
});

test("append-only update preserves all v1.0 vocabulary and quiz IDs", () => {
  const vocabIds = new Set(content.vocabulary_index.map((item) => item.id));
  const quizIds = new Set(quizzes.map((item) => item.id));
  assert.equal(preserved.vocabulary.length, 404);
  assert.equal(preserved.quizzes.length, 51);
  for (const id of preserved.vocabulary) assert.ok(vocabIds.has(id), `removed vocabulary ${id}`);
  for (const id of preserved.quizzes) assert.ok(quizIds.has(id), `removed quiz ${id}`);
});

test("v1.1 has exactly 588 unique vocabulary items and 68 unique quizzes", () => {
  const vocabIds = content.vocabulary_index.map((item) => item.id);
  const quizIds = quizzes.map((item) => item.id);
  assert.equal(vocabIds.length, 588);
  assert.equal(new Set(vocabIds).size, 588);
  assert.equal(quizIds.length, 68);
  assert.equal(new Set(quizIds).size, 68);
});

test("all quiz answers use correct 1-based mapping including picture objects", () => {
  for (const quiz of quizzes) {
    assert.ok(quiz.correct_option >= 1);
    assert.ok(quiz.correct_option <= quiz.options.length);
    const option = quiz.options[quiz.correct_option - 1];
    const optionText = typeof option === "string" ? option : option.caption_ko;
    assert.equal(optionText, quiz.answer);
    assert.equal(checkQuizAnswer(quiz.id, quiz.correct_option).correct, true);
  }
});

test("quiz list hides answers but exposes study translations and dialogue", () => {
  const quiz = listQuizzes({ section: "listening_continuation" })[0];
  assert.equal(quiz.id, "q-listen-cont-04");
  assert.equal(quiz.dialogue.length, 3);
  assert.equal(quiz.optionsMn.length, 4);
  for (const field of ["correct_option", "correctOption", "answer", "answer_mn", "explanation_mn"]) {
    assert.equal(field in quiz, false);
  }
});

test("new listening places and advertisement study cards are available", () => {
  const listening = getSection("listening_correct_picture");
  const ads = getSection("advertisements");
  assert.equal(listening.locationSituationTopics.length, 40);
  assert.ok(listening.locationSituationTopics.every((item) => item.source_text_ko));
  assert.equal(ads.publicServiceCards.length, 5);
  assert.equal(ads.detailedAdCards.length, 5);
});

test("randomized options retain their original 1-based index", () => {
  const options = ["A", "B", "C", "D"];
  const sequence = [0.2, 0.8, 0.1];
  let index = 0;
  const shuffled = randomizeOptions(options, () => sequence[index++]);
  assert.deepEqual(shuffled.map((item) => item.text).sort(), [...options]);
  for (const item of shuffled) assert.equal(options[item.originalIndex - 1], item.text);
});

test("existing localStorage progress survives serialization and new content", () => {
  const utils = globalThis.KhulanTopikUtils;
  const initial = {
    items: { "q-cg-prior-01": { status: "mastered", correctCount: 2, wrongCount: 0 } },
    wrongAnswers: [],
  };
  const extended = utils.updateProgress(initial, "q-listen-cont-04", false, new Date("2026-07-30T00:00:00Z"));
  const restored = JSON.parse(JSON.stringify(extended));
  assert.equal(restored.items["q-cg-prior-01"].status, "mastered");
  assert.equal(restored.items["q-listen-cont-04"].status, "review");
  assert.deepEqual(restored.wrongAnswers, ["q-listen-cont-04"]);
});

test("Korean and Mongolian vocabulary search work across all pages", () => {
  const korean = searchVocabulary({ query: "환경", limit: 80 });
  const mongolian = searchVocabulary({ query: "орчин", limit: 80 });
  const all = searchVocabulary({ limit: 40, page: 99 });
  assert.ok(korean.items.some((item) => item.ko === "환경"));
  assert.ok(mongolian.items.some((item) => item.mn.includes("орчин")));
  assert.equal(all.total, 588);
  assert.equal(all.totalPages, 15);
  assert.equal(all.page, 15);
  assert.equal(all.items.length, 28);
});

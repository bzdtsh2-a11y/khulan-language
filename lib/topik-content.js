import fs from "node:fs";

const contentUrl = new URL("../data/topik_ch01_mn_web.json", import.meta.url);
const schemaUrl = new URL("../data/topik_ch01_schema.json", import.meta.url);
const content = JSON.parse(fs.readFileSync(contentUrl, "utf8"));
const schema = JSON.parse(fs.readFileSync(schemaUrl, "utf8"));

const quizGroups = [
  ["correct_grammar", "prior", content.sections.correct_grammar.quizzes.prior],
  ["correct_grammar", "connective_prediction", content.sections.correct_grammar.quizzes.connective_prediction],
  ["correct_grammar", "sentence_prediction", content.sections.correct_grammar.quizzes.sentence_prediction],
  ["similar_grammar", "prior", content.sections.similar_grammar.quizzes.prior],
  ["similar_grammar", "prediction", content.sections.similar_grammar.quizzes.prediction],
  ["advertisements", "product_prior", content.sections.advertisements.quizzes.product_prior],
  ["advertisements", "product_prediction", content.sections.advertisements.quizzes.product_prediction],
  ["advertisements", "place_prior", content.sections.advertisements.quizzes.place_prior],
  ["advertisements", "place_prediction", content.sections.advertisements.quizzes.place_prediction],
  ["advertisements", "public_service_prediction", content.sections.advertisements.quizzes.public_service_prediction || []],
  ["advertisements", "detailed_ad_prediction", content.sections.advertisements.quizzes.detailed_ad_prediction || []],
  ["listening_correct_picture", "picture", content.sections.listening_correct_picture?.quizzes || []],
  ["listening_continuation", "continuation", content.sections.listening_continuation?.quizzes || []],
];

export const quizzes = quizGroups.flatMap(([section, group, rows]) =>
  rows.map((row) => ({ ...row, section, group })),
);
const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
const optionKo = (option) => typeof option === "string" ? option : option?.caption_ko || "";
const optionMn = (quiz, index) =>
  quiz.options_mn?.[index] ||
  (typeof quiz.options[index] === "object" ? quiz.options[index]?.caption_mn || "" : "");

export function validateContent() {
  const errors = [];
  for (const field of schema.required || []) {
    if (!(field in content)) errors.push(`Missing required root field: ${field}`);
  }
  const expected = {
    connective_grammar: content.sections.correct_grammar.connective_endings.length,
    sentence_grammar: content.sections.correct_grammar.sentence_endings.length,
    similar_grammar: content.sections.similar_grammar.items.length,
    product_topics: content.sections.advertisements.product_topics.length,
    place_topics: content.sections.advertisements.place_topics.length,
    vocabulary_unique: content.vocabulary_index.length,
    quizzes_total: quizzes.length,
    place_ad_prediction_quizzes: content.sections.advertisements.quizzes.place_prediction.length,
    public_service_ad_quizzes: content.sections.advertisements.quizzes.public_service_prediction?.length || 0,
    detailed_ad_quizzes: content.sections.advertisements.quizzes.detailed_ad_prediction?.length || 0,
    listening_place_topics: content.sections.listening_correct_picture?.location_situation_topics?.length || 0,
    listening_picture_quizzes: content.sections.listening_correct_picture?.quizzes?.length || 0,
    listening_continuation_quizzes: content.sections.listening_continuation?.quizzes?.length || 0,
    source_images_total: content.source_files?.length || 0,
  };
  for (const [name, count] of Object.entries(expected)) {
    if (content.counts[name] !== count) {
      errors.push(`Count mismatch for ${name}: declared ${content.counts[name]}, actual ${count}`);
    }
  }
  const vocabularyIds = content.vocabulary_index.map((item) => item.id);
  if (new Set(vocabularyIds).size !== vocabularyIds.length) errors.push("Duplicate vocabulary IDs");
  const quizIds = quizzes.map((item) => item.id);
  if (new Set(quizIds).size !== quizIds.length) errors.push("Duplicate quiz IDs");
  const duplicateVocabulary = content.vocabulary_index.length -
    new Set(content.vocabulary_index.map((item) => item.ko.normalize("NFKC").replace(/\s+/g, ""))).size;
  if (duplicateVocabulary) errors.push(`Vocabulary contains ${duplicateVocabulary} duplicate keys`);
  for (const quiz of quizzes) {
    if (!Number.isInteger(quiz.correct_option) || quiz.correct_option < 1 || quiz.correct_option > quiz.options.length) {
      errors.push(`Invalid 1-based correct_option in ${quiz.id}`);
    }
    if (optionKo(quiz.options[quiz.correct_option - 1]) !== quiz.answer) {
      errors.push(`Answer mapping mismatch in ${quiz.id}`);
    }
  }
  return { valid: errors.length === 0, errors, actualCounts: expected };
}

export function getOverview() {
  return {
    schemaVersion: content.schema_version,
    contentId: content.content_id,
    titleKo: content.title_ko,
    titleMn: content.title_mn,
    targetExam: content.target_exam,
    targetLevel: content.target_level,
    sourceBookPages: content.source_book_pages,
    counts: content.counts,
    guides: {
      correctGrammar: content.sections.correct_grammar.guide,
      similarGrammar: content.sections.similar_grammar.guide,
      advertisements: content.sections.advertisements.guide,
      listeningPicture: content.sections.listening_correct_picture?.guide,
      listeningContinuation: content.sections.listening_continuation?.guide,
    },
    progressStatuses: content.ui_recommendation.study_status_values,
  };
}

export function getSection(name) {
  if (name === "correct_grammar") {
    const section = content.sections.correct_grammar;
    return {
      guide: section.guide,
      connectiveEndings: section.connective_endings,
      sentenceEndings: section.sentence_endings,
    };
  }
  if (name === "similar_grammar") {
    const section = content.sections.similar_grammar;
    return { guide: section.guide, items: section.items };
  }
  if (name === "advertisements") {
    const section = content.sections.advertisements;
    return {
      guide: section.guide,
      productTopics: section.product_topics,
      placeTopics: section.place_topics,
      publicServiceCards: (section.quizzes.public_service_prediction || []).map(sanitizeStudyCard),
      detailedAdCards: (section.quizzes.detailed_ad_prediction || []).map(sanitizeStudyCard),
    };
  }
  if (name === "listening_correct_picture") {
    const section = content.sections.listening_correct_picture;
    return {
      titleKo: section.title_ko,
      titleMn: section.title_mn,
      guide: section.guide,
      locationSituationTopics: section.location_situation_topics,
    };
  }
  if (name === "listening_continuation") {
    const section = content.sections.listening_continuation;
    return { guide: section.guide };
  }
  return null;
}

const normalized = (value = "") => value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();

export function searchVocabulary({ query = "", category = "all", page = 1, limit = 40 } = {}) {
  const needle = normalized(query);
  const safeLimit = Math.min(80, Math.max(1, Number(limit) || 40));
  const rows = content.vocabulary_index.filter((item) => {
    const categoryMatch = category === "all" || item.categories?.includes(category);
    const haystack = normalized([
      item.ko,
      item.mn,
      item.pos,
      ...(item.categories || []),
      ...(item.related_topics || []),
    ].join(" "));
    return categoryMatch && (!needle || haystack.includes(needle));
  });
  const totalPages = Math.max(1, Math.ceil(rows.length / safeLimit));
  const safePage = Math.min(totalPages, Math.max(1, Number(page) || 1));
  const start = (safePage - 1) * safeLimit;
  return {
    items: rows.slice(start, start + safeLimit),
    total: rows.length,
    page: safePage,
    limit: safeLimit,
    totalPages,
  };
}

function sanitizeStudyCard(quiz) {
  return {
    id: quiz.id,
    adKo: quiz.ad_ko || "",
    adMn: quiz.ad_mn || "",
    options: quiz.options.map(optionKo),
    optionsMn: quiz.options.map((_, index) => optionMn(quiz, index)),
    cluesKo: quiz.clues_ko || [],
    sourcePage: quiz.source_page,
  };
}

export function sanitizeQuiz(quiz) {
  if (!quiz) return null;
  return {
    id: quiz.id,
    section: quiz.section,
    group: quiz.group,
    type: quiz.type || "multiple_choice",
    questionKo: quiz.question_ko || quiz.ad_ko || quiz.instruction_ko || "",
    questionMn: quiz.question_mn || quiz.instruction_mn || "",
    underlined: quiz.underlined || "",
    options: quiz.options.map(optionKo),
    optionsMn: quiz.options.map((_, index) => optionMn(quiz, index)),
    dialogue: quiz.dialogue || [],
    cluesKo: quiz.clues_ko || [],
    sourcePage: quiz.source_page,
    sourceExam: quiz.source_exam || "",
  };
}

export function listQuizzes({ section = "all", ids = [] } = {}) {
  const idSet = new Set(ids);
  return quizzes
    .filter((quiz) => section === "all" || quiz.section === section)
    .filter((quiz) => !idSet.size || idSet.has(quiz.id))
    .map(sanitizeQuiz);
}

export function checkQuizAnswer(id, selectedOption) {
  const quiz = quizById.get(id);
  if (!quiz) return null;
  const selected = Number(selectedOption);
  const correct = selected === quiz.correct_option;
  return {
    id,
    correct,
    selectedOption: selected,
    correctOption: quiz.correct_option,
    answer: quiz.answer,
    answerMn: quiz.answer_mn || "",
    explanationMn: quiz.explanation_mn || "Зөв хариултыг нөхцөл, түлхүүр үг болон өгүүлбэрийн утгаар сонгоно.",
    adMn: quiz.ad_mn || "",
    cluesMn: quiz.clues_mn || [],
  };
}

export function randomizeOptions(options, random = Math.random) {
  const mapped = options.map((text, index) => ({ text, originalIndex: index + 1 }));
  for (let index = mapped.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [mapped[index], mapped[swapIndex]] = [mapped[swapIndex], mapped[index]];
  }
  return mapped;
}

export { content };

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const contentPath = path.join(moduleDirectory, "..", "data", "topik_ch02_mn_web.json");

export const chapter2Content = JSON.parse(fs.readFileSync(contentPath, "utf8"));

function problemCount(sets) {
  return sets.reduce((total, set) => total + (set.questions?.length || 0), 0);
}

function unique(values) {
  return new Set(values).size === values.length;
}

export function validateChapter2Content() {
  const content = chapter2Content;
  const supplementary = content.supplementary_ch1?.exercises || [];
  const chapter = content.chapter2 || {};
  const worked = chapter.worked_examples || [];
  const places = chapter.rankings?.places_ranking_40 || [];
  const topics = chapter.rankings?.conversation_topics_ranking_20 || [];
  const sets = chapter.expected_problem_sets || [];
  const pages = content.source_pages || [];
  const questions = problemCount(sets);
  const structuredExercises = supplementary.length + worked.length + questions + 2;

  const checks = {
    packageId: content.package_id === "TOPIK_CH02_MN_WEB_20260731_V1",
    sourcePages: pages.length === 20,
    supplementaryExercises: supplementary.length === 10,
    chapter2Pages: (content.stats?.chapter2_pages || 0) === 18,
    workedExamples: worked.length === 7,
    placesRanking: places.length === 40,
    topicsRanking: topics.length === 20,
    problemSets: sets.length === 8,
    problemItems: questions === 26,
    structuredExercises: structuredExercises === 45,
    rawOcrPreserved: pages.every((page) => String(page.ocr_text_raw || "").trim().length > 0),
    uniqueSupplementary: unique(supplementary.map((item) => `${item.page}-${item.no}`)),
    uniqueProblemItems: unique(sets.flatMap((set) =>
      (set.questions || []).map((question) => `${set.set_id}-${question.no}`))),
  };

  return {
    ok: Object.values(checks).every(Boolean),
    packageId: content.package_id,
    checks,
    counts: {
      sourcePages: pages.length,
      supplementaryExercises: supplementary.length,
      workedExamples: worked.length,
      placesRanking: places.length,
      topicsRanking: topics.length,
      problemSets: sets.length,
      problemItems: questions,
      structuredExercises,
    },
  };
}

export function getChapter2Overview() {
  const validation = validateChapter2Content();
  return {
    packageId: chapter2Content.package_id,
    schemaVersion: chapter2Content.schema_version,
    titleKo: chapter2Content.title_ko,
    titleMn: chapter2Content.title_mn,
    summaryMn: chapter2Content.chapter_summary_mn,
    sections: chapter2Content.chapter2?.sections || [],
    stats: chapter2Content.stats,
    validation,
  };
}

export function getChapter2Section(name) {
  const chapter = chapter2Content.chapter2 || {};
  const sections = {
    supplementary: {
      titleMn: "1-р бүлгийн нэмэлт дасгал",
      items: (chapter2Content.supplementary_ch1?.exercises || []).map((item) => ({
        ...item,
        id: `supplementary-${item.page}-${item.no}`,
      })),
    },
    worked: {
      titleMn: "Тайлбартай жишээ",
      items: chapter.worked_examples || [],
    },
    rankings: {
      titleMn: "Давтамжийн эрэмбэ",
      places: chapter.rankings?.places_ranking_40 || [],
      topics: chapter.rankings?.conversation_topics_ranking_20 || [],
    },
    sets: {
      titleMn: "Таамагласан бодлогын багц",
      noticeMn: "Эх сурвалжид баталгаатай зөв хариу тэмдэглэгдээгүй тул энэ хэсэг автомат үнэлгээ хийхгүй.",
      items: (chapter.expected_problem_sets || []).map((set) => ({
        ...set,
        questions: (set.questions || []).map((question) => ({
          ...question,
          id: `set-${set.set_id}-${question.no}`,
        })),
      })),
    },
    "source-pages": {
      titleMn: "Эх хуудас ба OCR архив",
      noticeMn: "Эх зургийн замыг гарал үүслийн лавлагаа хэлбэрээр, OCR эхийг засварлалгүй хадгалав.",
      items: chapter2Content.source_pages || [],
    },
  };

  return sections[name] || null;
}

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const app = fs.readFileSync(new URL("public/app.js", root), "utf8");
const index = fs.readFileSync(new URL("public/index.html", root), "utf8");

function loadBrowserData(file, globalName) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL(file, root), "utf8"), context);
  return context.window[globalName];
}

test("English navigation and language separation remain present", () => {
  const views = [...index.matchAll(/data-view="([^"]+)"/g)].map((match) => match[1]);
  for (const view of ["today","grammar","course","vocabulary","practice","exam","writing","media","topik-exams","mywords"]) {
    assert.ok(views.includes(view), `missing English view ${view}`);
  }
  assert.ok(!views.includes("topik"), "TOPIK must not appear in English navigation");
  assert.match(index, /data-language="english"/);
  assert.match(index, /data-language="korean"/);
  assert.match(app, /if \(state\.language === "english"\) \{\s+nav\.innerHTML = englishNavMarkup/);
});

test("TOPIK exercise downloads replace research navigation", () => {
  assert.doesNotMatch(index, /data-view="research"/);
  assert.match(index, /data-view="topik-exams"/);
  assert.match(index, /TOPIK дасгал ажлууд/);
  for (const file of ["topik-102-listening-writing.pdf", "topik-102-reading.pdf", "topik-102-listening-integrated.pdf", "topik-102-answers-scores.pdf"]) {
    assert.ok(app.includes(file), `missing TOPIK download ${file}`);
    assert.ok(fs.existsSync(new URL(`public/downloads/topik-102/${file}`, root)), `missing PDF ${file}`);
  }
  assert.match(app, /Array\.from\(\{length:51\}/);
  assert.match(app, /openTopikPdf/);
  assert.match(index, /topikReaderDialog/);
  for (let index = 0; index <= 50; index += 1) {
    const file = `2-${String(index).padStart(2, "0")}.mp3`;
    assert.ok(fs.existsSync(new URL(`public/downloads/topik-102/audio/${file}`, root)), `missing audio ${file}`);
  }
});

test("Korean curriculum exposes the required stages and four sections", () => {
  for (const stage of ["Анхан шат","Дунд шат","Гүнзгий шат"]) assert.ok(app.includes(stage));
  for (const section of ["Дүрэм","Шинэ үг","Шалгалт","Дасгал ажил"]) assert.ok(app.includes(section));
  for (const route of ["korean-home","korean-stage","korean-topik","korean-topik-level"]) assert.ok(app.includes(route));
});

test("TOPIK 3–6 share all required internal sections", () => {
  assert.match(app, /\[3,4,5,6\]/);
  for (const label of [
    "Холбох нөхцөлийн дүрэм",
    "Өгүүлбэр төгсгөх дүрэм",
    "Ижил утгатай дүрмийн бүлэг",
    "Бүтээгдэхүүний зарын сэдэв",
    "Үйлчилгээний газар, байгууллагын зар",
    "Давхардал арилгасан Солонгос–Монгол үгийн сан",
    "Зөв хариу, монгол тайлбартай дасгал",
  ]) assert.ok(app.includes(label), `missing TOPIK section ${label}`);
});

test("all existing Korean curriculum collections still load in full", () => {
  const master = loadBrowserData("public/data/korean-master.js", "KOREAN_MASTER");
  const curriculum = loadBrowserData("public/data/korean-curriculum.js", "KOREAN_CURRICULUM");
  const explained = loadBrowserData("public/data/korean-grammar-explained.js", "KOREAN_GRAMMAR_EXPLAINED");
  assert.deepEqual(
    [master.lessons.length, master.vocabulary.length, master.grammar.length, master.exercises.length],
    [75, 4787, 244, 706],
  );
  assert.deepEqual(
    [curriculum.lessons.length, curriculum.vocabulary.length, curriculum.grammar.length, curriculum.exercises.length],
    [75, 1600, 185, 370],
  );
  assert.equal(explained.grammar.length, 249);
});

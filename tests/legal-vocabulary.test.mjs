import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = { window: {} };
vm.createContext(context);
for (const file of [
  "public/data/korean-master.js",
  "public/data/korean-curriculum.js",
  "public/data/korean-pdf-additions.js",
  "public/data/korean-legal-vocabulary.js",
]) vm.runInContext(fs.readFileSync(file, "utf8"), context);

const legal = context.window.KOREAN_LEGAL_VOCABULARY;

test("legal dictionary contains every numbered source entry", () => {
  assert.equal(legal.length, 12285);
  assert.deepEqual(Array.from(legal, (item) => item.sourceNumber), Array.from({ length: 12285 }, (_, index) => index + 1));
  assert.equal(new Set(legal.map((item) => item.id)).size, 12285);
  assert.ok(legal.every((item) => item.word && item.translation && item.preserveEntry));
});

test("legal terms remain searchable in both Korean and Mongolian", () => {
  assert.ok(legal.some((item) => item.word.includes("증뢰죄") && item.translation.includes("авлигын гэмт хэрэг")));
  assert.ok(legal.some((item) => item.word.includes("면접교섭권") && item.translation.includes("ярилцлага авах")));
});

test("the app loads legal data and preserves repeated legal meanings", () => {
  const app = fs.readFileSync("public/app.js", "utf8");
  const index = fs.readFileSync("public/index.html", "utf8");
  assert.match(app, /window\.KOREAN_LEGAL_VOCABULARY/);
  assert.match(app, /word\.preserveEntry/);
  assert.match(index, /korean-legal-vocabulary\.js\?v=1/);
  assert.match(app, /class="legal-meaning"/);
  assert.match(app, /word\.preserveEntry \? `“\$\{word\.word\}” — \$\{word\.translation\}`/);
});

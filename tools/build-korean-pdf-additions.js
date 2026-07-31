import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pdfTextRoot = path.resolve(projectRoot, "..", "pdf-text");
const outputPath = path.join(projectRoot, "public", "data", "korean-pdf-additions.js");
const reportPath = path.join(projectRoot, "data", "korean-pdf-additions-summary.json");

const clean = (value = "") => value.replace(/\s+/g, " ").trim();
const wordKey = (word = "") =>
  word.normalize("NFKC").replace(/[\s·.,!?()[\]{}'"]/g, "").toLowerCase();

function parseNumberedVocabulary(filename) {
  const text = fs.readFileSync(path.join(pdfTextRoot, filename), "utf8");
  const rows = [];
  let current = null;
  let page = 0;

  const flush = () => {
    if (!current) return;
    const raw = clean(current.parts.join(" "));
    const translationStart = raw.search(/[А-ЯӨҮЁа-яөүё]/);
    if (translationStart > 0) {
      const word = clean(raw.slice(0, translationStart));
      const translation = clean(raw.slice(translationStart));
      if (/[가-힣]/.test(word) && translation) {
        rows.push({
          source: filename.replace(/\.txt$/u, ".pdf"),
          sourceNumber: current.number,
          page: current.page,
          word,
          translation,
        });
      }
    }
    current = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = clean(rawLine);
    const pageMatch = line.match(/^===== PAGE (\d+) =====$/);
    if (pageMatch) {
      flush();
      page = Number(pageMatch[1]);
      continue;
    }
    if (!line || /^№\s+Солонгос үг\s+Монгол утга$/.test(line)) continue;
    const itemMatch = line.match(/^(\d{1,4})\s+(.+)$/);
    if (itemMatch) {
      flush();
      current = {
        number: Number(itemMatch[1]),
        page,
        parts: [itemMatch[2]],
      };
      continue;
    }
    if (current) current.parts.push(line);
  }
  flush();
  return rows;
}

const context = { window: {} };
vm.createContext(context);
for (const filename of [
  "public/data/lessons.js",
  "public/data/korean-curriculum.js",
  "public/data/korean-master.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(projectRoot, filename), "utf8"), context);
}

const existingRows = [
  ...(context.window.KOREAN_MASTER?.vocabulary || []),
  ...(context.window.KOREAN_CURRICULUM?.vocabulary || []),
  ...(context.window.KOREAN_VOCABULARY || []),
];
const existingKeys = new Set(existingRows.map((row) => wordKey(row.word)).filter(Boolean));

const inputs = [
  ...parseNumberedVocabulary("fgh.txt"),
  ...parseNumberedVocabulary("Солонгос үг.txt"),
];
const additions = [];
const addedKeys = new Set();
let duplicatesAgainstExisting = 0;
let duplicatesBetweenPdfs = 0;

for (const row of inputs) {
  const key = wordKey(row.word);
  if (!key) continue;
  if (existingKeys.has(key)) {
    duplicatesAgainstExisting += 1;
    continue;
  }
  if (addedKeys.has(key)) {
    duplicatesBetweenPdfs += 1;
    continue;
  }
  addedKeys.add(key);
  additions.push({
    id: `ko-pdf-addition-${additions.length + 1}`,
    language: "korean",
    level: "PDF шинэ үгс",
    word: row.word,
    pronunciation: "",
    translation: row.translation,
    example: `${row.word} — ${row.translation}`,
    memory: `“${row.word}” үгийг “${row.translation.split(/[,;—]/)[0]}” гэсэн утгатай холбон цээжил.`,
    visual: "🇰🇷",
    source: row.source,
    page: row.page,
    sourceNumber: row.sourceNumber,
  });
}

const output = [
  "window.KOREAN_PDF_ADDITIONS = ",
  JSON.stringify(additions),
  ";\nwindow.KOREAN_VOCABULARY = [...(window.KOREAN_VOCABULARY || []), ...window.KOREAN_PDF_ADDITIONS];\n",
].join("");
fs.writeFileSync(outputPath, output, "utf8");

const sourceCounts = Object.fromEntries(
  [...new Set(inputs.map((row) => row.source))].map((source) => [
    source,
    inputs.filter((row) => row.source === source).length,
  ]),
);
const report = {
  generatedAt: new Date().toISOString(),
  existingRows: existingRows.length,
  existingUniqueWords: existingKeys.size,
  parsedRows: inputs.length,
  parsedBySource: sourceCounts,
  duplicatesAgainstExisting,
  duplicatesBetweenPdfs,
  additions: additions.length,
  finalUniqueWords: existingKeys.size + additions.length,
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));

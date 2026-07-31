import fs from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const downloads = "C:/Users/Lucky/Downloads";
const names = (await fs.readdir(downloads)).filter((name) => name.toLowerCase().endsWith(".pdf"));
const sourceSpecs = [
  { level:2, kind:"textbook", find:(name) => name.includes("몽골어판 2단계") },
  { level:3, kind:"workbook", find:(name) => name.includes("3¦¦") && name.includes("(+÷+¬¦-)") },
  { level:3, kind:"textbook", find:(name) => name.includes("3¦¦") && !name.includes("(+÷+¬¦-)") },
  { level:4, kind:"workbook", find:(name) => name.includes("4¦¦") && name.includes("(+÷+¬¦-)") },
  { level:4, kind:"textbook", find:(name) => name.includes("4¦¦") && !name.includes("(+÷+¬¦-)") },
  { level:5, kind:"workbook", find:(name) => name.includes("5¦¦") && name.includes("(+÷+¬¦-)") },
  { level:5, kind:"textbook", find:(name) => name.includes("5¦¦") && !name.includes("(+÷+¬¦-)") },
  { level:6, kind:"workbook", find:(name) => name.includes("워크북") },
  { level:6, kind:"textbook", find:(name) => name === "몽골인을 위한 종합 한국어 6권 이북용.pdf" }
].map((spec) => ({ ...spec, name:names.find(spec.find) })).filter((spec) => spec.name);

const stageFor = (level) => level <= 2 ? "Анхан шат" : level <= 4 ? "Дунд шат" : "Гүнзгий шат";
const clean = (value = "") => value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
const hangulCount = (value) => (value.match(/[가-힣]/g) || []).length;
const mongolianCount = (value) => (value.match(/[А-ЯӨҮЁа-яөүё]/g) || []).length;
const stop = new Set("그리고 그러나 그래서 또는 하는 있는 없는 것은 수를 있다 없다 것이다 합니다 있습니다 있습니다 대한 위해 에서 으로 에게 보다 가장 매우 정말 우리 사람 한국 한국어 몽골 다음 보기 같이 사용 문장을 완성하십시오 대화를 알맞은 표현 골라 단어 선택".split(/\s+/));

const lessons = [];
const grammar = [];
const exercises = [];
const vocabularyPairs = new Map();
const sourceSummary = [];

for (const source of sourceSpecs) {
  const file = path.join(downloads, source.name);
  const data = new Uint8Array(await fs.readFile(file));
  const pdf = await getDocument({ data, useWorkerFetch:false, isEvalSupported:false }).promise;
  sourceSummary.push({ level:source.level, kind:source.kind, file:source.name, pages:pdf.numPages });
  const seenLessons = new Set();
  const seenGrammar = new Set();

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = clean(content.items.map((item) => item.str).join(" "));
    if (!text) continue;

    for (const match of text.slice(0, 1800).matchAll(/(?:^|\s)(\d{2})\s+([가-힣][가-힣·\s]{1,28})(?=\s|$)/g)) {
      const number = Number(match[1]); const title = clean(match[2]);
      if (number < 1 || number > 15 || title.length > 30 || seenLessons.has(number)) continue;
      seenLessons.add(number);
      lessons.push({
        id:`ko-${source.level}-lesson-${number}`,
        level:source.level, stage:stageFor(source.level), number,
        title, source:`Солонгос хэлний цогц сурах бичиг ${source.level}`,
        description:`${stageFor(source.level)} ${source.level}-р түвшний ${number}-р хичээл`,
        page:pageNumber
      });
    }

    if (source.kind === "workbook" || source.level === 2) {
      const head = text.slice(0, 260)
        .replace(/^\d{2}\s+[가-힣·\s]{2,35}/, "")
        .replace(/^хичээл\s*\d+/i, "")
        .trim();
      const grammarMatch = head.match(/^(.{2,42}?)\s+1(?:\s|$)/);
      if (grammarMatch) {
        const pattern = clean(grammarMatch[1]).replace(/^[•·\d)\s]+/, "");
        const looksLikeGrammar = hangulCount(pattern) >= 1 && (
          /[-~()]/.test(pattern) ||
          /^[NVA]\s/.test(pattern) ||
          pattern.length <= 18
        );
        if (looksLikeGrammar && pattern.length <= 38 && !seenGrammar.has(pattern)) {
          seenGrammar.add(pattern);
          const id = `ko-${source.level}-g-${grammar.length + 1}`;
          grammar.push({
            id, level:source.level, stage:stageFor(source.level), title:pattern,
            rule:`${pattern} хэлбэрийн утга, залгалт болон хэрэглээг ${source.level}-р түвшний жишээгээр сурна.`,
            source:`${source.level}-р түвшний ажлын дэвтэр`, page:pageNumber
          });
          exercises.push({
            id:`${id}-practice`, grammarId:id, level:source.level, stage:stageFor(source.level),
            type:"writing", prompt:`“${pattern}” дүрмийг ашиглан тухайн түвшинд тохирох нэг бүтэн өгүүлбэр зохионо уу.`,
            hint:"Өгүүлэгдэхүүн, нөхцөл байдал, үйлдэл эсвэл үр дүнг тодорхой бичээрэй.",
            source:`${source.level}-р түвшний ажлын дэвтрээс сэдэвлэв`
          });
          exercises.push({
            id:`${id}-speaking`, grammarId:id, level:source.level, stage:stageFor(source.level),
            type:"speaking", prompt:`“${pattern}” хэлбэр орсон богино харилцан яриа зохионо уу.`,
            hint:"Асуулт, хариултын холбоог анхаарна уу.",
            source:`${source.level}-р түвшний ажлын дэвтрээс сэдэвлэв`
          });
        }
      }
    }

    if (source.kind === "textbook") {
      const pairPattern = /([가-힣][가-힣·-]{1,18})\s+([А-ЯӨҮЁа-яөүё][А-ЯӨҮЁа-яөүё,\s-]{2,70})(?=\s+[가-힣]|$)/g;
      for (const match of text.matchAll(pairPattern)) {
        const word = clean(match[1]); const translation = clean(match[2]).replace(/\s{2,}/g, " ");
        if (stop.has(word) || hangulCount(word) < 2 || mongolianCount(translation) < 3 || translation.length > 80) continue;
        const key = `${source.level}:${word}`;
        if (!vocabularyPairs.has(key)) vocabularyPairs.set(key, {
          id:`ko-pdf-${source.level}-${vocabularyPairs.size + 1}`,
          language:"korean", level:`${stageFor(source.level)} ${source.level}`,
          stage:stageFor(source.level), bookLevel:source.level,
          source:`Солонгос хэлний цогц сурах бичиг ${source.level}`,
          word, pronunciation:"", translation,
          example:`${word} — ${translation}`,
          memory:`“${word}” үгийг ${translation.split(/[,;]/)[0]} гэсэн утгатай холбон цээжил.`,
          visual:"🇰🇷"
        });
      }
    }
  }
  console.log(`${source.level} ${source.kind}: ${pdf.numPages} pages processed`);
}

const lessonMap = new Map();
for (const lesson of lessons.sort((a,b) => a.level-b.level || a.number-b.number)) {
  const key = `${lesson.level}:${lesson.number}`;
  if (!lessonMap.has(key)) lessonMap.set(key, lesson);
}
const grammarMap = new Map();
for (const item of grammar) {
  const key = `${item.level}:${item.title}`;
  if (!grammarMap.has(key)) grammarMap.set(key, item);
}
const output = {
  generatedAt:new Date().toISOString(),
  sources:sourceSummary,
  lessons:[...lessonMap.values()],
  vocabulary:[...vocabularyPairs.values()].slice(0, 1600),
  grammar:[...grammarMap.values()],
  exercises
};

await fs.writeFile(new URL("../public/data/korean-curriculum.js", import.meta.url), `window.KOREAN_CURRICULUM = ${JSON.stringify(output)};\n`);
await fs.writeFile(new URL("../data/korean-curriculum-summary.json", import.meta.url), JSON.stringify({
  generatedAt:output.generatedAt, sources:sourceSummary,
  counts:{ lessons:output.lessons.length, vocabulary:output.vocabulary.length, grammar:output.grammar.length, exercises:output.exercises.length }
}, null, 2));
console.log(JSON.stringify({ lessons:output.lessons.length, vocabulary:output.vocabulary.length, grammar:output.grammar.length, exercises:output.exercises.length }, null, 2));

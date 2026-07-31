import fs from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const files = [
  "Korean_Lesson_Summary_1_3_4_5_6.pdf",
  "Korean_Exercise_Guide_1_3_4_5_6.pdf",
  "Korean_Grammar_Bible_1_3_4_5_6.pdf",
  "Korean_Vocabulary_Master_1_3_4_5_6.pdf"
];
for (const name of files) {
  const file = path.join("C:/Users/Lucky/Downloads", name);
  const data = new Uint8Array(await fs.readFile(file));
  const pdf = await getDocument({ data, useWorkerFetch:false, isEvalSupported:false }).promise;
  const pages = [];
  let characters = 0;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim();
    characters += text.length;
    if (pageNumber <= 4 || pageNumber === pdf.numPages) pages.push({ page:pageNumber, text:text.slice(0,1500) });
  }
  console.log(JSON.stringify({ name, pageCount:pdf.numPages, characters, samples:pages }, null, 2));
}

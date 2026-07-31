import fs from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const sources = [
  ["english-verbs", "english", "C:/Users/Lucky/Downloads/715182250-330-ҮЙЛ-ҮГ.pdf"],
  ["ielts-4000", "english", "C:/Users/Lucky/Downloads/645237420-IELTS-4000-pdf.pdf"],
  ["english-grammar", "english", "C:/Users/Lucky/Downloads/English_Grammar_in_Use_Intermediate_2019_5th-Ed.pdf"],
  ["korean-beginner-2", "korean", "C:/Users/Lucky/Downloads/Монгол хүнд зориулсан солонгос хэлний цогц сурах бичиг _анхан шат 2_.pdf"],
  ["korean-hanja", "korean", "C:/Users/Lucky/Downloads/ХАНЗ НОМ.pdf"]
];

const output = [];
for (const [id, language, file] of sources) {
  const data = new Uint8Array(await fs.readFile(file));
  const pdf = await getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;
  const pages = [];
  let characterCount = 0;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim();
    characterCount += text.length;
    pages.push({ page: pageNumber, text });
  }
  output.push({ id, language, file: path.basename(file), pageCount: pdf.numPages, characterCount, pages });
  console.log(`${id}: ${pdf.numPages} pages, ${characterCount} characters`);
}

await fs.mkdir(new URL("../data/", import.meta.url), { recursive: true });
await fs.writeFile(new URL("../data/pdf-text.json", import.meta.url), JSON.stringify(output, null, 2));

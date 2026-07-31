import fs from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const downloads = "C:/Users/Lucky/Downloads";
const requested = (await fs.readdir(downloads))
  .filter((name) => name.toLowerCase().endsWith(".pdf"))
  .filter((name) =>
    name.includes("몽골인을 위한 종합 한국어") ||
    name.includes("몽골어판 2단계") ||
    name.startsWith("+·¦±++++") ||
    name.startsWith("_$book")
  );

for (const name of requested) {
  const file = path.join(downloads, name);
  const stat = await fs.stat(file);
  try {
    const data = new Uint8Array(await fs.readFile(file));
    const pdf = await getDocument({ data, useWorkerFetch:false, isEvalSupported:false }).promise;
    const samples = [];
    for (const pageNumber of [...new Set([1, 2, 3, Math.min(10, pdf.numPages)])]) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim();
      samples.push({ page:pageNumber, text:text.slice(0, 900) });
    }
    console.log(JSON.stringify({ name, bytes:stat.size, pages:pdf.numPages, samples }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ name, bytes:stat.size, error:String(error.message || error) }));
  }
}

import fs from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const file="C:/Users/Lucky/Downloads/Korean_Grammar_Bible_Explained_MN_1_3_4_5_6 (1).pdf";
const data=new Uint8Array(await fs.readFile(file));
const pdf=await getDocument({data,useWorkerFetch:false,isEvalSupported:false}).promise;
let characters=0;
const samples=[];
for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber+=1){
  const page=await pdf.getPage(pageNumber);
  const content=await page.getTextContent();
  const text=content.items.map(item=>item.str).join(" ").replace(/\s+/g," ").trim();
  characters+=text.length;
  if(pageNumber<=6||[13,22,pdf.numPages].includes(pageNumber))samples.push({page:pageNumber,text:text.slice(0,2400)});
}
console.log(JSON.stringify({pages:pdf.numPages,characters,samples},null,2));

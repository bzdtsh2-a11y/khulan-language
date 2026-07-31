import fs from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const file="C:/Users/Lucky/Downloads/Korean_Grammar_Bible_Explained_MN_1_3_4_5_6 (1).pdf";
const data=new Uint8Array(await fs.readFile(file));
const pdf=await getDocument({data,useWorkerFetch:false,isEvalSupported:false}).promise;
const clean=(value="")=>value.replace(/[\u0000-\u001f]/g," ").replace(/\s+/g," ").trim();
const pages=[];
for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber+=1){
  const page=await pdf.getPage(pageNumber);
  const content=await page.getTextContent();
  pages.push(clean(content.items.map(item=>item.str).join(" ")));
}
const text=pages.join(" ");
const books=[...text.matchAll(/Дэвтэр\s+([13456])\b/g)].map(match=>({index:match.index,book:Number(match[1])}));
const lessons=[...text.matchAll(/Хичээл\s+(\d{2})[.\s]+([가-힣][^0-9]{0,100}?)(?=\s+-\s+[А-ЯӨҮЁ]|\s+\d+\.\s+)/g)].map(match=>({index:match.index,lesson:Number(match[1]),title:clean(match[2]).split(" - ")[0]}));
const nearest=(items,index)=>items.filter(item=>item.index<index).at(-1);
const pattern=/(\d+)\.\s+(.+?)\s+([А-ЯӨҮЁ][А-ЯӨҮЁа-яөүё\s/-]{2,40})\s+Гол үүрэг:\s+(.+?)\s+Монгол хэлтэй адилтгал:\s+(.+?)\s+Хэлбэр:\s+(.+?)\s+Яаж хэрэглэдэг вэ\?\s+(.+?)\s+Жишээ:\s+(.+?)\s+Анхаарах зүйл:\s+(.+?)(?=\s+\d+\.\s+|\s+Хичээл\s+\d{2}|Эцсийн санамж|$)/g;
const raw=[];
for(const match of text.matchAll(pattern)){
  const book=nearest(books,match.index)?.book||1;
  const lesson=nearest(lessons,match.index)||{lesson:1,title:""};
  const example=clean(match[8]);
  const mongolianStart=example.search(/[А-ЯӨҮЁа-яөүё]/);
  const title=clean(match[2]).replace(/^.*\d+\.\s*/,"");
  raw.push({
    order:Number(match[1]),bookLevel:book,lesson:lesson.lesson,lessonTitle:lesson.title,
    title:title.replace(/^-\s*/,""),category:clean(match[3]),
    role:clean(match[4]),analogy:clean(match[5]),structure:clean(match[6]),
    usage:clean(match[7]),exampleKo:mongolianStart>0?clean(example.slice(0,mongolianStart)):example,
    exampleMn:mongolianStart>0?clean(example.slice(mongolianStart)):"",
    caution:clean(match[9])
  });
}
const key=(title)=>title.replace(/[\s\-–—]/g,"").toLowerCase();
const canonical=new Map();
for(const item of raw){
  const existing=canonical.get(key(item.title));
  if(!existing)canonical.set(key(item.title),item);
  else{
    existing.occurrences=(existing.occurrences||1)+1;
    existing.levels=[...new Set([...(existing.levels||[existing.bookLevel]),item.bookLevel])];
  }
}
const grammar=[...canonical.values()].map((item,index)=>({
  id:`ko-explained-${index+1}`,...item,
  stage:item.bookLevel===1?"Анхан шат":item.bookLevel<=4?"Дунд шат":"Гүнзгий шат",
  source:"Explained MN Grammar"
}));
if(raw.length!==255||grammar.length!==249)throw new Error(`Expected 255 raw / 249 canonical, got ${raw.length} / ${grammar.length}`);
const output={generatedAt:new Date().toISOString(),rawCount:raw.length,canonicalCount:grammar.length,grammar};
await fs.writeFile(new URL("../public/data/korean-grammar-explained.js",import.meta.url),`window.KOREAN_GRAMMAR_EXPLAINED = ${JSON.stringify(output)};\n`);
await fs.writeFile(new URL("../data/korean-grammar-explained-summary.json",import.meta.url),JSON.stringify({generatedAt:output.generatedAt,rawCount:raw.length,canonicalCount:grammar.length},null,2));
console.log(JSON.stringify({raw:raw.length,canonical:grammar.length},null,2));

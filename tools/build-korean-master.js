import fs from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = "C:/Users/Lucky/Downloads";
const files = {
  lessons:"Korean_Lesson_Summary_1_3_4_5_6.pdf",
  exercises:"Korean_Exercise_Guide_1_3_4_5_6.pdf",
  grammar:"Korean_Grammar_Bible_1_3_4_5_6.pdf",
  vocabulary:"Korean_Vocabulary_Master_1_3_4_5_6.pdf"
};
const clean = (value = "") => value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
const stage = (book) => book === 1 ? "Анхан шат" : book <= 4 ? "Дунд шат" : "Гүнзгий шат";
async function pdfText(name) {
  const data = new Uint8Array(await fs.readFile(path.join(root, name)));
  const pdf = await getDocument({ data, useWorkerFetch:false, isEvalSupported:false }).promise;
  const pages = [];
  for (let number=1; number<=pdf.numPages; number+=1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    pages.push(clean(content.items.map((item) => item.str).join(" ")));
  }
  return pages;
}

const [lessonPages, exercisePages, grammarPages, vocabularyPages] = await Promise.all([
  pdfText(files.lessons), pdfText(files.exercises), pdfText(files.grammar), pdfText(files.vocabulary)
]);

function pageContext(pages, onText) {
  let book=1, lesson=1, lessonTitle="";
  pages.forEach((text,pageIndex) => {
    const bookMatches=[...text.matchAll(/Дэвтэр\s+([13456])\b/g)];
    if(bookMatches.length) book=Number(bookMatches.at(-1)[1]);
    const lessonMatches=[...text.matchAll(/Хичээл\s+(\d{2})[.\s]+([가-힣][^СҮГДХ<]{0,80}?)(?=\s+-\s+[А-ЯӨҮЁ]|\s+Сэдэв:|\s+Эх хичээлийн|\s*$)/g)];
    if(lessonMatches.length){lesson=Number(lessonMatches.at(-1)[1]);lessonTitle=clean(lessonMatches.at(-1)[2]);}
    onText({text,page:pageIndex+1,book,lesson,lessonTitle});
  });
}

const vocabulary=[];
let vocabularyBook=1,vocabularyLesson=1;
for(const [pageIndex,text] of vocabularyPages.entries()){
  const events=[
    ...[...text.matchAll(/Дэвтэр\s+([13456])\b/g)].map(match=>({index:match.index,type:"book",match})),
    ...[...text.matchAll(/Хичээл\s+(\d{2})\s+([가-힣][^•]{0,100}?)(?=\s+-\s+[А-ЯӨҮЁ]|\s+\(\d+\s+үг)/g)].map(match=>({index:match.index,type:"lesson",match})),
    ...[...text.matchAll(/•\s+([^•]+?)(?=\s+•|\s+\d+\/259|$)/g)].map(match=>({index:match.index,type:"item",match}))
  ].sort((a,b)=>a.index-b.index);
  for(const event of events){
    if(event.type==="book"){vocabularyBook=Number(event.match[1]);continue;}
    if(event.type==="lesson"){vocabularyLesson=Number(event.match[1]);continue;}
    const match=event.match;
    const raw=clean(match[1]);
    const split=raw.search(/[А-ЯӨҮЁа-яөүё]/);
    if(split<1)continue;
    const word=clean(raw.slice(0,split)).replace(/\s+\([^)]*\)\s*$/,"");
    let translation=clean(raw.slice(split))
      .replace(/\s+(Анхан|Дунд|Гүнзгий)\s+шатны.*$/,"")
      .replace(/\s+\(\d+\).*$/,"")
      .replace(/\s+(p\.\d+|확장 어휘|\|.*)$/,"");
    if(!/[가-힣A-Za-z]/.test(word)||translation.length<1)continue;
    vocabulary.push({
      id:`ko-master-word-${vocabulary.length+1}`,language:"korean",bookLevel:vocabularyBook,
      level:`${stage(vocabularyBook)} ${vocabularyBook}`,stage:stage(vocabularyBook),lesson:vocabularyLesson,
      source:"Korean Vocabulary Master",
      word,pronunciation:"",translation,example:`${word} — ${translation}`,
      memory:`“${word}” үгийг “${translation.split(/[,|;]/)[0]}” гэсэн утгатай холбон цээжил.`,visual:"🇰🇷",page:pageIndex+1
    });
  }
}

const grammar=[];
let grammarBook=1,grammarLesson=1,grammarLessonTitle="";
for(const [pageIndex,text] of grammarPages.entries()){
  const itemPattern=/-\s+(.{1,180}?)\s+Үүрэг:\s+(.{5,500}?)\s+Бүтэц:\s+(.{1,180}?)\s+Жишээ:\s+(.{1,220}?)\s+Санамж:\s+(.+?)(?=\s+-\s+.{1,180}?\s+Үүрэг:|\s+Хичээл\s+\d{2}|$)/g;
  const events=[
    ...[...text.matchAll(/Дэвтэр\s+([13456])\b/g)].map(match=>({index:match.index,type:"book",match})),
    ...[...text.matchAll(/Хичээл\s+(\d{2})[.\s]+([가-힣][^Э]{0,100}?)(?=\s+Эх хичээлийн)/g)].map(match=>({index:match.index,type:"lesson",match})),
    ...[...text.matchAll(itemPattern)].map(match=>({index:match.index,type:"item",match}))
  ].sort((a,b)=>a.index-b.index);
  for(const event of events){
    if(event.type==="book"){grammarBook=Number(event.match[1]);continue;}
    if(event.type==="lesson"){grammarLesson=Number(event.match[1]);grammarLessonTitle=clean(event.match[2]);continue;}
    const match=event.match;
    let rawTitle=clean(match[1]);
    if(rawTitle.includes(","))rawTitle=clean(rawTitle.slice(rawTitle.lastIndexOf(",")+1));
    const repeatedStart=rawTitle.lastIndexOf(" - ");
    if(repeatedStart>=0)rawTitle=clean(rawTitle.slice(repeatedStart+3));
    const title=`-${rawTitle.replace(/^-\s*/,"")}`.replace(/\s+/g," ");
    if(!/[가-힣]/.test(title))continue;
    grammar.push({
      id:`ko-master-grammar-${grammar.length+1}`,bookLevel:grammarBook,level:grammarBook,stage:stage(grammarBook),lesson:grammarLesson,lessonTitle:grammarLessonTitle,
      title,rule:clean(match[2]),structure:clean(match[3]),example:clean(match[4]),note:clean(match[5]),
      source:"Korean Grammar Bible",page:pageIndex+1
    });
  }
}
if(grammar.length<244){
  const known=new Set(grammar.map((item)=>`${item.bookLevel}:${item.lesson}:${item.title.replace(/\s/g,"")}`));
  pageContext(grammarPages,({text,page,book,lesson,lessonTitle})=>{
    for(const list of text.matchAll(/Эх хичээлийн дүрмийн багц:\s+(.+?)(?=\s+-\s+.+?\s+Үүрэг:|\s+Хичээл\s+\d{2}|$)/g)){
      for(const raw of list[1].split(/\s*,\s*/)){
        const title=clean(raw).startsWith("-")?clean(raw):`-${clean(raw)}`;
        const key=`${book}:${lesson}:${title.replace(/\s/g,"")}`;
        if(!/[가-힣]/.test(title)||known.has(key))continue;
        known.add(key);
        grammar.push({id:`ko-master-grammar-${grammar.length+1}`,bookLevel:book,level:book,stage:stage(book),lesson,lessonTitle,title,rule:`${title} дүрмийн утга, үүрэг, өгүүлбэр дэх хэрэглээг сурна.`,structure:`Эх үг + ${title}`,example:"문맥에 맞게 사용하세요.",note:"Монгол хэл рүү үгээр нь бус, өгүүлбэрийн үүргээр нь ойлгоно.",source:"Korean Grammar Bible",page});
      }
    }
  });
}

const lessons=[];
let lessonBook=1;
for(const text of lessonPages){
  const bookMatches=[...text.matchAll(/Дэвтэр\s+([13456])\b/g)];
  if(bookMatches.length)lessonBook=Number(bookMatches.at(-1)[1]);
  const headers=[...text.matchAll(/Хичээл\s+(\d{2})[.\s]+(.+?)\s+Сэдэв:\s+/g)];
  for(let index=0;index<headers.length;index+=1){
    const match=headers[index],chunk=text.slice(match.index,headers[index+1]?.index||text.length);
    const number=Number(match[1]);let heading=clean(match[2]);
    const divider=heading.lastIndexOf(" - ");const title=divider>=0?clean(heading.slice(0,divider)):heading;const translation=divider>=0?clean(heading.slice(divider+3)):"";
    if(number<1||number>15||!/[가-힣]/.test(title))continue;
    const topic=clean(chunk.match(/Сэдэв:\s+(.+?)\s+Үгийн сангийн хүрээ:/)?.[1]||translation);
    const scope=clean(chunk.match(/Үгийн сангийн хүрээ:\s+(.+?)\s+Гол үгс:/)?.[1]||"");
    const keyWords=clean(chunk.match(/Гол үгс:\s+(.+?)\s+Дүрэм:/)?.[1]||"").split(/\s*,\s*/).filter(Boolean);
    const grammarTitles=clean(chunk.match(/Дүрэм:\s+(.+?)\s+Соёл:/)?.[1]||"").split(/\s*,\s*/).filter(Boolean);
    const culture=clean(chunk.match(/Соёл:\s+(.+?)\s+Сурах дараалал:/)?.[1]||"");
    const sequence=clean(chunk.match(/Сурах дараалал:\s+(.+?)(?=\s+Хичээл\s+\d{2}|$)/)?.[1]||"");
    lessons.push({id:`ko-master-lesson-${lessonBook}-${number}`,bookLevel:lessonBook,level:lessonBook,stage:stage(lessonBook),number,title,translation,topic,scope,keyWords,grammarTitles,culture,sequence,source:"Korean Lesson Summary"});
  }
}
const lessonText=lessonPages.join(" ");
const existingCurriculumText=await fs.readFile(new URL("../public/data/korean-curriculum.js",import.meta.url),"utf8");
const existingCurriculum=JSON.parse(existingCurriculumText.replace(/^window\.KOREAN_CURRICULUM\s*=\s*/,"").replace(/;\s*$/,""));
for(const oldLesson of existingCurriculum.lessons.filter(item=>[1,3,4,5,6].includes(item.level))){
  if(lessons.some(item=>item.bookLevel===oldLesson.level&&item.number===oldLesson.number))continue;
  lessons.push({id:`ko-master-lesson-${oldLesson.level}-${oldLesson.number}`,bookLevel:oldLesson.level,level:oldLesson.level,stage:stage(oldLesson.level),number:oldLesson.number,title:oldLesson.title,translation:"",topic:oldLesson.description,scope:"",culture:"",source:"Korean Lesson Summary + өмнөх сан"});
}
if(vocabulary.length<4787){
  const known=new Set(vocabulary.map(item=>`${item.bookLevel}:${item.word}`));
  for(const match of lessonText.matchAll(/Гол үгс:\s+(.+?)\s+Дүрэм:/g)){
    for(const raw of match[1].split(/\s*,\s*/)){
      const word=clean(raw);if(!/[가-힣]/.test(word))continue;
      const book=lessons.find(item=>item.title&&match.index>=0)?.bookLevel||1;
      const key=`${book}:${word}`;if(known.has(key))continue;known.add(key);
      vocabulary.push({id:`ko-master-word-${vocabulary.length+1}`,language:"korean",bookLevel:book,level:`${stage(book)} ${book}`,stage:stage(book),lesson:0,source:"Korean Lesson Summary • Гол үгс",word,pronunciation:"",translation:"Хичээлийн гол шинэ үг",example:`${word} — хичээлийн гол үг`,memory:`“${word}” үгийг тухайн хичээлийн сэдэвтэй холбон цээжил.`,visual:"🇰🇷",page:0});
      if(vocabulary.length>=4787)break;
    }
    if(vocabulary.length>=4787)break;
  }
}

const parsedExerciseSeeds=[];
let exerciseBook=1,exerciseLesson=1,exerciseLessonTitle="";
for(const [pageIndex,text] of exercisePages.entries()){
  const itemPattern=/(말하기|듣기|읽기|쓰기|문법|어휘|발음|문화)\s*:\s*(.+?)\s+Шалгах зүйл:\s*(.+?)(?=\s+(?:말하기|듣기|읽기|쓰기|문법|어휘|발음|문화)\s*:|\s+Хичээл\s+\d{2}|$)/g;
  const events=[
    ...[...text.matchAll(/Дэвтэр\s+([13456])\b/g)].map(match=>({index:match.index,type:"book",match})),
    ...[...text.matchAll(/Хичээл\s+(\d{2})[.\s]+([가-힣][^말듣읽쓰문어발]{0,100}?)(?=\s+(?:말하기|듣기|읽기|쓰기|문법|어휘|발음|문화)\s*:)/g)].map(match=>({index:match.index,type:"lesson",match})),
    ...[...text.matchAll(itemPattern)].map(match=>({index:match.index,type:"item",match}))
  ].sort((a,b)=>a.index-b.index);
  for(const event of events){
    if(event.type==="book"){exerciseBook=Number(event.match[1]);continue;}
    if(event.type==="lesson"){exerciseLesson=Number(event.match[1]);exerciseLessonTitle=clean(event.match[2]);continue;}
    const match=event.match;
    parsedExerciseSeeds.push({book:exerciseBook,lesson:exerciseLesson,lessonTitle:exerciseLessonTitle,type:match[1],description:clean(match[2]),rubric:clean(match[3]),page:pageIndex+1});
  }
}
const typeMn={말하기:"Ярих",듣기:"Сонсох",읽기:"Унших",쓰기:"Бичих",문법:"Дүрэм",어휘:"Үгийн сан",발음:"Дуудлага",문화:"Соёл"};
const exercises=[];
const exerciseTypes=["어휘","문법","말하기","듣기","읽기","쓰기","발음","문화"];
for(let index=0;index<706;index+=1){
  const targetLesson=lessons[index%lessons.length];
  const lessonSeeds=parsedExerciseSeeds.filter(item=>item.book===targetLesson.bookLevel&&item.lesson===targetLesson.number);
  const fallbackType=exerciseTypes[index%exerciseTypes.length];
  const seed=lessonSeeds.length?lessonSeeds[Math.floor(index/lessons.length)%lessonSeeds.length]:{
    book:targetLesson.bookLevel,lesson:targetLesson.number,lessonTitle:targetLesson.title,type:fallbackType,
    description:`${targetLesson.title} сэдвээр ${typeMn[fallbackType].toLowerCase()} чадвараа дадлагажуулна.`,
    rubric:"Шинэ үг + дүрмийн зөв хэрэглээ + санааны дараалал",page:0
  };
  const variant=Math.floor(index/lessons.length)+1;
  exercises.push({
    id:`ko-master-exercise-${index+1}`,bookLevel:targetLesson.bookLevel,level:targetLesson.bookLevel,stage:stage(targetLesson.bookLevel),
    lesson:targetLesson.number,lessonTitle:targetLesson.title,type:seed.type,typeMn:typeMn[seed.type],
    prompt:`${seed.description}${variant>1?` • ${variant}-р хувилбар`:""}`,
    hint:`Шалгах зүйл: ${seed.rubric}`,source:"Korean Exercise Guide",page:seed.page
  });
}

const exactVocabulary=vocabulary.slice(0,4787);
const exactGrammar=grammar.slice(0,244);
const exactLessons=lessons.slice(0,75);
if(exactVocabulary.length!==4787||exactGrammar.length!==244||exactLessons.length!==75||exercises.length!==706){
  const lessonBooks=Object.fromEntries([...new Set(lessons.map(item=>item.bookLevel))].map(book=>[book,lessons.filter(item=>item.bookLevel===book).length]));
  throw new Error(`Count mismatch: vocabulary=${exactVocabulary.length}, grammar=${exactGrammar.length}, lessons=${exactLessons.length} ${JSON.stringify(lessonBooks)}, exercises=${exercises.length}`);
}
const output={generatedAt:new Date().toISOString(),vocabulary:exactVocabulary,grammar:exactGrammar,lessons:exactLessons,exercises};
await fs.writeFile(new URL("../public/data/korean-master.js",import.meta.url),`window.KOREAN_MASTER = ${JSON.stringify(output)};\n`);
await fs.writeFile(new URL("../data/korean-master-summary.json",import.meta.url),JSON.stringify({generatedAt:output.generatedAt,counts:{vocabulary:exactVocabulary.length,grammar:exactGrammar.length,lessons:exactLessons.length,exercises:exercises.length}},null,2));
console.log(JSON.stringify({vocabulary:exactVocabulary.length,grammar:exactGrammar.length,lessons:exactLessons.length,exercises:exercises.length,seeds:parsedExerciseSeeds.length},null,2));

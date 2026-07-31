import fs from "node:fs";
import vm from "node:vm";

const context={window:{}};
vm.createContext(context);
for(const file of [
  "public/data/lessons.js",
  "public/data/korean-curriculum.js",
  "public/data/korean-master.js",
  "public/data/korean-grammar-explained.js"
]) vm.runInContext(fs.readFileSync(file,"utf8"),context);

const all=[
  ...context.window.KOREAN_MASTER.vocabulary,
  ...context.window.KOREAN_CURRICULUM.vocabulary,
  ...context.window.KOREAN_VOCABULARY
];
const key=(word="")=>word.normalize("NFKC").replace(/[\s·.,!?()[\]{}'"]/g,"").toLowerCase();
const canonical=new Map();
for(const word of all){
  const normalized=key(word.word);
  if(normalized&&!canonical.has(normalized))canonical.set(normalized,word);
}
console.log(JSON.stringify({
  wordsBefore:all.length,
  wordsAfter:canonical.size,
  duplicateWordsRemoved:all.length-canonical.size,
  duplicateWordsRemaining:canonical.size-new Set(canonical.keys()).size,
  grammarRaw:context.window.KOREAN_GRAMMAR_EXPLAINED.rawCount,
  grammarCanonical:context.window.KOREAN_GRAMMAR_EXPLAINED.canonicalCount
},null,2));

import fs from "node:fs/promises";

const books = JSON.parse(await fs.readFile(new URL("../data/pdf-text.json", import.meta.url), "utf8"));

const transliterate = (word) => {
  const replacements = [
    [/tion/g, "шн"], [/sion/g, "жн"], [/ough/g, "оу"], [/ph/g, "ф"], [/th/g, "т"],
    [/sh/g, "ш"], [/ch/g, "ч"], [/ee/g, "ий"], [/oo/g, "үү"], [/ai|ay/g, "эй"],
    [/ou|ow/g, "ау"], [/ck/g, "к"], [/qu/g, "кв"]
  ];
  let value = word.toLowerCase();
  replacements.forEach(([pattern, replacement]) => { value = value.replace(pattern, replacement); });
  const letters = { a:"а",b:"б",c:"к",d:"д",e:"э",f:"ф",g:"г",h:"х",i:"и",j:"ж",k:"к",l:"л",m:"м",n:"н",o:"о",p:"п",q:"к",r:"р",s:"с",t:"т",u:"у",v:"в",w:"в",x:"кс",y:"й",z:"з" };
  return [...value].map((letter) => letters[letter] || letter).join("");
};

const emojiFor = (text) => {
  const rules = [
    [/хоол|идэх|food|eat|cook/i,"🍲"], [/ус|drink|water|rain/i,"💧"], [/гэр|байшин|house|home/i,"🏡"],
    [/машин|car|road|зам/i,"🚗"], [/хүн|person|friend|найз/i,"👭"], [/ажил|work|job/i,"💼"],
    [/ном|write|read|бич|унш/i,"📚"], [/хайр|love|зүрх/i,"💗"], [/мөнгө|buy|market|зах/i,"🛍️"],
    [/ярих|say|speak|call|дуу/i,"💬"], [/харах|see|look|үз/i,"👀"], [/явах|come|go|walk|travel/i,"🚶‍♀️"],
    [/цаг|time|өдөр|day/i,"⏰"], [/сур|learn|study|мэд/i,"🧠"], [/цэцэг|tree|мод|nature/i,"🌸"]
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] || "✨";
};

const verbBook = books.find((book) => book.id === "english-verbs");
const verbText = verbBook.pages.map((page) => page.text).join(" ");
const verbChunks = verbText.split(/(?=\b\d{1,3}\s+[A-Za-z][A-Za-z-]*\s+\/)/).filter((chunk) => /^\d/.test(chunk));
const verbs = verbChunks.map((chunk) => {
  const head = chunk.match(/^(\d+)\s+([A-Za-z][A-Za-z-]*)\s+(\/[^/]+\/)\s+verb\s+([\s\S]+)$/);
  if (!head) return null;
  const [, number, word, pronunciation, rest] = head;
  const sentence = rest.match(/([A-Z][^.!?]{5,220}[.!?])/);
  const translation = (sentence ? rest.slice(0, sentence.index) : rest).trim();
  const memory = sentence ? rest.slice(sentence.index + sentence[0].length).trim() : "";
  return {
    id: `verb-${number}`,
    language: "english",
    level: "A1-B1",
    source: "330 үйл үг",
    word,
    pronunciation,
    translation,
    example: sentence?.[1] || `I want to ${word} today.`,
    memory: memory || `“${transliterate(word)}” гэж дуудаад утгыг нь тод дүрслэн төсөөл.`,
    soundHint: transliterate(word),
    visual: emojiFor(`${translation} ${word}`)
  };
}).filter(Boolean);

const ieltsBook = books.find((book) => book.id === "ielts-4000");
const ieltsText = ieltsBook.pages.map((page) => page.text).join(" ");
const wordMatches = [...ieltsText.matchAll(/(?:^|\s)(\d{1,4})\s+([a-zA-Z][a-zA-Z'-]{1,30})\s+/g)]
  .filter((match) => Number(match[1]) >= 1 && Number(match[1]) <= 4400);
const seen = new Set();
const ielts = [];
for (let index = 0; index < wordMatches.length; index += 1) {
  const match = wordMatches[index];
  const number = Number(match[1]);
  if (seen.has(number)) continue;
  const chunk = ieltsText.slice(match.index + match[0].length, wordMatches[index + 1]?.index || ieltsText.length).trim();
  const firstCyrillic = chunk.search(/[А-ЯӨҮЁа-яөүё]/);
  if (firstCyrillic < 0 || firstCyrillic > 500) continue;
  const definition = chunk.slice(0, firstCyrillic).replace(/\s+(n|v|adj|adv)\.\s*$/i, "").trim();
  const translation = chunk.slice(firstCyrillic).replace(/\s+/g, " ").slice(0, 220).trim();
  if (!translation || definition.length > 420) continue;
  seen.add(number);
  const word = match[2].toLowerCase();
  const soundHint = transliterate(word);
  ielts.push({
    id: `ielts-${number}`,
    language: "english",
    level: number < 1400 ? "IELTS 4-5" : number < 2900 ? "IELTS 5-6" : "IELTS 6-7+",
    source: "IELTS 4000",
    word,
    pronunciation: "",
    translation,
    definition: definition.slice(0, 260),
    example: `The word “${word}” can be used naturally in this context.`,
    memory: `“${soundHint}” гэж дуудаад “${translation.split(/[,;]/)[0]}” гэсэн дүр зургийг хамтад нь төсөөл.`,
    soundHint,
    visual: emojiFor(`${translation} ${word}`)
  });
}

const output = `window.PDF_VOCABULARY = ${JSON.stringify([...verbs, ...ielts])};\n`;
await fs.mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await fs.writeFile(new URL("../public/data/pdf-vocabulary.js", import.meta.url), output);
console.log(`Built ${verbs.length} mnemonic verbs and ${ielts.length} IELTS words.`);

const $ = (selector) => document.querySelector(selector);
const main = $("#appMain");
const storageKey = "khulan-language-progress-v1";
const customKey = "khulan-language-custom-v1";
const mediaKey = "khulan-language-media-v1";
const documentKey = "khulan-language-documents-v1";
const englishWords = window.PDF_VOCABULARY || [];
const koreanCurriculum = window.KOREAN_CURRICULUM || { lessons:[], vocabulary:[], grammar:[], exercises:[] };
const koreanMaster = window.KOREAN_MASTER || { lessons:[], vocabulary:[], grammar:[], exercises:[] };
const koreanExplained = window.KOREAN_GRAMMAR_EXPLAINED || { grammar:[] };
const koreanWordKey = (word = "") => word.normalize("NFKC").replace(/[\s·.,!?()[\]{}'"]/g,"").toLowerCase();
const koreanWordMap = new Map();
for (const word of [...koreanMaster.vocabulary, ...koreanCurriculum.vocabulary, ...(window.KOREAN_VOCABULARY || []), ...(window.KOREAN_LEGAL_VOCABULARY || [])]) {
  const baseKey=koreanWordKey(word.word);
  const key=word.preserveEntry ? `${baseKey}:legal:${word.sourceNumber}` : baseKey;
  if(key&&!koreanWordMap.has(key))koreanWordMap.set(key,word);
}
const koreanWords = [...koreanWordMap.values()];
const baseGrammarRows = window.GRAMMAR_LESSONS || { english: [], korean: [] };
const explainedGrammarRows = koreanExplained.grammar.map((item) => [
  item.id, `${item.stage} ${item.bookLevel}`, item.title, item.role,
  [`${item.exampleKo}|${item.exampleMn}`], `Аль нь ${item.title} дүрмийн зөв хэлбэр вэ?`, item.title,
  [item.title, `${item.title}요`, `${item.title}다`],
  { category:item.category, analogy:item.analogy, structure:item.structure, usage:item.usage, example:item.exampleKo, exampleMn:item.exampleMn, note:item.caution, bookLevel:item.bookLevel, lesson:item.lesson, lessonTitle:item.lessonTitle }
]);
const grammarRows = { english:baseGrammarRows.english || [], korean:explainedGrammarRows };
const motivations = [
  "Өнөөдрийн арван минут маргаашийн өөртөө өгч буй хамгийн сайхан бэлэг.",
  "Алдаа бол ухралт биш, тархи шинэ зам үүсгэж буйн тэмдэг.",
  "Өдөр бүр бага багаар сурахад холын зорилго ойртсоор байдаг.",
  "Чи нэг үг сурсан ч өчигдрийнхөөсөө нэг алхам урагшиллаа.",
  "Төгс хийх гэж хүлээх хэрэггүй. Өнөөдөр эхэлсэн нь ялалт.",
  "Мэдлэг дэлбээлэхэд тогтмол давталт л хэрэгтэй."
];

let progress = JSON.parse(localStorage.getItem(storageKey) || "{}");
let customWords = JSON.parse(localStorage.getItem(customKey) || "[]");
let mediaLibrary = JSON.parse(localStorage.getItem(mediaKey) || '{"videos":[],"songs":[]}');
let documentLibrary = JSON.parse(localStorage.getItem(documentKey) || "[]");
let state = { language: "english", view: "today", studyMode: "flash", currentWord: null, exam: null };
const englishNavMarkup = $("#mainNav").innerHTML;
const koreanStageConfig = [
  { label:"Анхан", stage:"Анхан шат", icon:"sprout", description:"1–2-р түвшний суурь хичээл" },
  { label:"Дунд", stage:"Дунд шат", icon:"layers-3", description:"3–4-р түвшний хэрэглээний хичээл" },
  { label:"Гүнзгий", stage:"Гүнзгий шат", icon:"award", description:"5–6-р түвшний ахисан хичээл" },
];
const hangulFoundationLesson = {
  id: "ko-hangul-foundation",
  level: 1,
  stage: "Анхан шат",
  number: 0,
  title: "한글",
  translation: "Хангылын эхний алхам",
  topic: "Үсэг, зурлага, үе бүтээх, дэвсгэр үсэг, анхны үг ба өгүүлбэр",
  isFoundation: true
};
const topikSectionConfig = [
  { id:"connective", label:"Холбох нөхцөлийн дүрэм", icon:"git-merge", tab:"correct", mode:"connective" },
  { id:"sentence", label:"Өгүүлбэр төгсгөх дүрэм", icon:"text-cursor-input", tab:"correct", mode:"sentence" },
  { id:"similar", label:"Ижил утгатай дүрмийн бүлэг", icon:"git-compare-arrows", tab:"similar" },
  { id:"product", label:"Бүтээгдэхүүний зарын сэдэв", icon:"package-search", tab:"ads", mode:"product" },
  { id:"place", label:"Үйлчилгээний газар, байгууллагын зар", icon:"building-2", tab:"ads", mode:"place" },
  { id:"vocabulary", label:"Давхардал арилгасан Солонгос–Монгол үгийн сан", icon:"languages", tab:"vocabulary" },
  { id:"quiz", label:"Зөв хариу, монгол тайлбартай дасгал", icon:"list-checks", tab:"quiz" },
];
const topikExamSets = [{
  number:102,
  category:"TOPIK I",
  title:"102-р удаагийн TOPIK I түвшин тогтоох шалгалт",
  description:"Анхан түвшний сонсгол, уншлага, сонсголын нэгдсэн материал, зөв хариу болон онооны хүснэгт.",
  audio:{count:31,prefix:"1",base:"/downloads/topik-102-i/audio"},
  files:[
    { title:"Сонсгол ба уншлага", detail:"Түвшин тогтоох шалгалтын материал · 29 хуудас · PDF", icon:"book-open-text", href:"/downloads/topik-102-i/topik-102-i-listening-reading.pdf", size:"9.9 MB" },
    { title:"Сонсголын нэгдсэн материал", detail:"Сонсголын дагалдах нэгдсэн материал · 12 хуудас · PDF", icon:"audio-lines", href:"/downloads/topik-102-i/topik-102-i-listening-integrated.pdf", size:"5.6 MB" },
    { title:"Зөв хариу ба онооны хүснэгт", detail:"Сонсгол, уншлагын хариу ба оноо · 2 хуудас · PDF", icon:"list-checks", href:"/downloads/topik-102-i/topik-102-i-answers-scores.pdf", size:"0.6 MB" },
  ],
},{
  number:102,
  category:"TOPIK II",
  title:"102-р удаагийн TOPIK II шалгалт",
  description:"Сонсгол, бичиг, уншлага, сонсголын нэгдсэн материал, зөв хариу болон онооны хүснэгт.",
  audio:{count:51,prefix:"2",base:"/downloads/topik-102/audio"},
  files:[
    { title:"1-р цаг: Сонсгол ба бичиг", detail:"Асуултын материал · 19 хуудас · PDF", icon:"headphones", href:"/downloads/topik-102/topik-102-listening-writing.pdf", size:"8.2 MB" },
    { title:"2-р цаг: Уншлага", detail:"Уншлагын асуултын материал · 25 хуудас · PDF", icon:"book-open-text", href:"/downloads/topik-102/topik-102-reading.pdf", size:"13.0 MB" },
    { title:"Сонсголын нэгдсэн материал", detail:"Сонсголын дагалдах нэгдсэн материал · 26 хуудас · PDF", icon:"audio-lines", href:"/downloads/topik-102/topik-102-listening-integrated.pdf", size:"13.9 MB" },
    { title:"Зөв хариу ба онооны хүснэгт", detail:"Сонсгол, бичиг, уншлагын хариу ба оноо · 3 хуудас · PDF", icon:"list-checks", href:"/downloads/topik-102/topik-102-answers-scores.pdf", size:"1.6 MB" },
  ],
}];
const topikAudioTracks = (exam) => Array.from({length:exam.audio.count}, (_, index) => {
  const number=String(index).padStart(2,"0");
  return { number, title:`Сонсгол ${number}`, href:`${exam.audio.base}/${exam.audio.prefix}-${number}.mp3` };
});

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const languageName = () => state.language === "english" ? "Англи хэл" : "Солонгос хэл";
const iconRefresh = () => window.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });
const shuffle = (items) => [...items].sort(() => Math.random() - .5);
const grammarFor = () => (grammarRows[state.language] || []).map((row, index) => ({ id:row[0], level:row[1], title:row[2], rule:row[3], examples:row[4], question:row[5], answer:row[6], options:row[7], details:row[8] || null, index:index + 1 }));
const wordsFor = (language = state.language) => [
  ...(language === "english" ? englishWords : koreanWords),
  ...customWords.filter((word) => word.language === language)
];
const wordById = (id) => [...englishWords, ...koreanWords, ...customWords].find((word) => word.id === id);

function saveProgress() { localStorage.setItem(storageKey, JSON.stringify(progress)); }
function toast(message) {
  const box = $("#toast"); box.textContent = message; box.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => box.classList.remove("show"), 2600);
}
function speak(word) {
  if (!("speechSynthesis" in window)) return toast("Энэ төхөөрөмж дуудлага тоглуулах боломжгүй байна.");
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word.word);
  utterance.lang = word.language === "korean" ? "ko-KR" : "en-US";
  utterance.rate = .82; speechSynthesis.speak(utterance);
}
function runPetals() {
  const stage = $("#petalStage"); stage.innerHTML = "";
  for (let index = 0; index < 22; index += 1) {
    const petal = document.createElement("span"); petal.className = "petal";
    petal.style.left = `${Math.random() * 100}%`;
    petal.style.setProperty("--delay", `${Math.random() * .9}s`);
    petal.style.setProperty("--duration", `${2.8 + Math.random() * 2}s`);
    petal.style.setProperty("--drift", `${-80 + Math.random() * 160}px`);
    petal.style.transform = `scale(${.65 + Math.random() * .8})`;
    stage.appendChild(petal);
  }
  setTimeout(() => { stage.innerHTML = ""; }, 5600);
}
function learnedCount(language = state.language) {
  return Object.entries(progress).filter(([id, item]) => wordById(id)?.language === language && item.status === "learned").length;
}
function dueWords() {
  const today = new Date().toISOString().slice(0, 10);
  return wordsFor().filter((word) => progress[word.id]?.due <= today || progress[word.id]?.status === "review");
}
function setView(view) {
  state.view = view;
  if (state.language === "korean") configureLanguageNavigation();
  else $("#mainNav").querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  render(); main.focus(); window.scrollTo({ top: 0, behavior: "smooth" });
}
function configureLanguageNavigation() {
  const nav = $("#mainNav");
  document.documentElement.dataset.language = state.language;
  $("#languageSwitch").querySelectorAll("[data-language]").forEach((button) => {
    const selected = button.dataset.language === state.language;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (state.language === "english") {
    nav.innerHTML = englishNavMarkup;
    nav.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
    return;
  }
  nav.innerHTML = `
    <button type="button" data-view="korean-home"><i data-lucide="home"></i><span>Солонгос</span></button>
    ${koreanStageConfig.map((item) => `<button type="button" data-korean-stage="${item.stage}"><i data-lucide="${item.icon}"></i><span>${item.label}</span></button>`).join("")}
    <button type="button" data-view="korean-topik"><i data-lucide="badge-check"></i><span>TOPIK</span></button>`;
  nav.querySelectorAll("button").forEach((button) => {
    const active = button.dataset.view === state.view || (button.dataset.koreanStage && button.dataset.koreanStage === state.koreanStage);
    button.classList.toggle("active", active);
  });
  iconRefresh();
}
function openKoreanStage(stage) {
  state.koreanStage = stage;
  state.koreanStageContext = stage;
  state.view = "korean-stage";
  configureLanguageNavigation();
  render();
  main.focus();
  window.scrollTo({ top:0, behavior:"smooth" });
}
function koreanBackAction() {
  return state.language === "korean" && state.koreanStageContext
    ? `<button class="secondary" data-back-korean-stage><i data-lucide="arrow-left"></i> ${escapeHtml(state.koreanStageContext)}</button>`
    : "";
}
function pageHead(eyebrow, title, description, action = "") {
  return `<header class="page-head"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${action}</header>`;
}

function renderToday() {
  const total = wordsFor().length;
  const learned = learnedCount();
  const due = dueWords().length;
  const grammarDone = grammarFor().filter((lesson) => progress[`lesson-${lesson.id}`]).length;
  const quote = motivations[new Date().getDate() % motivations.length];
  main.innerHTML = `
    <section class="welcome-band">
      <div class="welcome-copy"><small>ӨНӨӨДРИЙН УРАМ</small><h1>${escapeHtml(quote)}</h1><p>${languageName()} · Өнөөдөр 10 үг, 1 дүрэм давтаад зорилгоо үргэлжлүүлээрэй.</p></div>
      <div class="welcome-art"><img src="app-icon-512.png" alt="Хулан хэл сурах апп"></div>
    </section>
    <section class="stats-grid">
      <article class="stat"><span class="stat-icon"><i data-lucide="library-big"></i></span><div><strong>${total.toLocaleString()}</strong><small>Нийт үгийн сан</small></div></article>
      <article class="stat"><span class="stat-icon"><i data-lucide="circle-check-big"></i></span><div><strong>${learned}</strong><small>Баттай цээжилсэн</small></div></article>
      <article class="stat"><span class="stat-icon"><i data-lucide="rotate-ccw"></i></span><div><strong>${due}</strong><small>Өнөөдөр давтах</small></div></article>
      <article class="stat"><span class="stat-icon"><i data-lucide="book-open-check"></i></span><div><strong>${grammarDone}/${grammarFor().length}</strong><small>Үзсэн дүрэм</small></div></article>
    </section>
    <section class="dashboard-grid">
      <div class="panel">
        <header class="panel-head"><div><h2>Өнөөдрийн хичээл</h2><p>Бага хэмжээтэй, тогтмол давталт</p></div><button class="text-button" data-go="practice">Эхлэх <i data-lucide="arrow-right"></i></button></header>
        <div class="daily-list">
          <article class="daily-task"><span class="task-icon"><i data-lucide="brain"></i></span><div><strong>Ой тогтоолтын 10 үг</strong><small>Дуудлага + Монгол холбоос + дүр зураг</small></div><span class="progress-ring" style="--progress:${Math.min(100, learned % 10 * 10)}%" data-label="${learned % 10}/10"></span></article>
          <article class="daily-task"><span class="task-icon"><i data-lucide="book-open"></i></span><div><strong>Дараагийн дүрэм</strong><small>${escapeHtml(grammarFor()[grammarDone % grammarFor().length]?.title || "Бүх дүрмээ үзсэн")}</small></div><button class="secondary" data-go="grammar">Үзэх</button></article>
          <article class="daily-task"><span class="task-icon"><i data-lucide="clipboard-check"></i></span><div><strong>10 асуулттай шалгалт</strong><small>Үг болон дүрмийг хамтад нь шалгана</small></div><button class="secondary" data-go="exam">Өгөх</button></article>
        </div>
      </div>
      <div class="panel">
        <header class="panel-head"><div><h2>Түргэн эхлэх</h2><p>Сурах аргаа сонго</p></div></header>
        <div class="quick-actions">
          <button data-mode="flash"><i data-lucide="gallery-horizontal-end"></i>Карт</button>
          <button data-mode="choice"><i data-lucide="list-checks"></i>Сонгох</button>
          <button data-mode="sentence"><i data-lucide="text-cursor-input"></i>Өгүүлбэр</button>
          <button data-mode="hunt"><i data-lucide="scan-search"></i>Үг олох</button>
        </div>
      </div>
    </section>`;
  bindCommonActions(); iconRefresh();
}

function renderKoreanHome() {
  const lessonTotal = koreanMaster.lessons.length + koreanCurriculum.lessons.length + 1;
  const grammarTotal = koreanMaster.grammar.length + koreanCurriculum.grammar.length + koreanExplained.grammar.length;
  const exerciseTotal = koreanMaster.exercises.length + koreanCurriculum.exercises.length;
  main.innerHTML = pageHead("KHULAN LANGUAGE · 한국어", "Солонгос хэлний сургалт", "Өөрийн түвшнээ сонгоод дүрэм, шинэ үг, шалгалт, дасгал ажлаа логик дарааллаар судлаарай.") + `
    <section class="korean-summary" aria-label="Солонгос хэлний нийт агуулга">
      <article><strong>${lessonTotal.toLocaleString()}</strong><span>хичээл</span></article>
      <article><strong>${koreanWords.length.toLocaleString()}</strong><span>давхардалгүй үг</span></article>
      <article><strong>${grammarTotal.toLocaleString()}</strong><span>дүрмийн бүртгэл</span></article>
      <article><strong>${exerciseTotal.toLocaleString()}</strong><span>дасгал ажил</span></article>
    </section>
    <section class="korean-path-grid">
      ${koreanStageConfig.map((item, index) => {
        const lessons = koreanMaster.lessons.filter((row) => row.stage === item.stage).length + koreanCurriculum.lessons.filter((row) => row.stage === item.stage).length + (item.stage === "Анхан шат" ? 1 : 0);
        const words = koreanWords.filter((row) => row.stage === item.stage).length;
        const grammar = koreanExplained.grammar.filter((row) => row.stage === item.stage).length;
        const exercises = koreanMaster.exercises.filter((row) => row.stage === item.stage).length + koreanCurriculum.exercises.filter((row) => row.stage === item.stage).length;
        return `<button class="korean-path-card" type="button" data-korean-stage="${item.stage}">
          <span class="path-step">0${index + 1}</span><i data-lucide="${item.icon}"></i><h2>${item.label} шат</h2><p>${item.description}</p>
          <dl><div><dt>Хичээл</dt><dd>${lessons}</dd></div><div><dt>Шинэ үг</dt><dd>${words.toLocaleString()}</dd></div><div><dt>Дүрэм</dt><dd>${grammar}</dd></div><div><dt>Дасгал</dt><dd>${exercises}</dd></div></dl>
          <span class="path-link">Шатаа нээх <i data-lucide="arrow-right"></i></span>
        </button>`;
      }).join("")}
      <button class="korean-path-card topik-path-card" type="button" data-view="korean-topik">
        <span class="path-step">04</span><i data-lucide="badge-check"></i><h2>TOPIK</h2><p>3, 4, 5, 6-р түвшний шалгалтын бэлтгэл</p>
        <dl><div><dt>Түвшин</dt><dd>4</dd></div><div><dt>Үгийн сан</dt><dd>588</dd></div><div><dt>Дасгал</dt><dd>68</dd></div><div><dt>Бүлэг</dt><dd>7</dd></div></dl>
        <span class="path-link">TOPIK нээх <i data-lucide="arrow-right"></i></span>
      </button>
    </section>`;
  main.querySelectorAll("[data-korean-stage]").forEach((button) => button.addEventListener("click", () => openKoreanStage(button.dataset.koreanStage)));
  main.querySelector("[data-view='korean-topik']").addEventListener("click", () => setView("korean-topik"));
  iconRefresh();
}

function renderKoreanStage() {
  const stage = state.koreanStage || "Анхан шат";
  const lessons = koreanMaster.lessons.filter((row) => row.stage === stage).length + koreanCurriculum.lessons.filter((row) => row.stage === stage).length + (stage === "Анхан шат" ? 1 : 0);
  const words = koreanWords.filter((row) => row.stage === stage).length;
  const grammar = koreanExplained.grammar.filter((row) => row.stage === stage).length;
  const exercises = koreanMaster.exercises.filter((row) => row.stage === stage).length + koreanCurriculum.exercises.filter((row) => row.stage === stage).length;
  const sections = [
    ["course","graduation-cap","Хичээлүүд",lessons,"Суурь хичээлээс эхлэн дарааллаар судлах"],
    ["grammar","book-open","Дүрэм",grammar,"Тайлбар, бүтэц, жишээтэй дүрмийн хичээл"],
    ["vocabulary","languages","Шинэ үг",words,"Солонгос–Монгол утга, дуудлагын дасгал"],
    ["exam","clipboard-check","Шалгалт",10,"Тухайн шатны үг ба дүрмийн 10 асуулт"],
    ["exercise","pencil-line","Дасгал ажил",exercises,"Ном, ажлын дэвтрийн бичих ба ярих ажил"],
  ];
  main.innerHTML = pageHead("СОЛОНГОС ХЭЛ · СУРАЛЦАХ ШАТ", stage, `${lessons} хичээлийн агуулгыг Хичээл → Дүрэм → Шинэ үг → Шалгалт → Дасгал ажил гэсэн дарааллаар судална.`, `<button class="secondary" data-view="korean-home"><i data-lucide="arrow-left"></i> Бүх шат</button>`) + `
    <ol class="korean-section-grid">
      ${sections.map(([id,icon,title,count,description], index) => `<li><button type="button" data-korean-section="${id}"><span class="section-order">${index + 1}</span><i data-lucide="${icon}"></i><div><h2>${title}</h2><p>${description}</p><strong>${Number(count).toLocaleString()} ${id === "exam" ? "асуулт" : "агуулга"}</strong></div><i data-lucide="chevron-right"></i></button></li>`).join("")}
    </ol>`;
  main.querySelector("[data-view='korean-home']").addEventListener("click", () => setView("korean-home"));
  main.querySelectorAll("[data-korean-section]").forEach((button) => button.addEventListener("click", () => {
    const section = button.dataset.koreanSection;
    state.koreanStageContext = stage;
    state.courseStage = stage;
    state.exerciseStage = stage;
    state.practiceTab = section === "exercise" ? "course" : state.practiceTab;
    state.exam = null;
    setView(section === "exercise" ? "practice" : section);
  }));
  iconRefresh();
}

function renderTopikLevels() {
  main.innerHTML = pageHead("СОЛОНГОС ХЭЛ · TOPIK II", "TOPIK түвшнээ сонгоно уу", "3–6-р түвшин бүр ижил долоон үндсэн хэсэгтэй.", `<button class="secondary" data-view="korean-home"><i data-lucide="arrow-left"></i> Солонгос хэл</button>`) + `
    <section class="topik-level-grid">
      ${[3,4,5,6].map((level) => `<button type="button" data-topik-level="${level}"><span>TOPIK II</span><strong>${level}</strong><h2>${level}-р түвшин</h2><p>7 хэсэг · 588 үг · 68 дасгал</p><i data-lucide="arrow-up-right"></i></button>`).join("")}
    </section>`;
  main.querySelector("[data-view='korean-home']").addEventListener("click", () => setView("korean-home"));
  main.querySelectorAll("[data-topik-level]").forEach((button) => button.addEventListener("click", () => {
    state.topikLevel = Number(button.dataset.topikLevel);
    state.view = "korean-topik-level";
    render();
  }));
  iconRefresh();
}

function renderTopikLevel() {
  const level = state.topikLevel || 3;
  main.innerHTML = pageHead(`TOPIK II · ${level}-Р ТҮВШИН`, `${level}-р түвшний сургалтын бүтэц`, "Хэсгээ сонгоход одоо байгаа TOPIK сангийн холбогдох бүх материалыг нээнэ.", `<button class="secondary" data-view="korean-topik"><i data-lucide="arrow-left"></i> TOPIK түвшин</button>`) + `
    <section class="topik-section-grid">
      ${topikSectionConfig.map((item, index) => `<button type="button" data-open-topik-section="${item.id}"><span>${String(index + 1).padStart(2,"0")}</span><i data-lucide="${item.icon}"></i><h2>${item.label}</h2><p>Монгол тайлбар, жишээ болон дасгалтай</p><i data-lucide="arrow-right"></i></button>`).join("")}
    </section>
    <button class="ch02-launch" type="button" data-open-topik-ch02>
      <span>ШИНЭ · 02</span><div><h2>Нөхцөл байдал ба түүнд өгөх хариу</h2><p>20 эх хуудас · 45 бүтэцчилсэн дасгал · 60 эрэмбэлсэн сэдэв</p></div><i data-lucide="arrow-right"></i>
    </button>`;
  main.querySelector("[data-view='korean-topik']").addEventListener("click", () => setView("korean-topik"));
  main.querySelector("[data-open-topik-ch02]")?.addEventListener("click", () => {
    state.view = "topik-ch02";
    configureLanguageNavigation();
    window.KhulanTopikChapter2?.open(level);
  });
  main.querySelectorAll("[data-open-topik-section]").forEach((button) => button.addEventListener("click", () => {
    const section = topikSectionConfig.find((item) => item.id === button.dataset.openTopikSection);
    state.view = "topik";
    configureLanguageNavigation();
    window.KhulanTopik?.open(level, section.tab, section.mode);
  }));
  iconRefresh();
}

function renderCourseLibrary() {
  const selectedStage = state.courseStage || "Бүгд";
  const isKorean = state.language === "korean";
  const englishLessons = (baseGrammarRows.english || []).map((row,index) => ({level:row[1],stage:row[1],number:index+1,title:row[2],description:row[3],source:"Англи хэлний хөтөлбөр"}));
  const allLessons = isKorean ? [hangulFoundationLesson, ...koreanMaster.lessons] : englishLessons;
  const lessons = isKorean ? allLessons.filter((item) => selectedStage === "Бүгд" || item.stage === selectedStage) : allLessons;
  const counts = isKorean ? {
    lessons:allLessons.length,
    vocabulary:koreanWords.length,
    grammar:grammarRows.korean.length,
    exercises:koreanCurriculum.exercises.length + koreanMaster.exercises.length
  } : {
    lessons:englishLessons.length,
    vocabulary:englishWords.length,
    grammar:grammarRows.english.length,
    exercises:grammarRows.english.length * 2
  };
  main.innerHTML = pageHead(isKorean ? "СОЛОНГОС ХЭЛНИЙ НЭГДСЭН ХӨТӨЛБӨР" : "АНГЛИ ХЭЛНИЙ НЭГДСЭН ХӨТӨЛБӨР", isKorean ? "1–6-р түвшний Солонгос хичээл" : "Англи хэлний шаталсан хичээл", isKorean ? "Солонгос ном, ажлын дэвтрээс боловсруулсан тусдаа хичээл, үг, дүрэм, дасгалын сан." : "Англи хэлний үг, дүрэм, дасгал Солонгос сангаас бүрэн тусгаарлагдсан.") + `
    <section class="curriculum-stats">
      <article><strong>${counts.lessons}</strong><small>хичээл</small></article>
      <article><strong>${counts.vocabulary.toLocaleString()}</strong><small>шинэ үг</small></article>
      <article><strong>${counts.grammar}</strong><small>дүрмийн хэлбэр</small></article>
      <article><strong>${counts.exercises}</strong><small>дасгал ажил</small></article>
    </section>
    ${isKorean ? `<div class="stage-tabs">${["Бүгд","Анхан шат","Дунд шат","Гүнзгий шат"].map((stage) => `<button class="${stage === selectedStage ? "active" : ""}" data-course-stage="${stage}">${stage}</button>`).join("")}</div>` : ""}
    <section class="course-grid">${lessons.map((lesson) => `<button class="course-card${lesson.isFoundation ? " foundation-course-card" : ""}" type="button" ${isKorean ? `data-open-course="${lesson.id}"` : `data-english-lesson="${lesson.number-1}"`}><span class="course-number">${lesson.isFoundation ? "ЭХЛЭЛ" : `${lesson.level}.${String(lesson.number).padStart(2,"0")}`}</span><h3>${escapeHtml(lesson.title)}</h3><p>${escapeHtml(lesson.translation || lesson.description || lesson.topic || "")}</p><footer><span>${escapeHtml(lesson.stage)}</span><span>Хичээлээ нээх →</span></footer></button>`).join("") || `<div class="empty-state">Энэ түвшний хичээл олдсонгүй.</div>`}</section>`;
  main.querySelectorAll("[data-course-stage]").forEach((button) => button.addEventListener("click", () => { state.courseStage=button.dataset.courseStage;renderCourseLibrary(); }));
  main.querySelectorAll("[data-open-course]").forEach((button) => button.addEventListener("click", () => openCourseLesson(button.dataset.openCourse)));
  main.querySelectorAll("[data-english-lesson]").forEach((button) => button.addEventListener("click", () => openLesson(grammarRows.english[Number(button.dataset.englishLesson)]?.[0])));
  iconRefresh();
}

function openCourseLesson(id) {
  if (id === hangulFoundationLesson.id) {
    $("#lessonLevel").textContent = "Анхан шат • Суурь хичээл";
    $("#lessonTitle").textContent = "한글 — Хангылын эхний алхам";
    $("#lessonBody").innerHTML = `<iframe class="hangul-foundation-frame" src="/lessons/hangul-foundation.html?v=17" title="Хангылын эхний алхам интерактив хичээл"></iframe>`;
    $("#lessonDialog").classList.add("foundation-lesson-dialog");
    $("#lessonDialog").showModal();
    return;
  }
  $("#lessonDialog").classList.remove("foundation-lesson-dialog");
  const lesson=koreanMaster.lessons.find((item)=>item.id===id);if(!lesson)return;
  const words=koreanMaster.vocabulary.filter((item)=>item.bookLevel===lesson.bookLevel&&item.lesson===lesson.number);
  const grammars=koreanExplained.grammar.filter((item)=>item.bookLevel===lesson.bookLevel&&item.lesson===lesson.number);
  const exercises=koreanMaster.exercises.filter((item)=>item.bookLevel===lesson.bookLevel&&item.lesson===lesson.number);
  $("#lessonLevel").textContent=`${lesson.stage} • ${lesson.level}-р түвшин • ${lesson.number}-р хичээл`;
  $("#lessonTitle").textContent=`${lesson.title}${lesson.translation?` — ${lesson.translation}`:""}`;
  $("#lessonBody").innerHTML=`<div class="course-overview"><span class="eyebrow">ХИЧЭЭЛИЙН СЭДЭВ</span><p>${escapeHtml(lesson.topic||lesson.translation||`${lesson.title} сэдвийн хичээл`)}</p>${lesson.scope?`<small><b>Үгийн сангийн хүрээ:</b> ${escapeHtml(lesson.scope)}</small>`:""}</div>
    <div class="lesson-content-tabs"><button class="active" data-course-tab="vocabulary">Шинэ үг <b>${words.length}</b></button><button data-course-tab="grammar">Дүрэм <b>${grammars.length}</b></button><button data-course-tab="exercise">Дасгал <b>${exercises.length}</b></button><button data-course-tab="culture">Соёл ба дараалал</button></div>
    <section class="course-tab-panel active" data-course-panel="vocabulary"><div class="lesson-word-grid">${words.map((word)=>`<article><strong>${escapeHtml(word.word)}</strong><span>${escapeHtml(word.translation)}</span><button type="button" data-speak-course-word="${escapeHtml(word.word)}"><i data-lucide="volume-2"></i></button></article>`).join("")||`<p class="empty-state">Энэ хичээлийн үг удахгүй нэмэгдэнэ.</p>`}</div></section>
    <section class="course-tab-panel" data-course-panel="grammar"><div class="lesson-grammar-list">${grammars.map((item)=>`<button type="button" data-master-grammar="${item.id}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.role)}</span><small>Хэлбэр: ${escapeHtml(item.structure)}</small></button>`).join("")||`<p class="empty-state">Дүрмийн мэдээлэл олдсонгүй.</p>`}</div></section>
    <section class="course-tab-panel" data-course-panel="exercise"><div class="lesson-exercise-list">${exercises.slice(0,20).map((item)=>`<article><span class="eyebrow">${escapeHtml(item.typeMn)}</span><p>${escapeHtml(item.prompt)}</p><textarea placeholder="Хариултаа энд бичнэ үү...">${escapeHtml(localStorage.getItem(`khulan-answer-${item.id}`)||"")}</textarea><button class="secondary" type="button" data-save-inline-exercise="${item.id}"><i data-lucide="save"></i> Хадгалах</button></article>`).join("")||`<p class="empty-state">Дасгалын мэдээлэл олдсонгүй.</p>`}</div></section>
    <section class="course-tab-panel" data-course-panel="culture"><div class="course-overview"><span class="eyebrow">СОЁЛ</span><p>${escapeHtml(lesson.culture||"Энэ сэдвийг Монгол–Солонгосын нөхцөлтэй харьцуулан судална.")}</p><span class="eyebrow">СУРАХ ДАРААЛАЛ</span><p>${escapeHtml(lesson.sequence||"1) Шинэ үг 2) Дүрэм 3) Дасгал 4) Богино бичвэр")}</p></div></section>`;
  $("#lessonDialog").showModal();
  $("#lessonBody").querySelectorAll("[data-course-tab]").forEach((button)=>button.addEventListener("click",()=>{$("#lessonBody").querySelectorAll("[data-course-tab]").forEach(item=>item.classList.toggle("active",item===button));$("#lessonBody").querySelectorAll("[data-course-panel]").forEach(panel=>panel.classList.toggle("active",panel.dataset.coursePanel===button.dataset.courseTab));}));
  $("#lessonBody").querySelectorAll("[data-master-grammar]").forEach((button)=>button.addEventListener("click",()=>openLesson(button.dataset.masterGrammar)));
  $("#lessonBody").querySelectorAll("[data-speak-course-word]").forEach((button)=>button.addEventListener("click",()=>speak({word:button.dataset.speakCourseWord,language:"korean"})));
  $("#lessonBody").querySelectorAll("[data-save-inline-exercise]").forEach((button)=>button.addEventListener("click",()=>{const field=button.closest("article").querySelector("textarea");localStorage.setItem(`khulan-answer-${button.dataset.saveInlineExercise}`,field.value);toast("Хариулт хадгалагдлаа.");}));
  iconRefresh();
}

function renderGrammar() {
  const lessons = grammarFor().filter((lesson) => state.language !== "korean" || !state.koreanStageContext || lesson.level.startsWith(state.koreanStageContext));
  const title = state.language === "korean" && state.koreanStageContext ? `${state.koreanStageContext} · Дүрэм` : "Дүрмийн шаталсан хөтөлбөр";
  main.innerHTML = pageHead(languageName(), title, state.language === "english" ? "Сууриас IELTS түвшин хүртэл дарааллаар сураарай." : "Анхан шатнаас TOPIK түвшин хүртэл дарааллаар сураарай.", koreanBackAction()) + `
    <div class="toolbar"><div class="search-field"><i data-lucide="search"></i><input id="grammarSearch" placeholder="Дүрмийн сэдэв хайх"></div><select id="grammarLevel"><option value="all">Бүх түвшин</option>${[...new Set(lessons.map((lesson) => lesson.level))].map((level) => `<option>${escapeHtml(level)}</option>`).join("")}</select></div>
    <section class="lesson-grid" id="lessonGrid"></section>`;
  const draw = () => {
    const query = $("#grammarSearch").value.toLowerCase(); const level = $("#grammarLevel").value;
    const filtered = lessons.filter((lesson) => (level === "all" || lesson.level === level) && `${lesson.title} ${lesson.rule}`.toLowerCase().includes(query));
    $("#lessonGrid").innerHTML = filtered.map((lesson) => `<button class="lesson-card" type="button" data-lesson="${lesson.id}"><span class="number">${String(lesson.index).padStart(2,"0")}</span><h3>${escapeHtml(lesson.title)}</h3><p>${escapeHtml(lesson.rule)}</p><footer><span>${progress[`lesson-${lesson.id}`] ? "Үзсэн" : escapeHtml(lesson.level)}</span><i data-lucide="arrow-up-right"></i></footer></button>`).join("") || `<div class="empty-state">Илэрц олдсонгүй.</div>`;
    iconRefresh();
  };
  draw(); $("#grammarSearch").addEventListener("input", draw); $("#grammarLevel").addEventListener("change", draw);
  $("#lessonGrid").addEventListener("click", (event) => { const card = event.target.closest("[data-lesson]"); if (card) openLesson(card.dataset.lesson); });
  main.querySelector("[data-back-korean-stage]")?.addEventListener("click", () => openKoreanStage(state.koreanStageContext));
  iconRefresh();
}

function openLesson(id) {
  const lesson = grammarFor().find((item) => item.id === id); if (!lesson) return;
  $("#lessonLevel").textContent = lesson.level; $("#lessonTitle").textContent = lesson.title;
  const details = lesson.details ? `<section class="grammar-detail-grid">
    <article><span class="eyebrow">${escapeHtml(lesson.details.category || "ГОЛ ҮҮРЭГ")}</span><p>${escapeHtml(lesson.rule)}</p></article>
    <article><span class="eyebrow">МОНГОЛ ХЭЛТЭЙ АДИЛТГАЛ</span><p>${escapeHtml(lesson.details.analogy)}</p></article>
    <article><span class="eyebrow">ХЭЛБЭР</span><strong>${escapeHtml(lesson.details.structure)}</strong></article>
    <article><span class="eyebrow">ЯАЖ ХЭРЭГЛЭДЭГ ВЭ?</span><p>${escapeHtml(lesson.details.usage)}</p></article>
    <article><span class="eyebrow">ЖИШЭЭ</span><strong>${escapeHtml(lesson.details.example)}</strong><p>${escapeHtml(lesson.details.exampleMn)}</p></article>
    <article><span class="eyebrow">АНХААРАХ ЗҮЙЛ</span><p>${escapeHtml(lesson.details.note)}</p></article>
  </section>` : `<div class="lesson-rule">${escapeHtml(lesson.rule)}</div><div class="example-list">${lesson.examples.map((item) => { const [example, translation] = item.split("|"); return `<div class="example-item"><strong>${escapeHtml(example)}</strong><small>${escapeHtml(translation)}</small></div>`; }).join("")}</div>`;
  $("#lessonBody").innerHTML = `${details}<div class="exercise-box"><span class="eyebrow">ӨӨРИЙГӨӨ ШАЛГАХ</span><h2>${escapeHtml(lesson.question)}</h2><div class="choices">${shuffle(lesson.options).map((option) => `<button class="choice-button" type="button" data-lesson-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("")}</div></div>`;
  if (!$("#lessonDialog").open) $("#lessonDialog").showModal(); iconRefresh();
  $("#lessonBody").querySelectorAll("[data-lesson-answer]").forEach((button) => button.addEventListener("click", () => {
    const correct = button.dataset.lessonAnswer === lesson.answer; button.classList.add(correct ? "correct" : "wrong");
    if (correct) { progress[`lesson-${lesson.id}`] = true; saveProgress(); toast("Зөв байна. Дүрэм үзсэнд бүртгэгдлээ."); }
    else toast(`Зөв хариулт: ${lesson.answer}`);
  }));
}

function renderVocabulary() {
  const words = wordsFor().filter((word) => state.language !== "korean" || !state.koreanStageContext || word.stage === state.koreanStageContext);
  const pageSize = 80;
  let page = 1;
  const filterValue = (word) => state.language === "korean" ? (word.level || word.stage || "Солонгос хэл") : (word.source || word.level || "Англи хэл");
  const sources = [...new Set(words.map(filterValue).filter(Boolean))];
  const vocabTitle = state.language === "korean" && state.koreanStageContext ? `${state.koreanStageContext} · Шинэ үг` : "Үгийн сан";
  main.innerHTML = pageHead(languageName(), vocabTitle, "PDF номын үгсийг хайж, ой тогтоолтын картаар сураарай.", `${koreanBackAction()}<button class="primary" id="startVisible"><i data-lucide="play"></i> Цээжилж эхлэх</button>`) + `
    <div class="toolbar"><div class="search-field"><i data-lucide="search"></i><input id="wordSearch" placeholder="Үг, Монгол утгаар хайх"></div><select id="sourceFilter"><option value="all">Бүх эх сурвалж</option>${sources.map((source) => `<option>${escapeHtml(source)}</option>`).join("")}</select><button class="secondary" id="addWordInline"><i data-lucide="plus"></i> Үг нэмэх</button></div>
    <p class="word-count" id="wordCount"></p>
    <section class="word-list" id="wordList"></section>
    <nav class="word-pagination" id="wordPagination" aria-label="Үгийн жагсаалтын хуудас"></nav>`;
  let visible = words;
  const draw = () => {
    const query = $("#wordSearch").value.trim().toLowerCase();
    const source = $("#sourceFilter").value;
    visible = words.filter((word) => (source === "all" || filterValue(word) === source) && `${word.word} ${word.translation} ${word.memory || ""}`.toLowerCase().includes(query));
    const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
    page = Math.min(Math.max(page, 1), totalPages);
    const startIndex = (page - 1) * pageSize;
    const pageWords = visible.slice(startIndex, startIndex + pageSize);
    const firstShown = visible.length ? startIndex + 1 : 0;
    const lastShown = startIndex + pageWords.length;
    $("#wordCount").textContent = `${visible.length.toLocaleString()} үг олдлоо · ${firstShown.toLocaleString()}–${lastShown.toLocaleString()}-р үгийг харуулж байна`;
    $("#wordList").innerHTML = pageWords.map((word) => `<button class="word-row" type="button" data-word="${word.id}"><span class="visual">${word.visual || "✨"}</span><span><strong>${escapeHtml(word.word)}</strong><small>${escapeHtml(word.pronunciation || word.soundHint || "")} · ${escapeHtml(word.translation)}</small></span><span class="source">${escapeHtml(filterValue(word))}</span></button>`).join("") || `<div class="empty-state">Үг олдсонгүй.</div>`;
    const pager = $("#wordPagination");
    pager.hidden = totalPages <= 1;
    pager.innerHTML = `
      <button type="button" data-word-page="first" ${page === 1 ? "disabled" : ""}><i data-lucide="chevrons-left"></i><span>Эхний</span></button>
      <button type="button" data-word-page="previous" ${page === 1 ? "disabled" : ""}><i data-lucide="chevron-left"></i><span>Өмнөх</span></button>
      <span class="word-page-status"><strong>${page.toLocaleString()}</strong> / ${totalPages.toLocaleString()} хуудас</span>
      <button type="button" data-word-page="next" ${page === totalPages ? "disabled" : ""}><span>Дараах</span><i data-lucide="chevron-right"></i></button>
      <button type="button" data-word-page="last" ${page === totalPages ? "disabled" : ""}><span>Сүүлийн</span><i data-lucide="chevrons-right"></i></button>`;
    iconRefresh();
  };
  const resetAndDraw = () => { page = 1; draw(); };
  draw();
  $("#wordSearch").addEventListener("input", resetAndDraw);
  $("#sourceFilter").addEventListener("change", resetAndDraw);
  $("#wordPagination").addEventListener("click", (event) => {
    const button = event.target.closest("[data-word-page]");
    if (!button || button.disabled) return;
    const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
    if (button.dataset.wordPage === "first") page = 1;
    if (button.dataset.wordPage === "previous") page -= 1;
    if (button.dataset.wordPage === "next") page += 1;
    if (button.dataset.wordPage === "last") page = totalPages;
    draw();
    $("#wordCount").scrollIntoView({ behavior:"smooth", block:"start" });
  });
  $("#wordList").addEventListener("click", (event) => { const row = event.target.closest("[data-word]"); if (row) startStudy("flash", [wordById(row.dataset.word)]); });
  $("#startVisible").addEventListener("click", () => startStudy("flash", visible));
  $("#addWordInline").addEventListener("click", () => $("#addWordDialog").showModal());
  main.querySelector("[data-back-korean-stage]")?.addEventListener("click", () => openKoreanStage(state.koreanStageContext));
  iconRefresh();
}

function studyPool() {
  const due = dueWords();
  return shuffle(due.length ? due : wordsFor()).slice(0, 30);
}
function startStudy(mode = "flash", pool = null) {
  state.studyMode = mode; state.studyQueue = (pool?.length ? shuffle(pool) : studyPool()); state.studyIndex = 0;
  state.currentWord = state.studyQueue[0]; setView("practice");
}
function markWord(status) {
  const word = state.currentWord; if (!word) return;
  const days = status === "learned" ? 7 : 1; const due = new Date(); due.setDate(due.getDate() + days);
  progress[word.id] = { status, due: due.toISOString().slice(0,10), reviews: (progress[word.id]?.reviews || 0) + 1 };
  saveProgress(); nextStudyWord();
}
function nextStudyWord() {
  state.studyIndex = (state.studyIndex + 1) % state.studyQueue.length; state.currentWord = state.studyQueue[state.studyIndex]; renderPractice();
}
function otherTranslations(word, count = 3) {
  return shuffle(wordsFor().filter((item) => item.id !== word.id && item.translation).map((item) => item.translation)).slice(0, count);
}

function renderPractice() {
  if (state.practiceTab === "course") return renderCourseExercises();
  if (!state.studyQueue?.length) { state.studyQueue = studyPool(); state.studyIndex = 0; state.currentWord = state.studyQueue[0]; }
  const word = state.currentWord;
  if (!word) { main.innerHTML = `<div class="empty-state">Сурах үг олдсонгүй. Миний сан руу үг нэмээрэй.</div>`; return; }
  const side = `<aside class="study-side"><div class="panel"><header class="panel-head"><div><h2>Цээжлэх арга</h2><p>${state.studyIndex + 1}/${state.studyQueue.length} үг</p></div></header><div class="mode-list"><button class="${state.studyMode === "flash" ? "active" : ""}" data-study-mode="flash"><i data-lucide="gallery-horizontal-end"></i>Ой тогтоолтын карт</button><button class="${state.studyMode === "choice" ? "active" : ""}" data-study-mode="choice"><i data-lucide="list-checks"></i>Зөв утга сонгох</button><button class="${state.studyMode === "sentence" ? "active" : ""}" data-study-mode="sentence"><i data-lucide="text-cursor-input"></i>Өгүүлбэр нөхөх</button><button class="${state.studyMode === "hunt" ? "active" : ""}" data-study-mode="hunt"><i data-lucide="scan-search"></i>Олон үгнээс олох</button></div></div></aside>`;
  main.innerHTML = pageHead(languageName(), "Үг цээжлэх", "Дуудлага, дүр зураг, идэвхтэй эргэн санах аргыг хослуулна.") + `<div class="media-tabs"><button class="active">Үг давтах</button><button id="openCourseExercises">Номын дасгал</button></div><section class="study-shell"><div id="studyContent"></div>${side}</section>`;
  renderStudyContent(word);
  $("#openCourseExercises").addEventListener("click", () => { state.practiceTab="course";renderPractice(); });
  main.querySelectorAll("[data-study-mode]").forEach((button) => button.addEventListener("click", () => { state.studyMode = button.dataset.studyMode; renderPractice(); }));
  iconRefresh();
}

function renderCourseExercises() {
  const selectedStage = state.exerciseStage || state.koreanStageContext || "Анхан шат";
  const isKorean = state.language === "korean";
  const englishExercises = grammarRows.english.flatMap((row,index) => [
    {id:`en-course-${index+1}-writing`,stage:row[1],type:"writing",prompt:`“${row[2]}” дүрмийг ашиглан Англиар нэг бүтэн өгүүлбэр бичнэ үү.`,hint:row[3]},
    {id:`en-course-${index+1}-speaking`,stage:row[1],type:"speaking",prompt:`“${row[2]}” дүрмийг ашиглан Англиар богино харилцан яриа зохионо уу.`,hint:row[3]}
  ]);
  const allKoreanExercises=[...koreanCurriculum.exercises,...koreanMaster.exercises];
  const items = isKorean ? allKoreanExercises.filter((item) => item.stage === selectedStage) : englishExercises;
  main.innerHTML = pageHead(isKorean ? "СОЛОНГОС НОМЫН ДАСГАЛ" : "АНГЛИ ХЭЛНИЙ ДАСГАЛ", "Дүрэм, бичих ба ярих дасгал", isKorean ? "Солонгос ажлын дэвтрийн сэдвээс боловсруулсан тусдаа дасгалын сан." : "Зөвхөн Англи хэлний дүрэм, бичих, ярих дасгалууд.") + `
    <div class="media-tabs"><button id="backToWordPractice">${isKorean && state.koreanStageContext ? `${escapeHtml(state.koreanStageContext)} руу буцах` : "Үг давтах"}</button><button class="active">Номын дасгал</button></div>
    ${isKorean ? `<div class="stage-tabs">${["Анхан шат","Дунд шат","Гүнзгий шат"].map((stage) => `<button class="${stage === selectedStage ? "active" : ""}" data-exercise-stage="${stage}">${stage}</button>`).join("")}</div>` : ""}
    <p class="word-count">${items.length} дасгал • Хариулт энэ төхөөрөмжид автоматаар хадгалагдана</p>
    <section class="exercise-list">${items.map((item,index) => `<article class="book-exercise"><header><span class="eyebrow">${escapeHtml(item.stage)} • ${item.type === "speaking" ? "ЯРИХ" : "БИЧИХ"}</span><small>${index + 1}/${items.length}</small></header><h3>${escapeHtml(item.prompt)}</h3><textarea data-course-answer="${item.id}" placeholder="Хариултаа энд бичнэ үү...">${escapeHtml(localStorage.getItem(`khulan-answer-${item.id}`) || "")}</textarea><div class="exercise-footer"><span class="hint">${escapeHtml(item.hint)}</span><button class="secondary" data-save-course-answer="${item.id}"><i data-lucide="save"></i> Хадгалах</button></div></article>`).join("") || `<div class="empty-state">Энэ шатанд дасгал хараахан алга.</div>`}</section>`;
  $("#backToWordPractice").addEventListener("click",()=>{if(isKorean&&state.koreanStageContext){openKoreanStage(state.koreanStageContext);return;}state.practiceTab="words";renderPractice();});
  main.querySelectorAll("[data-exercise-stage]").forEach((button)=>button.addEventListener("click",()=>{state.exerciseStage=button.dataset.exerciseStage;renderCourseExercises();}));
  main.querySelectorAll("[data-save-course-answer]").forEach((button)=>button.addEventListener("click",()=>{const field=main.querySelector(`[data-course-answer="${button.dataset.saveCourseAnswer}"]`);localStorage.setItem(`khulan-answer-${button.dataset.saveCourseAnswer}`,field.value);toast("Дасгалын хариулт хадгалагдлаа.");}));
  iconRefresh();
}

function renderStudyContent(word) {
  const host = $("#studyContent");
  if (state.studyMode === "flash") {
    host.innerHTML = `<article class="flashcard"><div class="flashcard-content"><div class="memory-visual">${word.visual || "✨"}</div><span class="eyebrow">${escapeHtml(word.language === "korean" ? (word.level || word.stage || "Солонгос хэл") : (word.source || word.level || "Англи хэл"))}</span><h1>${escapeHtml(word.word)}</h1>${word.preserveEntry?`<div class="legal-meaning"><small>МОНГОЛ УТГА</small><strong>${escapeHtml(word.translation)}</strong></div>`:""}<div class="pronunciation">${escapeHtml(word.pronunciation || word.soundHint || "")}</div><button class="secondary" id="speakWord"><i data-lucide="volume-2"></i> Дуудлага сонсох</button><div id="revealed" hidden><div class="translation">${escapeHtml(word.translation)}</div><div class="memory-box"><strong>Ой тогтоолтын холбоос</strong><br>${escapeHtml(word.memory || (word.preserveEntry ? `“${word.word}” — ${word.translation}` : `${word.word} үгийг утгатай нь тод дүрслэн төсөөл.`))}</div><div class="example-box"><strong>${escapeHtml(word.example || (word.preserveEntry ? `${word.word} — ${word.translation}` : "Жишээ өгүүлбэр нэмээгүй"))}</strong></div></div><div class="flash-actions" id="flashActions"><button class="primary" id="revealWord"><i data-lucide="eye"></i> Утгыг харах</button></div></div></article>`;
    $("#speakWord").addEventListener("click", () => speak(word));
    $("#revealWord").addEventListener("click", () => { $("#revealed").hidden = false; $("#flashActions").innerHTML = `<button class="secondary" id="reviewWord"><i data-lucide="rotate-ccw"></i> Дахин давтана</button><button class="primary" id="knowWord"><i data-lucide="check"></i> Мэдэж байна</button>`; $("#reviewWord").addEventListener("click", () => markWord("review")); $("#knowWord").addEventListener("click", () => markWord("learned")); iconRefresh(); });
  } else if (state.studyMode === "choice") {
    const options = shuffle([word.translation, ...otherTranslations(word)]);
    host.innerHTML = exerciseTemplate("Зөв Монгол утгыг сонго", word.word, options.map((option) => `<button class="choice-button" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join(""));
    host.querySelectorAll("[data-answer]").forEach((button) => button.addEventListener("click", () => checkChoice(button, button.dataset.answer === word.translation, word.translation)));
  } else if (state.studyMode === "sentence") {
    const example = word.example || `${word.word} is today's word.`;
    const blank = example.replace(new RegExp(escapeRegExp(word.word), "i"), "_______");
    host.innerHTML = `<div class="exercise-box"><span class="eyebrow">ӨГҮҮЛБЭР НӨХӨХ</span><h2>${escapeHtml(blank)}</h2><p>${escapeHtml(word.translation)}</p><form class="answer-input" id="sentenceForm"><input autocomplete="off" placeholder="Зөв үгийг бич"><button class="primary">Шалгах</button></form></div>`;
    $("#sentenceForm").addEventListener("submit", (event) => { event.preventDefault(); const value = event.currentTarget.querySelector("input").value.trim(); if (value.toLowerCase() === word.word.toLowerCase()) { toast("Зөв байна!"); markWord("learned"); } else toast(`Зөв үг: ${word.word}`); });
  } else {
    const options = shuffle([word, ...shuffle(wordsFor().filter((item) => item.id !== word.id)).slice(0,11)]);
    host.innerHTML = `<div class="exercise-box"><span class="eyebrow">ҮГ ОЛОХ</span><h2>“${escapeHtml(word.translation)}” гэсэн үгийг олоорой</h2><div class="word-hunt">${options.map((item) => `<button data-hunt="${item.id}">${escapeHtml(item.word)}</button>`).join("")}</div></div>`;
    host.querySelectorAll("[data-hunt]").forEach((button) => button.addEventListener("click", () => checkChoice(button, button.dataset.hunt === word.id, word.word)));
  }
  iconRefresh();
}
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function exerciseTemplate(label, prompt, choices) { return `<div class="exercise-box"><span class="eyebrow">${label}</span><h2>${escapeHtml(prompt)}</h2><div class="choices">${choices}</div></div>`; }
function checkChoice(button, correct, answer) {
  button.classList.add(correct ? "correct" : "wrong");
  if (correct) { toast("Зөв байна!"); setTimeout(() => markWord("learned"), 450); }
  else toast(`Зөв хариулт: ${answer}`);
}

function renderExam() {
  if (!state.exam) {
    const examTitle = state.language === "korean" && state.koreanStageContext ? `${state.koreanStageContext} · Шалгалт` : "Түвшин тогтоох шалгалт";
    main.innerHTML = pageHead(languageName(), examTitle, "Үг болон дүрмийн 10 асуулт. Хариулт бүрийн дараа дүн хадгалагдана.", koreanBackAction()) + `<div class="score-card"><i data-lucide="clipboard-check" style="width:52px;height:52px;color:var(--rose)"></i><h2>Шалгалтаа эхлэхэд бэлэн үү?</h2><p>5 үг, 5 дүрмийн асуултыг санамсаргүй сонгоно.</p><button class="primary" id="beginExam"><i data-lucide="play"></i> Эхлэх</button></div>`;
    main.querySelector("[data-back-korean-stage]")?.addEventListener("click", () => openKoreanStage(state.koreanStageContext));
    $("#beginExam").addEventListener("click", beginExam); iconRefresh(); return;
  }
  const exam = state.exam;
  if (exam.index >= exam.questions.length) return renderExamResult();
  const question = exam.questions[exam.index];
  main.innerHTML = pageHead(`${exam.index + 1}/10 АСУУЛТ`, "Шалгалт", `Одоогийн оноо: ${exam.score}`) + `<div class="exercise-box"><span class="eyebrow">${question.type === "word" ? "ҮГИЙН САН" : "ДҮРЭМ"}</span><h2>${escapeHtml(question.prompt)}</h2><div class="choices">${question.options.map((option) => `<button class="choice-button" data-exam-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("")}</div></div>`;
  main.querySelectorAll("[data-exam-answer]").forEach((button) => button.addEventListener("click", () => {
    const correct = button.dataset.examAnswer === question.answer; button.classList.add(correct ? "correct" : "wrong"); if (correct) exam.score += 1; else toast(`Зөв хариулт: ${question.answer}`);
    setTimeout(() => { exam.index += 1; renderExam(); }, 550);
  }));
}
function beginExam() {
  const examWords = wordsFor().filter((word) => state.language !== "korean" || !state.koreanStageContext || word.stage === state.koreanStageContext);
  const examGrammar = grammarFor().filter((lesson) => state.language !== "korean" || !state.koreanStageContext || lesson.level.startsWith(state.koreanStageContext));
  const wordQuestions = shuffle(examWords).slice(0,5).map((word) => ({ type:"word", prompt:`“${word.word}” үгийн зөв утгыг сонго.`, answer:word.translation, options:shuffle([word.translation, ...otherTranslations(word)]) }));
  const grammarQuestions = shuffle(examGrammar).slice(0,5).map((lesson) => ({ type:"grammar", prompt:lesson.question, answer:lesson.answer, options:shuffle(lesson.options) }));
  state.exam = { questions:shuffle([...wordQuestions, ...grammarQuestions]), index:0, score:0 }; renderExam();
}
function renderExamResult() {
  const score = state.exam.score; progress.lastExam = { language:state.language, score, date:new Date().toISOString() }; saveProgress();
  main.innerHTML = `<div class="score-card"><span class="eyebrow">ШАЛГАЛТ ДУУСЛАА</span><div class="score">${score}/10</div><h2>${score >= 8 ? "Маш сайн!" : score >= 6 ? "Сайн байна!" : "Дахин нэг давтаад үзье"}</h2><p>Таны дүн ахицын мэдээлэлд хадгалагдлаа.</p><button class="primary" id="retryExam"><i data-lucide="rotate-ccw"></i> Дахин өгөх</button></div>`;
  $("#retryExam").addEventListener("click", () => { state.exam = null; renderExam(); }); iconRefresh();
}

const khulanDb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open("khulan-content-v1", 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files");
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
async function saveKhulanFile(id, file) {
  const db = await khulanDb();
  const transaction = db.transaction("files", "readwrite");
  transaction.objectStore("files").put(file, id);
  return new Promise((resolve) => transaction.oncomplete = resolve);
}
async function loadKhulanFile(id) {
  const db = await khulanDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction("files").objectStore("files").get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function youtubeId(url = "") {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1).split("/")[0];
    if (parsed.hostname.includes("youtube.com")) return parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
  } catch {}
  return "";
}
function renderMedia() {
  const tab = state.mediaTab || "video";
  main.innerHTML = pageHead("СОНСОЖ, ҮЗЭЖ СУРЪЯ", "Видео хичээл ба миний хөгжим", "YouTube хичээлийн холбоосоо хадгалж үзэх, өөрийн эрхтэй дуугаа төхөөрөмждөө суулган интернэтгүй үед сонсоно.") + `
    <div class="media-tabs">
      <button class="${tab === "video" ? "active" : ""}" data-media-tab="video"><i data-lucide="youtube"></i> Видео хичээл</button>
      <button class="${tab === "music" ? "active" : ""}" data-media-tab="music"><i data-lucide="headphones"></i> Офлайн хөгжим</button>
    </div>
    ${tab === "video" ? videoLibraryTemplate() : musicLibraryTemplate()}`;
  main.querySelectorAll("[data-media-tab]").forEach((button) => button.addEventListener("click", () => { state.mediaTab = button.dataset.mediaTab; renderMedia(); }));
  if (tab === "video") bindVideoLibrary(); else bindMusicLibrary();
  iconRefresh();
}
function videoLibraryTemplate() {
  return `<section class="add-media-panel">
    <form class="inline-form" id="videoForm">
      <label>Хичээлийн нэр<input name="title" required placeholder="English conversation — Travel"></label>
      <label>YouTube холбоос<input name="url" type="url" required placeholder="https://www.youtube.com/watch?v=..."></label>
      <button class="primary" type="submit"><i data-lucide="plus"></i> Хадгалах</button>
    </form>
  </section>
  <section class="media-grid">${mediaLibrary.videos.map((video) => {
    const id = youtubeId(video.url);
    return `<article class="media-card">
      <button class="video-thumb" data-watch-id="${escapeHtml(id)}" data-watch-title="${escapeHtml(video.title)}" type="button" aria-label="${escapeHtml(video.title)} видеог апп дотор үзэх">${id ? `<img src="https://i.ytimg.com/vi/${escapeHtml(id)}/hqdefault.jpg" alt="">` : ""}<span class="play-badge"><i data-lucide="play"></i></span></button>
      <div class="media-card-body"><h3>${escapeHtml(video.title)}</h3><p>YouTube дээрх видео хичээл • ${escapeHtml(video.language || languageName())}</p>
      <div class="media-actions"><button class="primary" data-watch-id="${escapeHtml(id)}" data-watch-title="${escapeHtml(video.title)}"><i data-lucide="play"></i> Апп дотор үзэх</button><button class="secondary" data-delete-video="${video.id}"><i data-lucide="trash-2"></i></button></div></div>
    </article>`;
  }).join("") || `<div class="empty-state">Видео хичээл нэмээгүй байна.</div>`}</section>`;
}
function bindVideoLibrary() {
  $("#videoForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!youtubeId(data.url)) return toast("Зөв YouTube холбоос оруулна уу.");
    mediaLibrary.videos.unshift({ id:`video-${Date.now()}`, title:data.title.trim(), url:data.url.trim(), language:languageName() });
    localStorage.setItem(mediaKey, JSON.stringify(mediaLibrary)); renderMedia(); toast("Видео хичээл хадгалагдлаа.");
  });
  main.querySelectorAll("[data-watch-id]").forEach((button) => button.addEventListener("click", () => openVideoPlayer(button.dataset.watchId, button.dataset.watchTitle)));
  main.querySelectorAll("[data-delete-video]").forEach((button) => button.addEventListener("click", () => {
    mediaLibrary.videos = mediaLibrary.videos.filter((item) => item.id !== button.dataset.deleteVideo);
    localStorage.setItem(mediaKey, JSON.stringify(mediaLibrary)); renderMedia();
  }));
}
function openVideoPlayer(id, title) {
  if (!id) return toast("Видео ID олдсонгүй.");
  $("#videoPlayerTitle").textContent = title || "Видео хичээл";
  $("#youtubePlayer").src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1`;
  $("#videoPlayerDialog").showModal();
}
function closeVideoPlayer() {
  $("#youtubePlayer").src = "";
  $("#videoPlayerDialog").close();
}
$("#closeVideoPlayer").addEventListener("click", closeVideoPlayer);
$("#videoPlayerDialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeVideoPlayer(); });
function musicLibraryTemplate() {
  return `<section class="add-media-panel"><div class="inline-form"><label>Энэ төхөөрөмжид дуу суулгах<small>MP3, M4A, OGG • зөвхөн өөрийн болон ашиглах эрхтэй файл</small></label><span></span><button class="primary" id="pickMusic"><i data-lucide="download"></i> Дуу сонгох</button></div></section>
  <section class="song-list">${mediaLibrary.songs.map((song) => `<article class="song-row"><span class="song-art"><i data-lucide="music-2"></i></span><div><strong>${escapeHtml(song.title)}</strong><small>${escapeHtml(song.artist || "Миний офлайн сан")} • Энэ төхөөрөмжид хадгалсан</small></div><button class="secondary" data-play-song="${song.id}"><i data-lucide="play"></i></button><button class="icon-button light" data-delete-song="${song.id}"><i data-lucide="trash-2"></i></button></article>`).join("") || `<div class="empty-state">Офлайн дуу хараахан алга.</div>`}</section>`;
}
function bindMusicLibrary() {
  $("#pickMusic").addEventListener("click", () => $("#musicFilePicker").click());
  main.querySelectorAll("[data-play-song]").forEach((button) => button.addEventListener("click", () => playSavedSong(button.dataset.playSong)));
  main.querySelectorAll("[data-delete-song]").forEach((button) => button.addEventListener("click", () => {
    mediaLibrary.songs = mediaLibrary.songs.filter((item) => item.id !== button.dataset.deleteSong);
    localStorage.setItem(mediaKey, JSON.stringify(mediaLibrary)); renderMedia();
  }));
}
$("#musicFilePicker").addEventListener("change", async (event) => {
  const file = event.target.files[0]; if (!file) return;
  const id = `song-${Date.now()}`; await saveKhulanFile(id, file);
  mediaLibrary.songs.unshift({ id, title:file.name.replace(/\.[^.]+$/, ""), artist:"Миний офлайн сан", type:file.type });
  localStorage.setItem(mediaKey, JSON.stringify(mediaLibrary)); event.target.value = ""; if (state.view === "media") renderMedia(); toast("Дуу офлайн санд суулгагдлаа.");
});
async function playSavedSong(id) {
  const song = mediaLibrary.songs.find((item) => item.id === id); const file = await loadKhulanFile(id);
  if (!song || !file) return toast("Аудио файл олдсонгүй.");
  const audio = $("#mediaAudio"); if (audio.src) URL.revokeObjectURL(audio.src);
  audio.src = URL.createObjectURL(file); $("#miniTitle").textContent = song.title; $("#miniArtist").textContent = song.artist;
  $("#miniPlayer").hidden = false; await audio.play(); $("#miniPlay").innerHTML = `<i data-lucide="pause"></i>`; iconRefresh();
}
$("#miniPlay").addEventListener("click", () => {
  const audio = $("#mediaAudio"); if (!audio.src) return;
  if (audio.paused) audio.play(); else audio.pause();
  $("#miniPlay").innerHTML = `<i data-lucide="${audio.paused ? "play" : "pause"}"></i>`; iconRefresh();
});
$("#mediaAudio").addEventListener("timeupdate", () => { const audio=$("#mediaAudio"); $("#miniSeek").value=audio.duration ? audio.currentTime/audio.duration*100 : 0; });
$("#miniSeek").addEventListener("input", () => { const audio=$("#mediaAudio"); if(audio.duration) audio.currentTime=$("#miniSeek").value/100*audio.duration; });

function renderResearch() {
  main.innerHTML = pageHead("ДИЖИТАЛ УНШЛАГЫН ТАНХИМ", "Судалгаа, ном ба тэмдэглэл", "PDF эрдэм шинжилгээний ажил, ном товхимлоо уншаад Apple Pencil, S Pen эсвэл хуруугаараа дээр нь тэмдэглэнэ.", `<button class="primary" id="pickDocument"><i data-lucide="file-plus-2"></i> PDF нэмэх</button>`) + `
    <section class="research-layout">
      <aside class="document-shelf"><strong>Миний уншлагын сан</strong><div class="document-list">${documentLibrary.map((doc) => `<button class="document-item ${state.documentId === doc.id ? "active" : ""}" data-document="${doc.id}"><span class="doc-icon"><i data-lucide="file-text"></i></span><span><strong>${escapeHtml(doc.title)}</strong><small>${escapeHtml(doc.topic || "Судалгааны материал")}</small></span></button>`).join("") || `<div class="empty-state">PDF файл нэмнэ үү.</div>`}</div></aside>
      <article class="reader-panel"><div class="reader-toolbar"><button class="secondary" id="penToggle"><i data-lucide="pen-tool"></i> Үзгээр бичих</button><input class="color-dot" id="penColor" type="color" value="#c93f69" title="Үзгийн өнгө"><select id="penSize"><option value="2">Нарийн</option><option value="4" selected>Дунд</option><option value="8">Тодруулагч</option></select><span class="spacer"></span><button class="secondary" id="undoInk"><i data-lucide="undo-2"></i> Буцаах</button><button class="secondary" id="clearInk"><i data-lucide="eraser"></i> Арилгах</button><button class="primary" id="saveInk"><i data-lucide="save"></i> Тэмдэглэл хадгалах</button></div>
      <div class="reader-stage" id="readerStage"><div class="reader-empty"><i data-lucide="book-open"></i><p>Зүүн талаас материал сонгоно уу.</p></div><canvas id="annotationCanvas"></canvas></div></article>
    </section>`;
  $("#pickDocument").addEventListener("click", () => $("#documentFilePicker").click());
  main.querySelectorAll("[data-document]").forEach((button) => button.addEventListener("click", () => { state.documentId=button.dataset.document; renderResearch(); }));
  setupResearchReader(); iconRefresh();
}
$("#documentFilePicker").addEventListener("change", async (event) => {
  const file=event.target.files[0]; if(!file) return;
  const id=`doc-${Date.now()}`; await saveKhulanFile(id,file);
  documentLibrary.unshift({id,title:file.name.replace(/\.pdf$/i,""),topic:"PDF материал",date:new Date().toISOString()});
  localStorage.setItem(documentKey,JSON.stringify(documentLibrary));state.documentId=id;event.target.value="";renderResearch();toast("PDF уншлагын санд нэмэгдлээ.");
});
async function setupResearchReader() {
  const canvas=$("#annotationCanvas"),stage=$("#readerStage"); let drawing=false, penMode=false, strokes=[], active=null;
  const resize=()=>{const ratio=devicePixelRatio||1;canvas.width=stage.clientWidth*ratio;canvas.height=stage.clientHeight*ratio;draw();};
  const draw=()=>{const ctx=canvas.getContext("2d"),ratio=devicePixelRatio||1;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.scale(ratio,ratio);ctx.lineCap="round";ctx.lineJoin="round";for(const stroke of strokes){ctx.strokeStyle=stroke.color;ctx.lineWidth=stroke.size;ctx.globalAlpha=stroke.size>=8?.35:1;ctx.beginPath();stroke.points.forEach((p,i)=>i?ctx.lineTo(p.x*stage.clientWidth,p.y*stage.clientHeight):ctx.moveTo(p.x*stage.clientWidth,p.y*stage.clientHeight));ctx.stroke();}ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;};
  if(state.documentId){const file=await loadKhulanFile(state.documentId);if(file){const empty=$(".reader-empty");empty?.remove();const frame=document.createElement("iframe");frame.title="PDF уншигч";frame.src=URL.createObjectURL(file);stage.prepend(frame);strokes=JSON.parse(localStorage.getItem(`khulan-ink-${state.documentId}`)||"[]");}}
  resize(); new ResizeObserver(resize).observe(stage);
  const point=(event)=>{const r=canvas.getBoundingClientRect();return{x:(event.clientX-r.left)/r.width,y:(event.clientY-r.top)/r.height};};
  canvas.addEventListener("pointerdown",(event)=>{if(!penMode)return;drawing=true;canvas.setPointerCapture(event.pointerId);active={color:$("#penColor").value,size:Number($("#penSize").value),points:[point(event)]};strokes.push(active);});
  canvas.addEventListener("pointermove",(event)=>{if(!drawing||!active)return;active.points.push(point(event));draw();});
  canvas.addEventListener("pointerup",()=>{drawing=false;active=null;});
  const toggle=()=>{penMode=!penMode;canvas.style.pointerEvents=penMode?"auto":"none";$("#penToggle").classList.toggle("primary",penMode);$("#penToggle").classList.toggle("secondary",!penMode);toast(penMode?"Үзгийн горим асаалаа.":"Унших, гүйлгэх горим.");};
  canvas.style.pointerEvents="none";$("#penToggle").addEventListener("click",toggle);
  $("#undoInk").addEventListener("click",()=>{strokes.pop();draw();});$("#clearInk").addEventListener("click",()=>{strokes=[];draw();});
  $("#saveInk").addEventListener("click",()=>{if(!state.documentId)return toast("Эхлээд PDF сонгоно уу.");localStorage.setItem(`khulan-ink-${state.documentId}`,JSON.stringify(strokes));toast("Тэмдэглэл энэ төхөөрөмжид хадгалагдлаа.");});
}

const topikReader = { pdf:null, href:"", page:1, strokes:[], drawing:false, active:null, pen:false, renderTask:null };
const topikInkKey = () => `khulan-topik-ink:${topikReader.href}:${topikReader.page}`;
function saveTopikInk(silent=true) {
  if(!topikReader.href)return;
  localStorage.setItem(topikInkKey(),JSON.stringify(topikReader.strokes));
  if(!silent)toast("Энэ хуудасны тэмдэглэл төхөөрөмжид хадгалагдлаа.");
}
function drawTopikInk() {
  const canvas=$("#topikInkCanvas"),ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);ctx.lineCap="round";ctx.lineJoin="round";
  for(const stroke of topikReader.strokes){ctx.strokeStyle=stroke.color;ctx.lineWidth=stroke.size*(canvas.width/900);ctx.globalAlpha=stroke.size>=9?.3:1;ctx.beginPath();stroke.points.forEach((point,index)=>index?ctx.lineTo(point.x*canvas.width,point.y*canvas.height):ctx.moveTo(point.x*canvas.width,point.y*canvas.height));ctx.stroke();}ctx.globalAlpha=1;
}
async function renderTopikPdfPage() {
  if(!topikReader.pdf)return;const page=await topikReader.pdf.getPage(topikReader.page),stage=$("#topikReaderStage"),canvas=$("#topikPdfCanvas"),ink=$("#topikInkCanvas");
  const initial=page.getViewport({scale:1}),scale=Math.min(2,Math.max(.5,(stage.clientWidth-20)/initial.width)),viewport=page.getViewport({scale});
  canvas.width=viewport.width;canvas.height=viewport.height;ink.width=viewport.width;ink.height=viewport.height;canvas.style.width=ink.style.width=`${viewport.width}px`;canvas.style.height=ink.style.height=`${viewport.height}px`;
  topikReader.strokes=JSON.parse(localStorage.getItem(topikInkKey())||"[]");
  if(topikReader.renderTask)try{topikReader.renderTask.cancel();}catch{}
  topikReader.renderTask=page.render({canvasContext:canvas.getContext("2d"),viewport});await topikReader.renderTask.promise;topikReader.renderTask=null;drawTopikInk();
  $("#topikPageStatus").textContent=`${topikReader.page} / ${topikReader.pdf.numPages}`;$("#topikPrevPage").disabled=topikReader.page===1;$("#topikNextPage").disabled=topikReader.page===topikReader.pdf.numPages;$("#topikReaderLoading").hidden=true;
}
async function openTopikPdf(href,title) {
  const dialog=$("#topikReaderDialog");$("#topikReaderTitle").textContent=title;$("#topikReaderLoading").hidden=false;dialog.showModal();
  const pdfjs=await import("/vendor/pdf.min.mjs");pdfjs.GlobalWorkerOptions.workerSrc="/vendor/pdf.worker.min.mjs";topikReader.href=href;topikReader.page=1;topikReader.pen=false;$("#topikInkCanvas").style.pointerEvents="none";$("#topikPenToggle").classList.remove("primary");topikReader.pdf=await pdfjs.getDocument(href).promise;await renderTopikPdfPage();iconRefresh();
}
async function changeTopikPage(delta){if(!topikReader.pdf)return;saveTopikInk();topikReader.page=Math.min(topikReader.pdf.numPages,Math.max(1,topikReader.page+delta));$("#topikReaderLoading").hidden=false;await renderTopikPdfPage();}

function renderTopikExams() {
  main.innerHTML = pageHead("TOPIK · ДАСГАЛЫН САН", "TOPIK дасгал ажлууд", "TOPIK I болон TOPIK II шалгалтын материалыг тус тусад нь нээж, сонсож, тэмдэглэж бэлтгэл хийнэ.") + `
    <section class="topik-download-list">${topikExamSets.map((exam) => {const tracks=topikAudioTracks(exam);return `<article class="topik-download-set" data-audio-set="${exam.category}">
      <header><span class="exam-number">${exam.number}</span><div><span class="eyebrow">${exam.category}</span><h2>${escapeHtml(exam.title)}</h2><p>${escapeHtml(exam.description)}</p></div></header>
      <div class="topik-download-grid">${exam.files.map((file) => `<article class="topik-download-card"><span class="download-icon"><i data-lucide="${file.icon}"></i></span><div><h3>${escapeHtml(file.title)}</h3><p>${escapeHtml(file.detail)}</p><small>${escapeHtml(file.size)}</small></div><div class="topik-file-actions"><button class="secondary" type="button" data-open-topik-pdf="${file.href}" data-pdf-title="${escapeHtml(file.title)}"><i data-lucide="file-pen-line"></i> Нээж бичих</button><a class="primary" href="${file.href}" download><i data-lucide="download"></i> Татах</a></div></article>`).join("")}</div>
      <section class="topik-audio-library"><header><div><span class="eyebrow">СОНСГОЛЫН ФАЙЛ</span><h2>102-р ${exam.category} · ${tracks.length} аудио</h2></div><select data-topik-audio-select>${tracks.map((track)=>`<option value="${track.href}">${track.title}</option>`).join("")}</select></header><audio data-topik-audio-player controls preload="metadata" src="${tracks[0].href}"></audio><div class="audio-track-buttons">${tracks.map((track)=>`<button type="button" data-topik-audio="${track.href}">${track.number}</button>`).join("")}</div></section>
    </article>`}).join("")}</section>`;
  main.querySelectorAll("[data-open-topik-pdf]").forEach((button)=>button.addEventListener("click",()=>openTopikPdf(button.dataset.openTopikPdf,button.dataset.pdfTitle)));
  main.querySelectorAll("[data-audio-set]").forEach((set)=>{const audio=set.querySelector("[data-topik-audio-player]"),select=set.querySelector("[data-topik-audio-select]");const chooseAudio=(href,play=false)=>{audio.src=href;select.value=href;set.querySelectorAll("[data-topik-audio]").forEach((button)=>button.classList.toggle("active",button.dataset.topikAudio===href));if(play)audio.play();};select.addEventListener("change",()=>chooseAudio(select.value,true));set.querySelectorAll("[data-topik-audio]").forEach((button)=>button.addEventListener("click",()=>chooseAudio(button.dataset.topikAudio,true)));chooseAudio(select.value);});
  iconRefresh();
}

function renderWritingExam() {
  const topics = state.language === "korean" ? ["나의 꿈과 미래", "기술이 교육에 미치는 영향", "내가 좋아하는 도시"] : ["The role of technology in education", "A place that changed my perspective", "Should homework be optional?"];
  const topic = state.writingTopic || topics[0]; state.writingTopic=topic;
  main.innerHTML = pageHead("AI БИЧГИЙН ШАЛГАЛТ", "Сэдвийн дагуу бичиж, шууд үнэлүүлэх", "Гар утсаар шивэх эсвэл таблетны үзгээр бичнэ. AI нь дүрэм, үгийн сан, бүтэц, сэдэвт нийцлийг тус бүрээр үнэлнэ.") + `
    <div class="toolbar"><select id="writingTopic">${topics.map(item=>`<option ${item===topic?"selected":""}>${escapeHtml(item)}</option>`).join("")}</select><span class="word-count">Зорилго: 120–250 үг</span></div>
    <section class="essay-shell"><article class="essay-editor"><div class="topic-box"><span class="eyebrow">СЭДЭВ</span><h3>${escapeHtml(topic)}</h3><p>Өөрийн байр суурийг жишээ, тайлбартайгаар илэрхийлнэ үү.</p></div>
      <div class="media-tabs"><button class="active" data-answer-mode="type">Гараар шивэх</button><button data-answer-mode="pen">Үзгээр бичих</button></div>
      <div id="typedAnswer"><textarea id="essayText" spellcheck="true" placeholder="${state.language === "korean" ? "여기에 답을 쓰세요..." : "Write your answer here..."}"></textarea><p class="word-count" id="essayWords">0 үг</p></div>
      <div id="penAnswer" hidden><div class="writing-tools"><input class="color-dot" id="examPenColor" type="color" value="#332633"><select id="examPenSize"><option value="2">Нарийн</option><option value="4" selected>Дунд</option><option value="7">Өргөн</option></select><button class="secondary" id="clearExamInk"><i data-lucide="eraser"></i> Цэвэрлэх</button></div><div class="writing-pad"><canvas id="examCanvas"></canvas></div><p class="word-count">Гар бичмэлийг AI зурагнаас уншиж үнэлнэ.</p></div>
      <button class="primary full" id="gradeWriting"><i data-lucide="sparkles"></i> AI-аар шалгуулж, дүн авах</button>
    </article><aside class="essay-result" id="writingResult"><div class="empty-state"><i data-lucide="bot"></i><h3>AI үнэлгээ</h3><p>Хариултаа бичээд шалгуулах товчийг дарна уу.</p></div></aside></section>`;
  $("#writingTopic").addEventListener("change",(event)=>{state.writingTopic=event.target.value;renderWritingExam();});
  $("#essayText").addEventListener("input",(event)=>$("#essayWords").textContent=`${event.target.value.trim().split(/\s+/).filter(Boolean).length} үг`);
  main.querySelectorAll("[data-answer-mode]").forEach(button=>button.addEventListener("click",()=>{main.querySelectorAll("[data-answer-mode]").forEach(item=>item.classList.toggle("active",item===button));$("#typedAnswer").hidden=button.dataset.answerMode!=="type";$("#penAnswer").hidden=button.dataset.answerMode!=="pen";}));
  setupExamCanvas();$("#gradeWriting").addEventListener("click",gradeWriting);iconRefresh();
}
function setupExamCanvas(){
  const canvas=$("#examCanvas"),host=canvas.parentElement,ctx=canvas.getContext("2d");let drawing=false;
  const resize=()=>{const old=canvas.width?canvas.toDataURL():null,ratio=devicePixelRatio||1;canvas.width=host.clientWidth*ratio;canvas.height=host.clientHeight*ratio;ctx.scale(ratio,ratio);ctx.lineCap="round";if(old){const image=new Image();image.onload=()=>ctx.drawImage(image,0,0,host.clientWidth,host.clientHeight);image.src=old;}};
  resize();new ResizeObserver(resize).observe(host);
  const point=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  canvas.addEventListener("pointerdown",e=>{drawing=true;canvas.setPointerCapture(e.pointerId);const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);});
  canvas.addEventListener("pointermove",e=>{if(!drawing)return;const p=point(e);ctx.strokeStyle=$("#examPenColor").value;ctx.lineWidth=Number($("#examPenSize").value);ctx.lineTo(p.x,p.y);ctx.stroke();});canvas.addEventListener("pointerup",()=>drawing=false);
  $("#clearExamInk").addEventListener("click",()=>ctx.clearRect(0,0,canvas.width,canvas.height));
}
function localWritingGrade(text) {
  const words=text.trim().split(/\s+/).filter(Boolean),sentences=text.split(/[.!?。！？]+/).filter(part=>part.trim()),unique=new Set(words.map(word=>word.toLowerCase().replace(/[^\p{L}]/gu,""))).size;
  const lengthScore=Math.min(25,Math.round(words.length/120*25)),structure=Math.min(25,8+sentences.length*2),vocabulary=Math.min(25,Math.round(unique/Math.max(words.length,1)*30)),grammar=Math.min(25,10+sentences.filter(s=>s.trim().split(/\s+/).length>=5).length*2);
  return{total:Math.min(100,lengthScore+structure+vocabulary+grammar),grammar,vocabulary,structure,relevance:lengthScore,feedbackMn:words.length<80?"Хариултаа дэлгэрүүлж, баримт эсвэл жишээ нэмээрэй. Сэдэв бүрт эхлэл, гол санаа, дүгнэлт гэсэн бүтэц ашиглавал оноо өснө.":"Санаа ойлгомжтой байна. Холбох үг, олон төрлийн өгүүлбэр болон тодорхой жишээ нэмбэл илүү хүчтэй болно.",corrections:[],local:true};
}
async function gradeWriting(){
  const button=$("#gradeWriting"),text=$("#essayText").value.trim(),canvas=$("#examCanvas"),handwriting=canvas&&!$("#penAnswer").hidden?canvas.toDataURL("image/png"):null;
  if(!text&&!handwriting)return toast("Шивсэн эсвэл үзгээр бичсэн хариулт оруулна уу.");
  button.disabled=true;button.textContent="AI шалгаж байна…";
  let result;
  try{const response=await fetch("/api/grade-essay",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:state.writingTopic,essay:text,language:state.language,handwriting})});if(!response.ok)throw new Error();result=await response.json();}
  catch{result=localWritingGrade(text);if(handwriting&&!text)result={total:0,grammar:0,vocabulary:0,structure:0,relevance:0,feedbackMn:"Гар бичмэлийг автоматаар уншихын тулд серверт OPENAI_API_KEY тохируулна уу. Зураг амжилттай бэлтгэгдсэн.",corrections:[],local:true};}
  $("#writingResult").innerHTML=`<span class="eyebrow">${result.local?"ЛОКАЛ RUBRIC ҮНЭЛГЭЭ":"AI ҮНЭЛГЭЭ"}</span><div class="score-orb">${Math.round(result.total)}/100</div><div class="rubric-list">${[["Дүрэм",result.grammar],["Үгийн сан",result.vocabulary],["Бүтэц",result.structure],["Сэдэвт нийцэл",result.relevance]].map(([name,score])=>`<div class="rubric-row"><span>${name}</span><b>${Math.round(score)}/25</b></div>`).join("")}</div><div class="feedback-box"><strong>Санал зөвлөмж</strong><p>${escapeHtml(result.feedbackMn)}</p>${result.corrections?.length?`<ul>${result.corrections.map(item=>`<li>${escapeHtml(item)}</li>`).join("")}</ul>`:""}</div>`;
  progress.lastWritingExam={topic:state.writingTopic,score:result.total,date:new Date().toISOString()};saveProgress();button.disabled=false;button.innerHTML=`<i data-lucide="sparkles"></i> Дахин шалгуулах`;iconRefresh();
}

function renderMyWords() {
  const mine = customWords.filter((word) => word.language === state.language);
  main.innerHTML = pageHead(languageName(), "Миний үгийн сан", "Өөрийн хэрэгцээтэй үгийг нэмээд бусад дасгал, шалгалтад ашиглана.", `<button class="primary" id="addMine"><i data-lucide="plus"></i> Шинэ үг</button>`) + `<section class="word-list">${mine.map((word) => `<article class="word-row"><span class="visual">${word.visual || "🌸"}</span><span><strong>${escapeHtml(word.word)}</strong><small>${escapeHtml(word.pronunciation)} · ${escapeHtml(word.translation)}</small></span><button class="icon-button light" data-delete-word="${word.id}" title="Устгах"><i data-lucide="trash-2"></i></button></article>`).join("") || `<div class="empty-state"><p>Одоогоор өөрийн үг нэмээгүй байна.</p></div>`}</section>`;
  $("#addMine").addEventListener("click", () => $("#addWordDialog").showModal());
  main.querySelectorAll("[data-delete-word]").forEach((button) => button.addEventListener("click", () => { customWords = customWords.filter((word) => word.id !== button.dataset.deleteWord); localStorage.setItem(customKey, JSON.stringify(customWords)); renderMyWords(); })); iconRefresh();
}

function bindCommonActions() {
  main.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.go)));
  main.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => startStudy(button.dataset.mode)));
}
function render() {
  if (state.view === "today") renderToday();
  else if (state.view === "korean-home") renderKoreanHome();
  else if (state.view === "korean-stage") renderKoreanStage();
  else if (state.view === "korean-topik") renderTopikLevels();
  else if (state.view === "korean-topik-level") renderTopikLevel();
  else if (state.view === "grammar") renderGrammar();
  else if (state.view === "course") renderCourseLibrary();
  else if (state.view === "topik") window.KhulanTopik?.render();
  else if (state.view === "topik-ch02") window.KhulanTopikChapter2?.open(state.topikLevel || 3);
  else if (state.view === "vocabulary") renderVocabulary();
  else if (state.view === "practice") renderPractice();
  else if (state.view === "exam") renderExam();
  else if (state.view === "writing") renderWritingExam();
  else if (state.view === "media") renderMedia();
  else if (state.view === "topik-exams") renderTopikExams();
  else renderMyWords();
}

$("#mainNav").addEventListener("click", (event) => {
  const stageButton = event.target.closest("[data-korean-stage]");
  if (stageButton) { openKoreanStage(stageButton.dataset.koreanStage); return; }
  const button = event.target.closest("[data-view]");
  if (button) { if (button.dataset.view !== "exam") state.exam = null; setView(button.dataset.view); }
});
$("#languageSwitch").addEventListener("click", (event) => {
  const button = event.target.closest("[data-language]"); if (!button) return;
  state.language = button.dataset.language; state.exam = null; state.studyQueue = null; state.koreanStageContext = null;
  state.view = state.language === "korean" ? "korean-home" : "today";
  configureLanguageNavigation(); render();
});
document.querySelectorAll(".brand").forEach((brand) => brand.addEventListener("click", (event) => { event.preventDefault(); setView(state.language === "korean" ? "korean-home" : "today"); }));
document.querySelectorAll(".dialog-close").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
$("#closeTopikReader").addEventListener("click",()=>{saveTopikInk();$("#topikReaderDialog").close();});
$("#topikPrevPage").addEventListener("click",()=>changeTopikPage(-1));$("#topikNextPage").addEventListener("click",()=>changeTopikPage(1));
$("#topikPenToggle").addEventListener("click",()=>{topikReader.pen=!topikReader.pen;$("#topikInkCanvas").style.pointerEvents=topikReader.pen?"auto":"none";$("#topikPenToggle").classList.toggle("primary",topikReader.pen);toast(topikReader.pen?"Үзгээр бичих горим асаалаа.":"Хуудас удирдах горимд шилжлээ.");});
$("#topikUndoInk").addEventListener("click",()=>{topikReader.strokes.pop();drawTopikInk();saveTopikInk();});
$("#topikClearInk").addEventListener("click",()=>{topikReader.strokes=[];drawTopikInk();saveTopikInk();});$("#topikSaveInk").addEventListener("click",()=>saveTopikInk(false));
$("#topikInkCanvas").addEventListener("pointerdown",(event)=>{if(!topikReader.pen)return;const canvas=event.currentTarget,rect=canvas.getBoundingClientRect();topikReader.drawing=true;canvas.setPointerCapture(event.pointerId);topikReader.active={color:$("#topikPenColor").value,size:Number($("#topikPenSize").value),points:[{x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height}]};topikReader.strokes.push(topikReader.active);});
$("#topikInkCanvas").addEventListener("pointermove",(event)=>{if(!topikReader.drawing||!topikReader.active)return;const rect=event.currentTarget.getBoundingClientRect();topikReader.active.points.push({x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height});drawTopikInk();});
const finishTopikStroke=()=>{if(topikReader.drawing)saveTopikInk();topikReader.drawing=false;topikReader.active=null;};$("#topikInkCanvas").addEventListener("pointerup",finishTopikStroke);$("#topikInkCanvas").addEventListener("pointercancel",finishTopikStroke);
$("#openAddWord").addEventListener("click", () => $("#addWordDialog").showModal());
$("#addWordForm").addEventListener("submit", (event) => {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
  customWords.unshift({ id:`custom-${Date.now()}`, language:data.language, level:"Миний сан", source:"Миний сан", word:data.word.trim(), pronunciation:data.pronunciation.trim(), translation:data.translation.trim(), example:data.example.trim(), memory:data.memory.trim(), visual:"🌸" });
  localStorage.setItem(customKey, JSON.stringify(customWords)); event.currentTarget.reset(); $("#addWordDialog").close(); toast("Шинэ үг хадгалагдлаа."); if (state.view === "mywords") renderMyWords();
});

configureLanguageNavigation(); render(); runPetals(); iconRefresh();
document.querySelector("#logoutAccount")?.addEventListener("click", async () => {
  try { await fetch("/api/auth?action=logout", { method:"POST", headers:{ "Content-Type":"application/json" }, body:"{}" }); } finally { location.replace("/auth/"); }
});
async function verifyPaidAccess() {
  try {
    const response = await fetch("/api/auth?action=me", { cache:"no-store" });
    const account = await response.json();
    if (!account.allowed) location.replace("/auth/");
  } catch { location.replace("/auth/"); }
}
setInterval(verifyPaidAccess, 60_000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) verifyPaidAccess(); });
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", async () => {
    const release = "khulan-language-v21";
    const registration = await navigator.serviceWorker.register("/service-worker.js?v=21", { updateViaCache:"none" });
    await registration.update();
    if (registration.waiting) registration.waiting.postMessage({ type:"SKIP_WAITING" });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (sessionStorage.getItem("khulan-sw-reloaded") === release) return;
      sessionStorage.setItem("khulan-sw-reloaded", release);
      location.reload();
    });
  });
}

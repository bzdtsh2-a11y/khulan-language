(function () {
  const API = "/api/topik";
  const progressKey = "khulan-topik-progress-v1";
  const utils = globalThis.KhulanTopikUtils;
  const cache = new Map();
  const state = {
    tab: "overview",
    grammarType: "connective",
    adType: "product",
    listeningType: "places",
    listeningQuery: "",
    showRawKorean: false,
    studyMode: false,
    vocabularyPage: 1,
    vocabularyQuery: "",
    vocabularyCategory: "all",
    quizSection: "all",
    quizIndex: 0,
    answerResult: null,
    shuffled: new Map(),
    level: 3,
  };
  let progress = JSON.parse(localStorage.getItem(progressKey) || '{"items":{},"wrongAnswers":[]}');

  const escape = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char]));
  const main = () => document.querySelector("#appMain");
  const saveProgress = () => localStorage.setItem(progressKey, JSON.stringify(progress));
  const statusMn = { new: "Шинэ", learning: "Суралцаж буй", review: "Давтах", mastered: "Эзэмшсэн" };
  const tabs = [
    ["overview", "Тойм"],
    ["correct", "Зөв дүрэм"],
    ["similar", "Ижил дүрэм"],
    ["ads", "Зарын үг"],
    ["listening", "Сонсгол"],
    ["vocabulary", "Үгийн сан"],
    ["quiz", "Дасгал"],
    ["wrong", "Буруу хариулт"],
  ];

  async function api(params, options = {}) {
    const query = new URLSearchParams(params);
    const key = `${options.method || "GET"}:${query}`;
    if (!options.body && cache.has(key)) return cache.get(key);
    const response = await fetch(`${API}?${query}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    if (!response.ok) throw new Error(`TOPIK API ${response.status}`);
    const payload = await response.json();
    if (!options.body) cache.set(key, payload);
    return payload;
  }

  function shell(title, description, body) {
    return `
      <header class="topik-hero">
        <div><span class="eyebrow">TOPIK II · CHAPTER 1</span><h1>${escape(title)}</h1><p>${escape(description)}</p></div>
        <span class="topik-level">${state.level}-р түвшин</span>
      </header>
      <nav class="topik-tabs" aria-label="TOPIK хичээлийн хэсэг">
        ${tabs.map(([id, label]) => `<button type="button" class="${state.tab === id ? "active" : ""}" data-topik-tab="${id}">${escape(id === "wrong" ? `${label} (${progress.wrongAnswers?.length || 0})` : label)}</button>`).join("")}
      </nav>
      <section id="topikPanel">${body}</section>`;
  }

  function bindTabs() {
    main().querySelectorAll("[data-topik-tab]").forEach((button) => button.addEventListener("click", () => {
      state.tab = button.dataset.topikTab;
      state.answerResult = null;
      state.quizIndex = 0;
      render();
    }));
  }

  function loading(title = "TOPIK контент ачаалж байна") {
    main().innerHTML = shell(title, "Сургалтын өгөгдлийг серверээс авч байна.", `<div class="topik-loading" role="status">Ачаалж байна…</div>`);
    bindTabs();
  }

  function errorView(error) {
    main().innerHTML = shell("Контент ачаалахад алдаа гарлаа", "Интернэт холболтоо шалгаад дахин оролдоно уу.", `<div class="empty-state"><p>${escape(error.message)}</p><button class="primary" id="retryTopik">Дахин оролдох</button></div>`);
    bindTabs();
    document.querySelector("#retryTopik")?.addEventListener("click", render);
  }

  async function renderOverview() {
    const data = await api({ action: "overview" });
    const stats = [
      [data.counts.connective_grammar, "Холбох дүрэм"],
      [data.counts.sentence_grammar, "Төгсгөх дүрэм"],
      [data.counts.similar_grammar, "Ижил дүрэм"],
      [data.counts.product_topics + data.counts.place_topics, "Зарын сэдэв"],
      [data.counts.listening_place_topics, "Сонсголын газар"],
      [data.counts.vocabulary_unique, "Үгийн сан"],
      [data.counts.quizzes_total, "Дасгал"],
    ];
    const body = `
      <div class="topik-stat-grid">${stats.map(([count, label]) => `<article><strong>${count}</strong><span>${escape(label)}</span></article>`).join("")}</div>
      <div class="topik-overview-grid">
        <button data-topik-jump="correct"><i data-lucide="check-check"></i><strong>Зөв дүрэм</strong><span>Унших 1-р даалгаврын холбох ба төгсгөх дүрмийг ялгана.</span></button>
        <button data-topik-jump="similar"><i data-lucide="git-compare-arrows"></i><strong>Ижил дүрэм</strong><span>40 үндсэн бүлгийн ялгаа, жишээг харьцуулна.</span></button>
        <button data-topik-jump="ads"><i data-lucide="megaphone"></i><strong>Зарын төлөөлөх үг</strong><span>Бүтээгдэхүүн, үйлчилгээ, олон нийтийн ба дэлгэрэнгүй зар.</span></button>
        <button data-topik-jump="listening"><i data-lucide="headphones"></i><strong>Сонсгол</strong><span>40 газар, харилцан яриа, тохирох зураг ба үргэлжлэл.</span></button>
        <button data-topik-jump="vocabulary"><i data-lucide="languages"></i><strong>Үгийн сан</strong><span>${data.counts.vocabulary_unique} давхардалгүй үгийг солонгос, монголоор хайна.</span></button>
        <button data-topik-jump="quiz"><i data-lucide="list-checks"></i><strong>TOPIK дасгал</strong><span>${data.counts.quizzes_total} асуулт, буруу хариултын давталттай.</span></button>
      </div>
      <article class="topik-strategy">
        <span class="eyebrow">СУРАХ ДАРААЛАЛ</span>
        <ol><li>Дүрэм ба түлхүүр үгийг танина.</li><li>Сэдэв, нөхцөлийг жишээгээр ойлгоно.</li><li>Сонсголын яриаг дуугаар давтана.</li><li>Дасгал ажиллаж, буруу хариултаа давтана.</li></ol>
        <small>Эх сурвалж: номын ${escape(data.sourceBookPages)}-р хуудас</small>
      </article>`;
    main().innerHTML = shell(data.titleMn, `${data.targetExam} · ${data.targetLevel}`, body);
    bindTabs();
    main().querySelectorAll("[data-topik-jump]").forEach((button) => button.addEventListener("click", () => {
      state.tab = button.dataset.topikJump;
      render();
    }));
  }

  const exampleHtml = (examples = []) => examples.map((example) => `
    <div class="topik-example"><strong lang="ko">${escape(example.ko)}</strong><span>${escape(example.mn)}</span></div>`).join("");

  async function renderCorrectGrammar() {
    const data = await api({ action: "section", name: "correct_grammar" });
    const rows = state.grammarType === "connective" ? data.connectiveEndings : data.sentenceEndings;
    const body = `
      <div class="topik-subtabs">
        <button class="${state.grammarType === "connective" ? "active" : ""}" data-grammar-type="connective">Холбох дүрэм · 30</button>
        <button class="${state.grammarType === "sentence" ? "active" : ""}" data-grammar-type="sentence">Төгсгөх дүрэм · 20</button>
      </div>
      <p class="topik-guide">${escape(data.guide.description_mn)}</p>
      <div class="topik-card-list">${rows.map((item) => `
        <details class="topik-grammar-card">
          <summary><span class="rank">${item.rank}</span><span><strong lang="ko">${escape(item.pattern)}</strong><small>${escape(item.category_mn)}</small></span><i data-lucide="chevron-down"></i></summary>
          <div class="topik-card-body">
            <p>${escape(item.meaning_mn)}</p>
            <dl><div><dt>Залгах хэлбэр</dt><dd>${escape(item.attachment_mn)}</dd></div><div><dt>Монгол утга</dt><dd>${escape(item.mn_equivalent)}</dd></div></dl>
            ${exampleHtml(item.examples)}
            <small class="source-page">Номын ${item.source_page}-р хуудас</small>
          </div>
        </details>`).join("")}</div>`;
    main().innerHTML = shell("Зөв дүрмийг сонгох", "Унших 1-р даалгаврын Ranking 50 дүрэм", body);
    bindTabs();
    main().querySelectorAll("[data-grammar-type]").forEach((button) => button.addEventListener("click", () => {
      state.grammarType = button.dataset.grammarType;
      render();
    }));
  }

  async function renderSimilarGrammar() {
    const data = await api({ action: "section", name: "similar_grammar" });
    const body = `
      <p class="topik-guide">${escape(data.guide.description_mn)}</p>
      <div class="topik-card-list">${data.items.map((item) => `
        <details class="topik-grammar-card">
          <summary><span class="rank">${item.rank}</span><span><strong>${escape(item.concept_mn)}</strong><small lang="ko">${escape(item.primary)}</small></span><i data-lucide="chevron-down"></i></summary>
          <div class="topik-card-body">
            <p>${escape(item.meaning_mn)}</p>
            <div class="topik-chips">${item.expressions.map((expression) => `<span lang="ko">${escape(expression)}</span>`).join("")}</div>
            ${exampleHtml(item.examples)}
            <small class="source-page">Номын ${item.source_page}-р хуудас</small>
          </div>
        </details>`).join("")}</div>`;
    main().innerHTML = shell("Ижил утгатай дүрэм", "Үндсэн 40 бүлгийг жишээгээр харьцуулах", body);
    bindTabs();
  }

  function topicCards(rows) {
    return `<div class="topik-topic-grid">${rows.map((item) => `
      <article class="topik-topic-card"><header><span>${item.rank}</span><div><strong lang="ko">${escape(item.topic_ko)}</strong><small>${escape(item.topic_mn)}</small></div></header>
      <div>${item.keywords.map((keyword) => `<span class="keyword"><b lang="ko">${escape(keyword.ko)}</b>${escape(keyword.mn)}</span>`).join("")}</div></article>`).join("")}</div>`;
  }

  function adStudyCards(rows) {
    return `<div class="topik-card-list">${rows.map((item) => `
      <article class="topik-study-card">
        <p lang="ko">${escape(item.adKo).replace(/\n/g, "<br>")}</p>
        <p>${escape(item.adMn).replace(/\n/g, "<br>")}</p>
        <div class="topik-option-pairs">${item.options.map((option, index) => `<span><b lang="ko">${index + 1}. ${escape(option)}</b><small>${escape(item.optionsMn[index] || "")}</small></span>`).join("")}</div>
        <small class="source-page">Номын ${item.sourcePage}-р хуудас</small>
      </article>`).join("")}</div>`;
  }

  async function renderAds() {
    const data = await api({ action: "section", name: "advertisements" });
    const choices = [
      ["product", "Бүтээгдэхүүн · 50"],
      ["place", "Үйлчилгээний газар · 40"],
      ["public", "Олон нийтийн зар · 5"],
      ["detail", "Дэлгэрэнгүй зар · 5"],
    ];
    let content = topicCards(data.productTopics);
    if (state.adType === "place") content = topicCards(data.placeTopics);
    if (state.adType === "public") content = adStudyCards(data.publicServiceCards);
    if (state.adType === "detail") content = adStudyCards(data.detailedAdCards);
    const body = `
      <div class="topik-subtabs">${choices.map(([id, label]) => `<button class="${state.adType === id ? "active" : ""}" data-ad-type="${id}">${label}</button>`).join("")}</div>
      <p class="topik-guide">${escape(data.guide.description_mn)}</p>${content}`;
    main().innerHTML = shell("Зарын төлөөлөх үг", "Бүтээгдэхүүн, үйлчилгээ, олон нийт ба дэлгэрэнгүй зарын сэдэв", body);
    bindTabs();
    main().querySelectorAll("[data-ad-type]").forEach((button) => button.addEventListener("click", () => {
      state.adType = button.dataset.adType;
      render();
    }));
  }

  function speakKorean(text) {
    if (!("speechSynthesis" in globalThis)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.85;
    const voice = speechSynthesis.getVoices().find((item) => item.lang?.toLowerCase().startsWith("ko"));
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
  }

  function dialogueHtml(dialogue = []) {
    return `<div class="topik-dialogue">${dialogue.map((line) => `
      <div class="${line.speaker_ko === "여자" ? "speaker-woman" : "speaker-man"}">
        <span>${escape(line.speaker_mn || line.speaker_ko)}</span>
        <div><strong lang="ko">${escape(line.ko)}</strong><small>${escape(line.mn)}</small></div>
        ${line.ko && !line.ko.startsWith("(") ? `<button type="button" data-speak="${escape(line.ko)}" aria-label="Солонгос өгүүлбэрийг сонсох"><i data-lucide="volume-2"></i></button>` : ""}
      </div>`).join("")}</div>`;
  }

  async function renderListening() {
    const places = await api({ action: "section", name: "listening_correct_picture" });
    const choices = [
      ["places", "Газар ба нөхцөл · 40"],
      ["picture", "Тохирох зураг · 1"],
      ["continuation", "Ярианы үргэлжлэл · 1"],
    ];
    let content;
    if (state.listeningType === "places") {
      const needle = utils.normalize(state.listeningQuery);
      const rows = places.locationSituationTopics.filter((item) => utils.normalize([
        item.place_ko, item.place_mn, item.source_text_ko,
        ...item.situations.flatMap((entry) => [entry.ko, entry.mn]),
      ].join(" ")).includes(needle));
      content = `
        <div class="topik-listening-toolbar">
          <label><span>Газар, нөхцөлийг солонгос эсвэл монголоор хайх</span><input id="listeningSearch" value="${escape(state.listeningQuery)}" placeholder="Жишээ: 도서관, номын сан"></label>
          <label class="topik-check"><input type="checkbox" id="rawKoreanMode" ${state.showRawKorean ? "checked" : ""}><span>Эх солонгос текст</span></label>
        </div>
        <p class="word-count">${rows.length}/40 газар</p>
        <div class="topik-place-grid">${rows.map((item) => `
          <article>
            <header><span>${item.rank}</span><div><strong lang="ko">${escape(item.place_ko)}</strong><small>${escape(item.place_mn)}</small></div></header>
            ${state.showRawKorean ? `<p class="raw-korean" lang="ko">${escape(item.source_text_ko)}</p>` : ""}
            <ul>${item.situations.map((situation) => `<li><b lang="ko">${escape(situation.ko)}</b><span>${escape(situation.mn)}</span></li>`).join("")}</ul>
            <small class="source-page">Номын ${item.source_page}-р хуудас</small>
          </article>`).join("")}</div>`;
    } else {
      const section = state.listeningType === "picture" ? "listening_correct_picture" : "listening_continuation";
      const quizzes = (await api({ action: "quizzes", section })).items;
      const quiz = quizzes[0];
      content = `
        <p class="topik-guide">${escape(quiz.questionMn || (state.listeningType === "picture" ? places.guide.study_tip_mn : ""))}</p>
        <article class="topik-study-card">
          ${dialogueHtml(quiz.dialogue)}
          <button type="button" class="secondary topik-play-all" data-speak="${escape(quiz.dialogue.filter((line) => !line.ko.startsWith("(")).map((line) => line.ko).join(" "))}"><i data-lucide="play"></i> Яриаг бүхэлд нь сонсох</button>
          <div class="topik-option-pairs">${quiz.options.map((option, index) => `<span><b lang="ko">${index + 1}. ${escape(option)}</b><small>${escape(quiz.optionsMn[index] || "")}</small></span>`).join("")}</div>
          <button type="button" class="primary" data-open-listening-quiz="${section}">Дасгал ажиллах</button>
        </article>`;
    }
    const body = `
      <div class="topik-subtabs">${choices.map(([id, label]) => `<button class="${state.listeningType === id ? "active" : ""}" data-listening-type="${id}">${label}</button>`).join("")}</div>
      ${content}`;
    main().innerHTML = shell("Сонсголын бэлтгэл", "Газар, нөхцөл, харилцан яриаг таньж солонгос дуудлагаар давтах", body);
    bindTabs();
    main().querySelectorAll("[data-listening-type]").forEach((button) => button.addEventListener("click", () => {
      state.listeningType = button.dataset.listeningType;
      render();
    }));
    document.querySelector("#listeningSearch")?.addEventListener("input", (event) => {
      state.listeningQuery = event.target.value;
      render();
    });
    document.querySelector("#rawKoreanMode")?.addEventListener("change", (event) => {
      state.showRawKorean = event.target.checked;
      render();
    });
    main().querySelectorAll("[data-speak]").forEach((button) => button.addEventListener("click", () => speakKorean(button.dataset.speak)));
    main().querySelector("[data-open-listening-quiz]")?.addEventListener("click", (event) => {
      state.tab = "quiz";
      state.quizSection = event.currentTarget.dataset.openListeningQuiz;
      state.quizIndex = 0;
      render();
    });
  }

  function progressButton(item) {
    const status = progress.items?.[item.id]?.status || "new";
    return `<button type="button" class="topik-status status-${status}" data-topik-status="${item.id}">${statusMn[status]}</button>`;
  }

  async function renderVocabulary() {
    const data = await api({
      action: "vocabulary",
      q: state.vocabularyQuery,
      category: state.vocabularyCategory,
      page: state.vocabularyPage,
      limit: 40,
    });
    state.vocabularyPage = data.page;
    const body = `
      <div class="topik-vocab-toolbar">
        <label><span>Солонгос үг эсвэл монгол утгаар хайх</span><input id="topikVocabSearch" value="${escape(state.vocabularyQuery)}" placeholder="Жишээ: 환경, орчин"></label>
        <label><span>Ангилал</span><select id="topikVocabCategory"><option value="all">Бүх ангилал</option><option value="product_ad" ${state.vocabularyCategory === "product_ad" ? "selected" : ""}>Бүтээгдэхүүний зар</option><option value="place_ad" ${state.vocabularyCategory === "place_ad" ? "selected" : ""}>Үйлчилгээний зар</option><option value="listening" ${state.vocabularyCategory === "listening" ? "selected" : ""}>Сонсгол</option></select></label>
      </div>
      <p class="word-count">${data.total.toLocaleString()} үг · ${data.page}/${data.totalPages} хуудас · нэг хуудсанд ${data.limit}</p>
      <div class="topik-vocab-grid">${data.items.map((item) => `
        <article><div><strong lang="ko">${escape(item.ko)}</strong><span>${escape(item.mn)}</span><small>${escape(item.pos)} · ${escape((item.related_topics || []).join(", "))}</small></div>${progressButton(item)}</article>`).join("") || `<div class="empty-state">Үг олдсонгүй.</div>`}</div>
      <nav class="topik-pager" aria-label="TOPIK үгийн сангийн хуудас">
        <button type="button" data-vocab-page="1" ${data.page <= 1 ? "disabled" : ""}>Эхний</button>
        <button type="button" data-vocab-page="${data.page - 1}" ${data.page <= 1 ? "disabled" : ""}><i data-lucide="chevron-left"></i> Өмнөх</button>
        <span>${data.page} / ${data.totalPages}</span>
        <button type="button" data-vocab-page="${data.page + 1}" ${data.page >= data.totalPages ? "disabled" : ""}>Дараах <i data-lucide="chevron-right"></i></button>
        <button type="button" data-vocab-page="${data.totalPages}" ${data.page >= data.totalPages ? "disabled" : ""}>Сүүлийн</button>
      </nav>`;
    main().innerHTML = shell("TOPIK үгийн сан", `${data.total.toLocaleString()} үгийг хуудас бүрээр бүрэн үзэж, солонгос ба монгол хэлээр хайна`, body);
    bindTabs();
    let timer;
    document.querySelector("#topikVocabSearch").addEventListener("input", (event) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.vocabularyQuery = event.target.value.trim();
        state.vocabularyPage = 1;
        cache.clear();
        render();
      }, 250);
    });
    document.querySelector("#topikVocabCategory").addEventListener("change", (event) => {
      state.vocabularyCategory = event.target.value;
      state.vocabularyPage = 1;
      cache.clear();
      render();
    });
    main().querySelectorAll("[data-vocab-page]").forEach((button) => button.addEventListener("click", () => {
      state.vocabularyPage = Number(button.dataset.vocabPage);
      cache.clear();
      render();
    }));
    main().querySelectorAll("[data-topik-status]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.topikStatus;
      const current = progress.items?.[id]?.status || "new";
      progress = utils.updateProgress(progress, id, current !== "mastered");
      if (current === "learning") progress.items[id].status = "mastered";
      saveProgress();
      render();
    }));
  }

  async function quizItems(wrongOnly = false) {
    const params = { action: "quizzes", section: wrongOnly ? "all" : state.quizSection };
    if (wrongOnly) params.ids = (progress.wrongAnswers || []).join(",");
    return (await api(params)).items;
  }

  async function renderQuiz(wrongOnly = false) {
    const items = await quizItems(wrongOnly);
    if (!items.length) {
      main().innerHTML = shell(wrongOnly ? "Буруу хариултын давталт" : "TOPIK дасгал", wrongOnly ? "Одоогоор давтах буруу хариулт алга." : "Асуулт олдсонгүй.", `<div class="empty-state">${wrongOnly ? "Та буруу хариултаа засжээ. Маш сайн!" : "Асуулт олдсонгүй."}</div>`);
      bindTabs();
      return;
    }
    state.quizIndex = Math.min(state.quizIndex, items.length - 1);
    const quiz = items[state.quizIndex];
    if (!state.shuffled.has(quiz.id)) state.shuffled.set(quiz.id, utils.shuffleOptions(quiz.options));
    const options = state.shuffled.get(quiz.id);
    const result = state.answerResult?.id === quiz.id ? state.answerResult : null;
    const sectionOptions = [
      ["all", `Бүх дасгал (${items.length})`],
      ["correct_grammar", "Зөв дүрэм"],
      ["similar_grammar", "Ижил дүрэм"],
      ["advertisements", "Зар"],
      ["listening_correct_picture", "Сонсгол: тохирох зураг"],
      ["listening_continuation", "Сонсгол: ярианы үргэлжлэл"],
    ];
    const body = `
      ${wrongOnly ? "" : `<div class="topik-quiz-tools"><label class="topik-quiz-filter"><span>Дасгалын төрөл</span><select id="topikQuizSection">${sectionOptions.map(([value, label]) => `<option value="${value}" ${state.quizSection === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label class="topik-check"><input type="checkbox" id="studyMode" ${state.studyMode ? "checked" : ""}><span>Суралцах горим (монгол сонголт)</span></label></div>`}
      <article class="topik-quiz-card">
        <header><span>${state.quizIndex + 1}/${items.length}</span><small>Номын ${quiz.sourcePage}-р хуудас ${quiz.sourceExam ? `· ${escape(quiz.sourceExam)}` : ""}</small></header>
        <p class="question-ko" lang="ko">${escape(quiz.questionKo).replace(/\n/g, "<br>")}</p>
        ${state.studyMode && quiz.questionMn ? `<p class="question-mn">${escape(quiz.questionMn)}</p>` : ""}
        ${quiz.underlined ? `<p class="topik-underlined" lang="ko">${escape(quiz.underlined)}</p>` : ""}
        ${quiz.dialogue?.length ? dialogueHtml(quiz.dialogue) : ""}
        ${quiz.dialogue?.length ? `<button type="button" class="secondary topik-play-all" data-speak="${escape(quiz.dialogue.filter((line) => !line.ko.startsWith("(")).map((line) => line.ko).join(" "))}"><i data-lucide="play"></i> Яриаг сонсох</button>` : ""}
        ${quiz.cluesKo?.length ? `<div class="topik-chips">${quiz.cluesKo.map((clue) => `<span lang="ko">${escape(clue)}</span>`).join("")}</div>` : ""}
        <div class="topik-options">${options.map((option, index) => {
          const original = option.originalIndex - 1;
          return `<button type="button" data-quiz-option="${option.originalIndex}" ${result ? "disabled" : ""}><span>${index + 1}</span><b lang="ko">${escape(option.text)}${state.studyMode && quiz.optionsMn[original] ? `<small>${escape(quiz.optionsMn[original])}</small>` : ""}</b></button>`;
        }).join("")}</div>
        <div id="topikAnswerResult" aria-live="polite">${result ? `
          <div class="topik-result ${result.correct ? "correct" : "wrong"}"><strong>${result.correct ? "Зөв байна!" : `Буруу. Зөв хариулт: ${escape(result.answer)}${result.answerMn ? ` — ${escape(result.answerMn)}` : ""}`}</strong><p>${escape(result.explanationMn)}</p>${result.adMn ? `<p>${escape(result.adMn)}</p>` : ""}</div>` : ""}</div>
        <footer><button type="button" class="secondary" id="previousTopikQuiz" ${state.quizIndex === 0 ? "disabled" : ""}>Өмнөх</button><button type="button" class="primary" id="nextTopikQuiz">${state.quizIndex === items.length - 1 ? "Эхнээс" : "Дараах"}</button></footer>
      </article>`;
    main().innerHTML = shell(wrongOnly ? "Буруу хариултын давталт" : "TOPIK дасгал", "Зөв хариу, тайлбар нь сонголт хийсний дараа нээгдэнэ.", body);
    bindTabs();
    document.querySelector("#topikQuizSection")?.addEventListener("change", (event) => {
      state.quizSection = event.target.value;
      state.quizIndex = 0;
      state.answerResult = null;
      cache.clear();
      render();
    });
    document.querySelector("#studyMode")?.addEventListener("change", (event) => {
      state.studyMode = event.target.checked;
      render();
    });
    main().querySelectorAll("[data-speak]").forEach((button) => button.addEventListener("click", () => speakKorean(button.dataset.speak)));
    main().querySelectorAll("[data-quiz-option]").forEach((button) => button.addEventListener("click", async () => {
      const selectedOption = Number(button.dataset.quizOption);
      const answer = await api({ action: "answer" }, {
        method: "POST",
        body: JSON.stringify({ quizId: quiz.id, selectedOption }),
      });
      progress = utils.updateProgress(progress, quiz.id, answer.correct);
      saveProgress();
      state.answerResult = answer;
      cache.clear();
      render();
    }));
    document.querySelector("#previousTopikQuiz").addEventListener("click", () => {
      state.quizIndex -= 1;
      state.answerResult = null;
      render();
    });
    document.querySelector("#nextTopikQuiz").addEventListener("click", () => {
      state.quizIndex = (state.quizIndex + 1) % items.length;
      state.answerResult = null;
      render();
    });
  }

  async function render() {
    loading();
    try {
      if (state.tab === "overview") await renderOverview();
      else if (state.tab === "correct") await renderCorrectGrammar();
      else if (state.tab === "similar") await renderSimilarGrammar();
      else if (state.tab === "ads") await renderAds();
      else if (state.tab === "listening") await renderListening();
      else if (state.tab === "vocabulary") await renderVocabulary();
      else if (state.tab === "quiz") await renderQuiz(false);
      else if (state.tab === "wrong") await renderQuiz(true);
      globalThis.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });
    } catch (error) {
      errorView(error);
    }
  }

  function open(level = 3, tab = "overview", mode = "") {
    state.level = Number(level) || 3;
    state.tab = tab || "overview";
    if (tab === "correct" && mode) state.grammarType = mode;
    if (tab === "ads" && mode) state.adType = mode;
    state.answerResult = null;
    state.quizIndex = 0;
    render();
  }
  globalThis.KhulanTopik = { render, open };
})();

(() => {
  "use strict";

  const tabs = [
    ["overview", "Тойм"],
    ["supplementary", "Нэмэлт дасгал"],
    ["worked", "Тайлбартай жишээ"],
    ["rankings", "Эрэмбэ"],
    ["sets", "Бодлогын багц"],
    ["source-pages", "Эх хуудас"],
  ];
  const cache = new Map();
  let level = 3;
  let activeTab = "overview";

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const lines = (value) => esc(value).replace(/\r?\n/g, "<br>");
  const main = () => document.getElementById("appMain");

  async function load(section) {
    if (cache.has(section)) return cache.get(section);
    const response = await fetch(`/api/topik?action=chapter2&section=${encodeURIComponent(section)}`);
    if (!response.ok) throw new Error("CONTENT_LOAD_FAILED");
    const payload = await response.json();
    cache.set(section, payload);
    return payload;
  }

  function shell(content = '<div class="ch02-loading">Агуулгыг уншиж байна…</div>') {
    const root = main();
    if (!root) return;
    root.innerHTML = `
      <section class="ch02-shell">
        <header class="ch02-hero">
          <button class="ch02-back" type="button" data-ch02-back>← TOPIK түвшин</button>
          <p>TOPIK II · ${esc(level)}-Р ТҮВШИН</p>
          <h1>2-р бүлэг</h1>
          <span>Нөхцөл байдал ба түүнд өгөх хариу</span>
        </header>
        <nav class="ch02-tabs" aria-label="2-р бүлгийн хэсгүүд">
          ${tabs.map(([id, label]) => `<button type="button" data-ch02-tab="${id}" class="${id === activeTab ? "is-active" : ""}">${label}</button>`).join("")}
        </nav>
        <div class="ch02-content">${content}</div>
      </section>`;
    root.querySelector("[data-ch02-back]")?.addEventListener("click", () => {
      document.querySelector('#mainNav [data-view="korean-topik"]')?.click();
    });
    root.querySelectorAll("[data-ch02-tab]").forEach((button) => {
      button.addEventListener("click", () => show(button.dataset.ch02Tab));
    });
  }

  function renderOverview(data) {
    const counts = data.validation?.counts || {};
    return `
      <article class="ch02-intro">
        <p class="ch02-kicker">${esc(data.titleKo)}</p>
        <h2>${esc(data.titleMn)}</h2>
        <p>${esc(data.summaryMn)}</p>
        <div class="ch02-stats">
          <div><strong>${esc(counts.sourcePages)}</strong><span>эх хуудас</span></div>
          <div><strong>${esc(counts.structuredExercises)}</strong><span>бүтэцчилсэн дасгал</span></div>
          <div><strong>${esc(counts.problemSets)}</strong><span>бодлогын багц</span></div>
          <div><strong>${esc((counts.placesRanking || 0) + (counts.topicsRanking || 0))}</strong><span>эрэмбэлсэн сэдэв</span></div>
        </div>
      </article>
      <div class="ch02-overview-grid">
        ${tabs.slice(1).map(([id, label]) => `<button type="button" data-ch02-jump="${id}"><span>${label}</span><b>Нээх →</b></button>`).join("")}
      </div>`;
  }

  function renderSupplementary(data) {
    return `<h2>${esc(data.titleMn)}</h2>
      <p class="ch02-note">Сонголтоо дарсны дараа зөв хариу болон Монгол тайлбар харагдана.</p>
      <div class="ch02-list">${data.items.map((item) => `
        <article class="ch02-card ch02-exercise" data-answer="${esc(item.suggested_answer)}">
          <small>${esc(item.page)}-р хуудас · ${esc(item.no)}</small>
          <h3>${esc(item.prompt_ko)}</h3>
          <p>${esc(item.prompt_mn)}</p>
          <div class="ch02-options">${(item.options_ko || []).map((option, index) =>
            `<button type="button" data-option="${index + 1}"><b>${index + 1}</b> ${esc(option)}${item.options_mn?.[index] ? `<span>${esc(item.options_mn[index])}</span>` : ""}</button>`).join("")}</div>
          <div class="ch02-answer" hidden></div>
        </article>`).join("")}</div>`;
  }

  function renderWorked(data) {
    return `<h2>${esc(data.titleMn)}</h2><div class="ch02-list">${data.items.map((item) => `
      <article class="ch02-card">
        <small>${esc(item.page)}-р хуудас · ${esc(item.id)}</small>
        <h3>${esc(item.title_mn)}</h3>
        <div class="ch02-dialogue">${(item.dialogue_ko || []).map((line) => lines(line)).join("<br>")}</div>
        <p class="ch02-correct">Зөв хариу: ${esc(item.answer)}</p>
        <p>${esc(item.explanation_mn)}</p>
      </article>`).join("")}</div>`;
  }

  function renderRankings(data) {
    const table = (items, koreanKey, mongolianKey) => `
      <div class="ch02-ranking">${items.map((item) => `
        <div><b>${esc(item.rank)}</b><span><strong>${esc(item[koreanKey])}</strong><small>${esc(item[mongolianKey])}</small></span><em>${esc(item.sample_topics_ko)}</em></div>`).join("")}</div>`;
    return `<h2>${esc(data.titleMn)}</h2>
      <details open><summary>Үйлчилгээний газар, байгууллага — 40</summary>${table(data.places, "place_ko", "place_mn")}</details>
      <details><summary>Ярианы сэдэв — 20</summary>${table(data.topics, "topic_ko", "topic_mn")}</details>`;
  }

  function renderSets(data) {
    return `<h2>${esc(data.titleMn)}</h2><p class="ch02-note">${esc(data.noticeMn)}</p>
      <div class="ch02-list">${data.items.map((set) => `
        <details class="ch02-card"><summary>${esc(set.set_id)} · ${esc(set.theme_ko)} — ${esc(set.theme_mn)}</summary>
          ${(set.questions || []).map((question) => `<section class="ch02-question">
            <h3>${esc(question.no)}.</h3>
            <ol>${(question.options_ko || []).map((option) => `<li>${esc(option)}</li>`).join("")}</ol>
          </section>`).join("")}
        </details>`).join("")}</div>`;
  }

  function renderSources(data) {
    return `<h2>${esc(data.titleMn)}</h2><p class="ch02-note">${esc(data.noticeMn)}</p>
      <div class="ch02-list">${data.items.map((page) => `
        <details class="ch02-card"><summary>${esc(page.page_no)}-р хуудас · ${esc(page.title_mn || page.title_ko)}</summary>
          <p><b>Ангилал:</b> ${esc(page.category)}</p>
          <p><b>Эх зургийн лавлагаа:</b> <code>${esc(page.source_image_path)}</code></p>
          <pre>${esc(page.ocr_text_raw)}</pre>
        </details>`).join("")}</div>`;
  }

  function bindInteractions() {
    const root = main();
    root?.querySelectorAll("[data-ch02-jump]").forEach((button) =>
      button.addEventListener("click", () => show(button.dataset.ch02Jump)));
    root?.querySelectorAll(".ch02-exercise").forEach((card) => {
      card.querySelectorAll("[data-option]").forEach((button) => {
        button.addEventListener("click", () => {
          const correct = String(card.dataset.answer);
          card.querySelectorAll("[data-option]").forEach((candidate) => {
            candidate.disabled = true;
            candidate.classList.toggle("is-correct", candidate.dataset.option === correct);
            candidate.classList.toggle("is-wrong", candidate === button && candidate.dataset.option !== correct);
          });
          const answer = card.querySelector(".ch02-answer");
          answer.hidden = false;
          answer.textContent = button.dataset.option === correct
            ? `Зөв. Хариу: ${correct}`
            : `Дахин нягтлаарай. Зөв хариу: ${correct}`;
        });
      });
    });
  }

  async function show(tab) {
    activeTab = tabs.some(([id]) => id === tab) ? tab : "overview";
    shell();
    try {
      const data = await load(activeTab);
      const renderers = {
        overview: renderOverview,
        supplementary: renderSupplementary,
        worked: renderWorked,
        rankings: renderRankings,
        sets: renderSets,
        "source-pages": renderSources,
      };
      shell(renderers[activeTab](data));
      bindInteractions();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      shell('<div class="ch02-error">Агуулгыг ачаалж чадсангүй. Интернэт холболтоо шалгаад дахин оролдоно уу.</div>');
    }
  }

  window.KhulanTopikChapter2 = {
    open(selectedLevel = 3) {
      level = Number(selectedLevel) || 3;
      activeTab = "overview";
      show("overview");
    },
  };
})();

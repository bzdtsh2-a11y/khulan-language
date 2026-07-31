(function (root) {
  const normalize = (value = "") =>
    String(value).normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();

  function searchMatches(item, query) {
    const needle = normalize(query);
    if (!needle) return true;
    return normalize([
      item.ko,
      item.mn,
      item.pattern,
      item.meaning_mn,
      item.topic_ko,
      item.topic_mn,
      ...(item.related_topics || []),
    ].filter(Boolean).join(" ")).includes(needle);
  }

  function shuffleOptions(options, random = Math.random) {
    const mapped = options.map((text, index) => ({ text, originalIndex: index + 1 }));
    for (let index = mapped.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [mapped[index], mapped[swapIndex]] = [mapped[swapIndex], mapped[index]];
    }
    return mapped;
  }

  function updateProgress(progress, itemId, correct, now = new Date()) {
    const next = JSON.parse(JSON.stringify(progress || { items: {}, wrongAnswers: [] }));
    next.items ||= {};
    next.wrongAnswers ||= [];
    const previous = next.items[itemId] || { status: "new", correctCount: 0, wrongCount: 0 };
    const due = new Date(now);
    if (correct) {
      due.setDate(due.getDate() + (previous.correctCount >= 1 ? 14 : 3));
      next.items[itemId] = {
        ...previous,
        status: previous.correctCount >= 1 ? "mastered" : "learning",
        correctCount: previous.correctCount + 1,
        nextReviewAt: due.toISOString(),
      };
      next.wrongAnswers = next.wrongAnswers.filter((id) => id !== itemId);
    } else {
      due.setDate(due.getDate() + 1);
      next.items[itemId] = {
        ...previous,
        status: "review",
        wrongCount: previous.wrongCount + 1,
        nextReviewAt: due.toISOString(),
      };
      if (!next.wrongAnswers.includes(itemId)) next.wrongAnswers.push(itemId);
    }
    return next;
  }

  root.KhulanTopikUtils = { normalize, searchMatches, shuffleOptions, updateProgress };
})(globalThis);

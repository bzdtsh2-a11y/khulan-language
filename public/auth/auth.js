(function () {
  "use strict";

  const app = document.querySelector("#authApp");
  const toastBox = document.querySelector("#authToast");
  let tab = new URL(location.href).searchParams.get("admin") === "1" ? "admin" : "login";
  let current = null;
  let resetState = null;
  let pollTimer = null;

  const escape = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);

  const statusLabel = {
    pending_payment: "Төлбөр хүлээгдэж байна",
    payment_submitted: "Шалгаж байна",
    payment_rejected: "Төлбөр баталгаажаагүй",
    active: "Идэвхтэй",
    expired: "Хугацаа дууссан",
    revoked: "Эрх цуцлагдсан",
  };

  function toast(message) {
    toastBox.textContent = message;
    toastBox.classList.add("show");
    setTimeout(() => toastBox.classList.remove("show"), 3000);
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || "Алдаа гарлаа.");
      error.code = payload.error;
      throw error;
    }
    return payload;
  }

  async function clearOffline() {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in globalThis) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  }

  function tabs() {
    return `<nav class="auth-tabs">
      <button data-tab="login" class="${tab === "login" ? "active" : ""}">Нэвтрэх</button>
      <button data-tab="register" class="${tab === "register" ? "active" : ""}">Бүртгүүлэх</button>
      <button data-tab="admin" class="${tab === "admin" ? "active" : ""}">Админ</button>
    </nav>`;
  }

  function bindTabs() {
    app.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
      tab = button.dataset.tab;
      resetState = null;
      renderPublic();
    }));
  }

  function formError(form, message) {
    let box = form.querySelector(".form-error");
    if (!box) {
      box = document.createElement("div");
      box.className = "form-error";
      form.prepend(box);
    }
    box.textContent = message;
  }

  function loginForm(admin) {
    return `<form id="loginForm">
      <label>${admin ? "Админы нэр" : "Нэвтрэх нэр"}<input name="username" autocomplete="username" required maxlength="40"></label>
      <label>Нууц үг<input name="password" type="password" autocomplete="current-password" required maxlength="128"></label>
      ${admin ? "" : '<button class="link-button" id="forgotPassword" type="button">Нууц үгээ мартсан уу?</button>'}
      <button class="primary" type="submit">${admin ? "Админ хэсэгт нэвтрэх" : "Нэвтрэх"}</button>
    </form>`;
  }

  function registerForm() {
    return `<form id="registerForm">
      <label>Овог нэр<input name="name" autocomplete="name" required minlength="2" maxlength="80"></label>
      <label>Утасны дугаар<input name="phone" inputmode="tel" autocomplete="tel" required minlength="8" maxlength="20"></label>
      <label>Нэвтрэх нэр <small>Латин үсэг, тоо ашиглана</small><input name="username" autocomplete="username" required minlength="3" maxlength="40" pattern="[A-Za-z0-9._-]+"></label>
      <label>Нууц үг <small>Хамгийн багадаа 10 тэмдэгт</small><input name="password" type="password" autocomplete="new-password" required minlength="10" maxlength="128"></label>
      <label>Нууц үг давтах<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="10" maxlength="128"></label>
      <button class="primary" type="submit">Бүртгүүлэх</button>
    </form>`;
  }

  function recoveryForm() {
    return `<form id="recoveryForm">
      <div class="recovery-info">Бүртгэлтэй нэвтрэх нэр болон утасны дугаараа оруулна. Хүсэлтийг админ утасны дугаартай тулгаж зөвшөөрсний дараа шинэ нууц үг тохируулна.</div>
      <label>Нэвтрэх нэр<input name="username" autocomplete="username" required minlength="3" maxlength="40"></label>
      <label>Бүртгэлтэй утасны дугаар<input name="phone" inputmode="tel" autocomplete="tel" required minlength="8" maxlength="20"></label>
      <button class="primary" type="submit">Сэргээх хүсэлт илгээх</button>
      <button class="link-button" data-back-login type="button">Нэвтрэх хэсэг рүү буцах</button>
    </form>`;
  }

  function renderPublic() {
    clearInterval(pollTimer);
    app.classList.remove("wide");
    const isRegister = tab === "register";
    const isAdmin = tab === "admin";
    const isForgot = tab === "forgot";
    app.innerHTML = `${tabs()}
      <span class="eyebrow">${isRegister ? "ШИНЭ ХЭРЭГЛЭГЧ" : isAdmin ? "УДИРДЛАГЫН ХЭСЭГ" : isForgot ? "НУУЦ ҮГ СЭРГЭЭХ" : "ГИШҮҮНИЙ НЭВТРЭЛТ"}</span>
      <h1>${isRegister ? "Бүртгэл үүсгэх" : isAdmin ? "Админ нэвтрэх" : isForgot ? "Нууц үгээ сэргээх" : "Тавтай морил"}</h1>
      <p class="intro">${isRegister ? "Бүртгүүлсний дараа сарын төлбөрийн мэдээлэл гарна. Админ төлбөрийг шалгаж зөвшөөрсний дараа хичээлүүд нээгдэнэ." : isAdmin ? "Төлбөр болон нууц үг сэргээх хүсэлтүүдийг шалгаж шийдвэрлэнэ." : isForgot ? "Таны бүртгэлтэй утсыг админ шалгасны дараа шинэ нууц үг тохируулах эрх нээгдэнэ." : "Зөвшөөрөгдсөн хэрэглэгч үндсэн сургалтын веб рүү нэвтэрнэ."}</p>
      ${isRegister ? registerForm() : isForgot ? recoveryForm() : loginForm(isAdmin)}`;
    bindTabs();
    bindPublicForms();
  }

  function bindPublicForms() {
    document.querySelector("#forgotPassword")?.addEventListener("click", async () => {
      try {
        const status = await api("/api/auth?action=reset-status");
        if (status.requested) {
          resetState = status;
          renderResetState();
        } else {
          tab = "forgot";
          renderPublic();
        }
      } catch {
        tab = "forgot";
        renderPublic();
      }
    });

    document.querySelectorAll("[data-back-login]").forEach((button) => button.addEventListener("click", () => {
      tab = "login";
      renderPublic();
    }));

    const login = document.querySelector("#loginForm");
    login?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = login.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const data = Object.fromEntries(new FormData(login));
        current = await api("/api/auth?action=login", { method: "POST", body: JSON.stringify(data) });
        renderSession();
      } catch (error) {
        formError(login, error.message);
      } finally {
        button.disabled = false;
      }
    });

    const register = document.querySelector("#registerForm");
    register?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(register));
      if (data.password !== data.confirmPassword) {
        formError(register, "Нууц үг давталт тохирохгүй байна.");
        return;
      }
      const button = register.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        current = await api("/api/auth?action=register", { method: "POST", body: JSON.stringify(data) });
        renderSession();
      } catch (error) {
        formError(register, error.message);
      } finally {
        button.disabled = false;
      }
    });

    const recovery = document.querySelector("#recoveryForm");
    recovery?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = recovery.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const data = Object.fromEntries(new FormData(recovery));
        resetState = await api("/api/auth?action=request-password-reset", { method: "POST", body: JSON.stringify(data) });
        toast(resetState.message);
        renderResetState();
      } catch (error) {
        formError(recovery, error.message);
      } finally {
        button.disabled = false;
      }
    });
  }

  function renderResetState() {
    clearInterval(pollTimer);
    app.classList.remove("wide");
    if (!resetState?.requested) {
      tab = "forgot";
      renderPublic();
      return;
    }

    if (resetState.status === "approved") {
      app.innerHTML = `${tabs()}<span class="eyebrow">АДМИН ЗӨВШӨӨРСӨН</span><h1>Шинэ нууц үг тохируулах</h1>
        <p class="intro">Шинэ нууц үг хамгийн багадаа 10 тэмдэгт байна. Шинэчилсний дараа хуучин нууц үг болон өмнөх бүх хэрэглэгчийн session хүчингүй болно.</p>
        <form id="newPasswordForm">
          <label>Шинэ нууц үг<input name="password" type="password" autocomplete="new-password" required minlength="10" maxlength="128"></label>
          <label>Шинэ нууц үг давтах<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="10" maxlength="128"></label>
          <button class="primary" type="submit">Нууц үгээ шинэчлэх</button>
        </form>`;
      bindTabs();
      bindNewPasswordForm();
      return;
    }

    if (resetState.status === "rejected") {
      app.innerHTML = `${tabs()}<article class="status-card wait-card recovery-card"><div class="status-icon">×</div><h2>Сэргээх хүсэлт зөвшөөрөгдөөгүй</h2><p>Бүртгэлийн мэдээллийг баталгаажуулах боломжгүй тул админ хүсэлтийг цуцалсан байна. Админтай холбогдох эсвэл мэдээллээ шалгаад шинэ хүсэлт гаргана уу.</p><button class="primary recovery-action" id="newRecoveryRequest">Шинэ хүсэлт гаргах</button><button class="link-button" data-back-login type="button">Нэвтрэх хэсэг рүү буцах</button></article>`;
      bindTabs();
      document.querySelector("#newRecoveryRequest")?.addEventListener("click", () => { tab = "forgot"; resetState = null; renderPublic(); });
      document.querySelector("[data-back-login]")?.addEventListener("click", () => { tab = "login"; renderPublic(); });
      return;
    }

    app.innerHTML = `${tabs()}<article class="status-card wait-card recovery-card"><div class="status-icon">⌛</div><h2>Админы зөвшөөрөл хүлээж байна</h2><p>Нууц үг сэргээх хүсэлт админд очсон. Админ бүртгэлтэй утасны дугаарыг шалгаж зөвшөөрсний дараа энэ дэлгэц дээр шинэ нууц үг тохируулах хэсэг автоматаар гарна.</p><div class="wait-dots"><i></i><i></i><i></i></div><p class="recovery-expiry">Хүсэлт 24 цаг хүчинтэй.</p><button class="secondary recovery-action" id="checkResetNow">Төлөв дахин шалгах</button><button class="link-button" data-back-login type="button">Нэвтрэх хэсэг рүү буцах</button></article>`;
    bindTabs();
    document.querySelector("#checkResetNow")?.addEventListener("click", refreshResetStatus);
    document.querySelector("[data-back-login]")?.addEventListener("click", () => { tab = "login"; renderPublic(); });
    pollTimer = setInterval(refreshResetStatus, 8000);
  }

  async function refreshResetStatus() {
    try {
      const next = await api("/api/auth?action=reset-status");
      if (!next.requested) return;
      if (next.status !== resetState?.status) {
        resetState = next;
        renderResetState();
      }
    } catch {}
  }

  function bindNewPasswordForm() {
    const form = document.querySelector("#newPasswordForm");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      if (data.password !== data.confirmPassword) {
        formError(form, "Нууц үг давталт тохирохгүй байна.");
        return;
      }
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const result = await api("/api/auth?action=reset-password", { method: "POST", body: JSON.stringify(data) });
        toast(result.message);
        resetState = null;
        tab = "login";
        renderPublic();
      } catch (error) {
        formError(form, error.message);
      } finally {
        button.disabled = false;
      }
    });
  }

  async function logout() {
    await api("/api/auth?action=logout", { method: "POST", body: "{}" });
    current = null;
    tab = "login";
    renderPublic();
  }

  function accountHeader(title, subtitle) {
    return `<header class="account-head"><div><span class="eyebrow">${escape(subtitle)}</span><h1>${escape(title)}</h1></div><button class="secondary" id="logoutButton">Гарах</button></header>`;
  }

  function bindLogout() {
    document.querySelector("#logoutButton")?.addEventListener("click", logout);
  }

  function paymentView(user, payment) {
    const rejected = user.status === "payment_rejected";
    const expired = user.status === "expired";
    return `${accountHeader(user.name, `ХЭРЭГЛЭГЧ · ${user.username}`)}<article class="status-card"><div class="status-icon">₮</div><h2>${expired ? "Сунгалтын төлбөр төлөх" : rejected ? "Төлбөр баталгаажаагүй" : "Сарын төлбөр төлөх"}</h2><p>${rejected ? "Өмнөх хүсэлтийн төлбөр дансанд ороогүй тул баталгаажаагүй. Төлбөрөө хийсний дараа дахин баталгаажуулна уу." : "Доорх данс руу нэг сарын төлбөр шилжүүлээд баталгаажуулах товчийг дарна уу."}</p><div class="bank-card"><div class="amount"><b>${Number(payment.amount).toLocaleString()}₮</b><span>1 сарын эрх</span></div><div class="bank-row"><span>Банк</span><b>${escape(payment.bank)}</b></div><div class="bank-row"><span>Данс</span><b>${escape(payment.account)}</b><button class="copy" data-copy="${escape(payment.account)}">Хуулах</button></div><div class="bank-row"><span>Хүлээн авагч</span><b>${escape(payment.accountName)}</b></div><p class="payment-note">Гүйлгээний утга дээр <b>${escape(user.username)}</b> гэж бичнэ үү.</p><button class="primary" id="submitPayment">Төлбөр хийснээ баталгаажуулах</button></div></article>`;
  }

  function waitingView(user) {
    return `${accountHeader(user.name, `ХЭРЭГЛЭГЧ · ${user.username}`)}<article class="status-card wait-card"><div class="status-icon">⌛</div><h2>Төлбөрийг шалгаж байна</h2><p>Төлбөрийг шалгаж дуустал түр хүлээнэ үү.</p><div class="wait-dots"><i></i><i></i><i></i></div><p>Админ төлбөрийг шалгаж зөвшөөрмөгц үндсэн сургалтын хуудас автоматаар нээгдэнэ.</p></article>`;
  }

  function bindPayment() {
    bindLogout();
    document.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(button.dataset.copy);
      toast("Дансны дугаар хууллаа.");
    }));
    document.querySelector("#submitPayment")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await api("/api/auth?action=submit-payment", { method: "POST", body: "{}" });
        current.user = result.user;
        toast(result.message);
        renderSession();
      } catch (error) {
        toast(error.message);
        button.disabled = false;
      }
    });
  }

  function renderSession() {
    clearInterval(pollTimer);
    if (!current?.authenticated) { renderPublic(); return; }
    if (current.role === "admin") { renderAdmin(); return; }
    if (current.allowed) { location.replace("/"); return; }
    app.classList.remove("wide");
    const user = current.user;
    app.innerHTML = user.status === "payment_submitted" ? waitingView(user) : paymentView(user, current.payment || { bank: "ХААН БАНК", account: "140005005041175502", accountName: "ИДЭР ХУЛАН", amount: 30000 });
    bindPayment();
    if (user.status === "payment_submitted") pollTimer = setInterval(refreshSession, 10000);
  }

  async function refreshSession() {
    try {
      current = await api("/api/auth?action=me");
      if (current.allowed) { location.replace("/"); return; }
      if (current.user?.status !== "payment_submitted") renderSession();
    } catch {}
  }

  function date(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("mn-MN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }

  function renderAdminRows(users) {
    if (!users.length) return '<div class="empty">Одоогоор бүртгэлтэй хэрэглэгч алга.</div>';
    return users.map((user) => `<article class="user-row" data-user="${escape(user.id)}"><div><strong>${escape(user.name)}</strong><small>${escape(user.username)} · ${escape(user.phone)}</small></div><div><span class="badge ${escape(user.status)}">${escape(statusLabel[user.status] || user.status)}</span><small>Хүсэлт: ${escape(date(user.paymentSubmittedAt))}</small></div><div><strong>${user.accessUntil ? escape(date(user.accessUntil)) : "Эрх нээгдээгүй"}</strong><small>Бүртгэл: ${escape(date(user.createdAt))}</small></div><div class="actions">${user.status === "payment_submitted" ? '<button class="success" data-action="approve">Зөвшөөрөх</button><button class="danger" data-action="reject">Цуцлах</button>' : user.status === "active" ? '<button class="danger" data-action="revoke">Эрх цуцлах</button>' : ""}</div></article>`).join("");
  }

  function renderResetRows(requests) {
    if (!requests.length) return '<div class="empty">Хүлээгдэж буй нууц үг сэргээх хүсэлт алга.</div>';
    return requests.map((request) => `<article class="reset-row" data-reset="${escape(request.id)}"><div><strong>${escape(request.user?.name || request.user?.username || "Хэрэглэгч")}</strong><small>${escape(request.user?.username || "")} · ${escape(request.user?.phone || "")}</small></div><div><span class="badge reset_pending">Сэргээх хүсэлт</span><small>Илгээсэн: ${escape(date(request.createdAt))}</small></div><div class="actions"><button class="success" data-reset-action="approve-reset">Зөвшөөрөх</button><button class="danger" data-reset-action="reject-reset">Цуцлах</button></div></article>`).join("");
  }

  async function renderAdmin() {
    clearInterval(pollTimer);
    try {
      const data = await api("/api/admin");
      app.classList.add("wide");
      const active = data.users.filter((user) => user.status === "active").length;
      const totalPending = data.pendingCount + data.resetPendingCount;
      app.innerHTML = `<header class="admin-top"><div><span class="eyebrow">АДМИН ХЭСЭГ</span><h1>Хэрэглэгчийн зөвшөөрөл</h1><p class="intro">Төлбөрийг банкны дансаар, нууц үг сэргээх хүсэлтийг бүртгэлтэй утсаар тус тус шалгана.</p></div><button class="secondary" id="logoutButton">Гарах</button></header>
        <div class="admin-metrics"><article><b>${data.pendingCount}</b><span>ТӨЛБӨР ШАЛГАХ</span></article><article><b>${data.resetPendingCount}</b><span>НУУЦ ҮГ СЭРГЭЭХ</span></article><article><b>${active}</b><span>ИДЭВХТЭЙ</span></article><article><b>${data.users.length}</b><span>НИЙТ ХЭРЭГЛЭГЧ</span></article></div>
        ${data.pendingCount ? `<div class="admin-alert">🔔 Баталгаажуулсан хэрэглэгч байна — ${data.pendingCount} төлбөрийг шалгана уу.</div>` : ""}
        ${data.resetPendingCount ? `<div class="admin-alert reset-alert">🔑 Нууц үг сэргээх хүсэлт байна — ${data.resetPendingCount} хэрэглэгчийн утсыг шалгана уу.</div>` : ""}
        <section class="admin-section"><h2>Нууц үг сэргээх хүсэлт</h2><p>Зөвшөөрөхөөс өмнө бүртгэлтэй утасны дугаараар хэрэглэгчийг баталгаажуулна.</p><div class="admin-list">${renderResetRows(data.resetRequests)}</div></section>
        <section class="admin-section"><h2>Төлбөр ба хэрэглэгчийн эрх</h2><div class="admin-list">${renderAdminRows(data.users)}</div></section>`;
      bindLogout();
      bindAdminActions();
      document.title = totalPending ? `(${totalPending}) Шалгах хүсэлт байна · Хулан админ` : "Хулан · Админ";
      pollTimer = setInterval(renderAdmin, 12000);
    } catch (error) {
      if (error.code === "ADMIN_REQUIRED") {
        current = null;
        tab = "admin";
        renderPublic();
      } else {
        toast(error.message);
      }
    }
  }

  function bindAdminActions() {
    document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", async () => {
      const row = button.closest("[data-user]");
      const action = button.dataset.action;
      const question = action === "approve" ? "Төлбөр дансанд орсныг шалгасан уу? Хэрэглэгчид 30 хоногийн эрх нээх үү?" : action === "reject" ? "Төлбөр ороогүй тул энэ хүсэлтийг цуцлах уу?" : "Хэрэглэгчийн нэвтрэх эрхийг цуцлах уу?";
      if (!confirm(question)) return;
      button.disabled = true;
      try {
        await api("/api/admin", { method: "POST", body: JSON.stringify({ action, userId: row.dataset.user }) });
        toast("Хэрэглэгчийн төлөв шинэчлэгдлээ.");
        await renderAdmin();
      } catch (error) {
        toast(error.message);
        button.disabled = false;
      }
    }));

    document.querySelectorAll("[data-reset-action]").forEach((button) => button.addEventListener("click", async () => {
      const row = button.closest("[data-reset]");
      const action = button.dataset.resetAction;
      const question = action === "approve-reset" ? "Бүртгэлтэй утасны дугаараар энэ хүнийг шалгаж баталгаажуулсан уу? Шинэ нууц үг тохируулахыг зөвшөөрөх үү?" : "Энэ нууц үг сэргээх хүсэлтийг цуцлах уу?";
      if (!confirm(question)) return;
      button.disabled = true;
      try {
        await api("/api/admin", { method: "POST", body: JSON.stringify({ action, resetRequestId: row.dataset.reset }) });
        toast(action === "approve-reset" ? "Шинэ нууц үг тохируулах эрх нээгдлээ." : "Сэргээх хүсэлтийг цуцаллаа.");
        await renderAdmin();
      } catch (error) {
        toast(error.message);
        button.disabled = false;
      }
    }));
  }

  async function start() {
    await clearOffline();
    try {
      current = await api("/api/auth?action=me");
      if (current.authenticated) {
        renderSession();
        return;
      }
      resetState = await api("/api/auth?action=reset-status");
      if (resetState.requested) renderResetState();
      else renderPublic();
    } catch (error) {
      app.innerHTML = `<div class="form-error">${escape(error.message)}</div>`;
    }
  }

  start();
})();
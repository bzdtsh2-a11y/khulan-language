import test from "node:test";
import assert from "node:assert/strict";
import authHandler from "../api/auth.js";
import adminHandler from "../api/admin.js";
import gatewayHandler from "../api/gateway.js";
import topikHandler from "../api/topik.js";
import { getUserById, hashPassword, resetMemoryStore, saveUser } from "../lib/auth-store.js";

class MockResponse {
  constructor() { this.headers = {}; this.statusCode = 200; this.body = ""; }
  setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; }
  getHeader(name) { return this.headers[String(name).toLowerCase()]; }
  end(value = "") { this.body = Buffer.isBuffer(value) ? value : String(value || ""); this.finished = true; }
  json() { return JSON.parse(String(this.body)); }
}

function request(method, url, body, cookie = "", ip = "") {
  return {
    method,
    url,
    body,
    headers: { host: "localhost:4330", origin: "http://localhost:4330", cookie },
    socket: { remoteAddress: ip || `127.0.0.${Math.floor(Math.random() * 200) + 1}` },
  };
}

async function call(handler, method, url, body, cookie = "", ip = "") {
  const response = new MockResponse();
  await handler(request(method, url, body, cookie, ip), response);
  return response;
}

function cookieFrom(response) {
  const header = response.getHeader("set-cookie");
  const first = Array.isArray(header) ? header[0] : header;
  return String(first).split(";")[0];
}

test("registration → payment → admin approval gates all content", async () => {
  resetMemoryStore();
  process.env.KHULAN_ADMIN_USERNAME = "admin";
  process.env.KHULAN_ADMIN_PASSWORD_HASH = await hashPassword("Admin-Strong-2026!");

  const publicRoot = await call(gatewayHandler, "GET", "/api/gateway?path=index.html");
  assert.equal(publicRoot.statusCode, 302);
  assert.equal(publicRoot.getHeader("location"), "/auth/");

  const registration = await call(authHandler, "POST", "/api/auth?action=register", {
    name: "Тест Хэрэглэгч",
    phone: "99112233",
    username: "learner01",
    password: "Learner-Strong-2026!",
  });
  assert.equal(registration.statusCode, 201, registration.body);
  const userCookie = cookieFrom(registration);
  const registered = registration.json();
  assert.equal(registered.user.status, "pending_payment");
  assert.equal("passwordHash" in registered.user, false);
  assert.deepEqual(registered.payment, {
    bank: "ХААН БАНК",
    account: "140005005041175502",
    accountName: "ИДЭР ХУЛАН",
    amount: 30000,
    durationDays: 30,
  });

  const pendingRoot = await call(gatewayHandler, "GET", "/api/gateway?path=index.html", undefined, userCookie);
  assert.equal(pendingRoot.statusCode, 302);
  const pendingTopik = await call(topikHandler, "GET", "/api/topik?action=overview", undefined, userCookie);
  assert.equal(pendingTopik.statusCode, 401);

  const submitted = await call(authHandler, "POST", "/api/auth?action=submit-payment", {}, userCookie);
  assert.equal(submitted.statusCode, 200, submitted.body);
  assert.equal(submitted.json().message, "Төлбөрийг шалгаж дуустал түр хүлээнэ үү.");
  assert.equal(submitted.json().user.status, "payment_submitted");

  const adminLogin = await call(authHandler, "POST", "/api/auth?action=login", {
    username: "admin",
    password: "Admin-Strong-2026!",
  });
  assert.equal(adminLogin.statusCode, 200, adminLogin.body);
  const adminCookie = cookieFrom(adminLogin);
  assert.equal(adminLogin.json().role, "admin");

  const adminList = await call(adminHandler, "GET", "/api/admin", undefined, adminCookie);
  assert.equal(adminList.statusCode, 200, adminList.body);
  assert.equal(adminList.json().pendingCount, 1);
  assert.equal("passwordHash" in adminList.json().users[0], false);
  const userId = adminList.json().users[0].id;

  const approval = await call(adminHandler, "POST", "/api/admin", { action: "approve", userId }, adminCookie);
  assert.equal(approval.statusCode, 200, approval.body);
  assert.equal(approval.json().user.status, "active");
  assert.ok(Date.parse(approval.json().user.accessUntil) > Date.now() + 29 * 24 * 60 * 60 * 1000);

  const approvedRoot = await call(gatewayHandler, "GET", "/api/gateway?path=index.html", undefined, userCookie);
  assert.equal(approvedRoot.statusCode, 200);
  assert.match(String(approvedRoot.body), /Гадаад хэлний ухаалаг туслах/);
  assert.equal(approvedRoot.getHeader("cache-control"), "private, no-store");

  const approvedTopik = await call(topikHandler, "GET", "/api/topik?action=overview", undefined, userCookie);
  assert.equal(approvedTopik.statusCode, 200, approvedTopik.body);
  assert.equal(approvedTopik.json().counts.vocabulary_unique, 588);

  const revocation = await call(adminHandler, "POST", "/api/admin", { action: "revoke", userId }, adminCookie);
  assert.equal(revocation.statusCode, 200, revocation.body);
  const revokedRoot = await call(gatewayHandler, "GET", "/api/gateway?path=index.html", undefined, userCookie);
  assert.equal(revokedRoot.statusCode, 302);
});

test("admin username is reserved and cannot fall back to a user account", async () => {
  resetMemoryStore();
  process.env.KHULAN_ADMIN_USERNAME = "owner";
  process.env.KHULAN_ADMIN_PASSWORD_HASH = await hashPassword("Owner-Strong-2026!");

  const legacyRegistration = await call(authHandler, "POST", "/api/auth?action=register", {
    name: "Хуучин Хэрэглэгч",
    phone: "99114455",
    username: "admin",
    password: "User-Strong-2026!",
  });
  assert.equal(legacyRegistration.statusCode, 201, legacyRegistration.body);

  process.env.KHULAN_ADMIN_USERNAME = "admin";
  process.env.KHULAN_ADMIN_PASSWORD_HASH = await hashPassword("Admin-Strong-2026!");

  const userPasswordLogin = await call(authHandler, "POST", "/api/auth?action=login", {
    username: "admin",
    password: "User-Strong-2026!",
  });
  assert.equal(userPasswordLogin.statusCode, 401, userPasswordLogin.body);

  const adminLogin = await call(authHandler, "POST", "/api/auth?action=login", {
    username: "admin",
    password: "Admin-Strong-2026!",
  });
  assert.equal(adminLogin.statusCode, 200, adminLogin.body);
  assert.equal(adminLogin.json().role, "admin");
  assert.equal(adminLogin.json().allowed, true);
  assert.equal(adminLogin.json().user, undefined);

  resetMemoryStore();
  const reservedRegistration = await call(authHandler, "POST", "/api/auth?action=register", {
    name: "Шинэ Хэрэглэгч",
    phone: "99115566",
    username: "admin",
    password: "Another-Strong-2026!",
  });
  assert.equal(reservedRegistration.statusCode, 409, reservedRegistration.body);
  assert.equal(reservedRegistration.json().error, "USERNAME_RESERVED");
});

test("unpaid confirmation can be rejected and never grants access", async () => {
  resetMemoryStore();
  process.env.KHULAN_ADMIN_USERNAME = "admin";
  process.env.KHULAN_ADMIN_PASSWORD_HASH = await hashPassword("Admin-Strong-2026!");
  const registration = await call(authHandler, "POST", "/api/auth?action=register", {
    name: "Төлбөргүй Хэрэглэгч",
    phone: "88112233",
    username: "unpaid01",
    password: "Unpaid-Strong-2026!",
  });
  const userCookie = cookieFrom(registration);
  await call(authHandler, "POST", "/api/auth?action=submit-payment", {}, userCookie);
  const adminLogin = await call(authHandler, "POST", "/api/auth?action=login", { username: "admin", password: "Admin-Strong-2026!" });
  const adminCookie = cookieFrom(adminLogin);
  const list = await call(adminHandler, "GET", "/api/admin", undefined, adminCookie);
  const userId = list.json().users[0].id;
  const rejected = await call(adminHandler, "POST", "/api/admin", { action: "reject", userId }, adminCookie);
  assert.equal(rejected.json().user.status, "payment_rejected");
  const denied = await call(gatewayHandler, "GET", "/api/gateway?path=index.html", undefined, userCookie);
  assert.equal(denied.statusCode, 302);
  const me = await call(authHandler, "GET", "/api/auth?action=me", undefined, userCookie);
  assert.equal(me.json().allowed, false);
  assert.equal(me.json().user.status, "payment_rejected");
});

test("expired access is denied and can submit a renewal", async () => {
  resetMemoryStore();
  process.env.KHULAN_ADMIN_USERNAME = "admin";
  process.env.KHULAN_ADMIN_PASSWORD_HASH = await hashPassword("Admin-Strong-2026!");
  const registration = await call(authHandler, "POST", "/api/auth?action=register", {
    name: "Хугацаа Дууссан",
    phone: "77112233",
    username: "expired01",
    password: "Expired-Strong-2026!",
  });
  const cookie = cookieFrom(registration);
  const id = registration.json().user.id;
  const user = await getUserById(id);
  user.status = "active";
  user.accessUntil = new Date(Date.now() - 1000).toISOString();
  await saveUser(user);
  const denied = await call(gatewayHandler, "GET", "/api/gateway?path=index.html", undefined, cookie);
  assert.equal(denied.statusCode, 302);
  const renewal = await call(authHandler, "POST", "/api/auth?action=submit-payment", {}, cookie);
  assert.equal(renewal.statusCode, 200, renewal.body);
  assert.equal(renewal.json().user.status, "payment_submitted");
});

test("duplicate username and invalid origin are rejected", async () => {
  resetMemoryStore();
  const data = { name: "Нэг Хүн", phone: "99110022", username: "sameuser", password: "Same-Strong-2026!" };
  const first = await call(authHandler, "POST", "/api/auth?action=register", data);
  assert.equal(first.statusCode, 201);
  const second = await call(authHandler, "POST", "/api/auth?action=register", data);
  assert.equal(second.statusCode, 409);
  const response = new MockResponse();
  const req = request("POST", "/api/auth?action=login", { username: "sameuser", password: data.password });
  req.headers.origin = "https://evil.example";
  await authHandler(req, response);
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error, "ORIGIN_NOT_ALLOWED");
});

test("login rate limit is isolated by username on the same IP", async () => {
  resetMemoryStore();
  process.env.KHULAN_ADMIN_USERNAME = "admin";
  process.env.KHULAN_ADMIN_PASSWORD_HASH = await hashPassword("Admin-Strong-2026!");
  const ip = "10.20.30.40";

  let blocked;
  for (let index = 0; index < 13; index += 1) {
    blocked = await call(authHandler, "POST", "/api/auth?action=login", {
      username: "unknown-user",
      password: "Incorrect-Password!",
    }, "", ip);
  }
  assert.equal(blocked.statusCode, 429, blocked.body);

  const adminLogin = await call(authHandler, "POST", "/api/auth?action=login", {
    username: "admin",
    password: "Admin-Strong-2026!",
  }, "", ip);
  assert.equal(adminLogin.statusCode, 200, adminLogin.body);
  assert.equal(adminLogin.json().role, "admin");
});

test("admin-approved password recovery changes password and invalidates old sessions", async () => {
  resetMemoryStore();
  process.env.KHULAN_ADMIN_USERNAME = "admin";
  process.env.KHULAN_ADMIN_PASSWORD_HASH = await hashPassword("Admin-Strong-2026!");

  const registration = await call(authHandler, "POST", "/api/auth?action=register", {
    name: "Сэргээх Хэрэглэгч",
    phone: "99113344",
    username: "recover01",
    password: "Original-Strong-2026!",
  });
  assert.equal(registration.statusCode, 201, registration.body);
  const oldSessionCookie = cookieFrom(registration);

  const requested = await call(authHandler, "POST", "/api/auth?action=request-password-reset", {
    username: "recover01",
    phone: "99113344",
  });
  assert.equal(requested.statusCode, 201, requested.body);
  assert.equal(requested.json().status, "pending");
  const resetCookie = cookieFrom(requested);
  assert.match(resetCookie, /khulan_reset=/);

  const pendingStatus = await call(authHandler, "GET", "/api/auth?action=reset-status", undefined, resetCookie);
  assert.equal(pendingStatus.statusCode, 200, pendingStatus.body);
  assert.equal(pendingStatus.json().status, "pending");

  const adminLogin = await call(authHandler, "POST", "/api/auth?action=login", {
    username: "admin",
    password: "Admin-Strong-2026!",
  });
  const adminCookie = cookieFrom(adminLogin);
  const adminList = await call(adminHandler, "GET", "/api/admin", undefined, adminCookie);
  assert.equal(adminList.statusCode, 200, adminList.body);
  assert.equal(adminList.json().resetPendingCount, 1);
  assert.equal(adminList.json().resetRequests[0].user.phone, "99113344");
  const resetRequestId = adminList.json().resetRequests[0].id;

  const approved = await call(adminHandler, "POST", "/api/admin", {
    action: "approve-reset",
    resetRequestId,
  }, adminCookie);
  assert.equal(approved.statusCode, 200, approved.body);
  assert.equal(approved.json().resetRequest.status, "approved");

  const approvedStatus = await call(authHandler, "GET", "/api/auth?action=reset-status", undefined, resetCookie);
  assert.equal(approvedStatus.json().status, "approved");

  const completed = await call(authHandler, "POST", "/api/auth?action=reset-password", {
    password: "Replacement-Strong-2026!",
    confirmPassword: "Replacement-Strong-2026!",
  }, resetCookie);
  assert.equal(completed.statusCode, 200, completed.body);

  const oldSession = await call(authHandler, "GET", "/api/auth?action=me", undefined, oldSessionCookie);
  assert.equal(oldSession.json().authenticated, false);

  const oldPassword = await call(authHandler, "POST", "/api/auth?action=login", {
    username: "recover01",
    password: "Original-Strong-2026!",
  });
  assert.equal(oldPassword.statusCode, 401, oldPassword.body);

  const newPassword = await call(authHandler, "POST", "/api/auth?action=login", {
    username: "recover01",
    password: "Replacement-Strong-2026!",
  });
  assert.equal(newPassword.statusCode, 200, newPassword.body);
  assert.equal(newPassword.json().user.username, "recover01");
});

test("rejected password recovery never permits a password change", async () => {
  resetMemoryStore();
  process.env.KHULAN_ADMIN_USERNAME = "admin";
  process.env.KHULAN_ADMIN_PASSWORD_HASH = await hashPassword("Admin-Strong-2026!");

  await call(authHandler, "POST", "/api/auth?action=register", {
    name: "Цуцлах Хэрэглэгч",
    phone: "88113344",
    username: "rejectreset01",
    password: "Original-Strong-2026!",
  });
  const requested = await call(authHandler, "POST", "/api/auth?action=request-password-reset", {
    username: "rejectreset01",
    phone: "88113344",
  });
  const resetCookie = cookieFrom(requested);

  const adminLogin = await call(authHandler, "POST", "/api/auth?action=login", {
    username: "admin",
    password: "Admin-Strong-2026!",
  });
  const adminCookie = cookieFrom(adminLogin);
  const adminList = await call(adminHandler, "GET", "/api/admin", undefined, adminCookie);
  const resetRequestId = adminList.json().resetRequests[0].id;
  const rejected = await call(adminHandler, "POST", "/api/admin", {
    action: "reject-reset",
    resetRequestId,
  }, adminCookie);
  assert.equal(rejected.json().resetRequest.status, "rejected");

  const rejectedStatus = await call(authHandler, "GET", "/api/auth?action=reset-status", undefined, resetCookie);
  assert.equal(rejectedStatus.json().status, "rejected");
  const denied = await call(authHandler, "POST", "/api/auth?action=reset-password", {
    password: "Replacement-Strong-2026!",
    confirmPassword: "Replacement-Strong-2026!",
  }, resetCookie);
  assert.equal(denied.statusCode, 409, denied.body);
  assert.equal(denied.json().error, "RESET_NOT_APPROVED");
});

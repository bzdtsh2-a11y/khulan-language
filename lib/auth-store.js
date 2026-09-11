import crypto from "node:crypto";
import { promisify } from "node:util";
import { Redis } from "@upstash/redis";

const scryptAsync = promisify(crypto.scrypt);
const USER_SET = "khulan:users";
const PAYMENT_SET = "khulan:payments:pending";
const RESET_SET = "khulan:password-resets:pending";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
const RESET_TTL_SECONDS = 24 * 60 * 60;

export class AppError extends Error {
  constructor(message, status = 400, code = "INVALID_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

class MemoryStore {
  constructor() {
    globalThis.__khulanMemoryStore ||= { values: new Map(), sets: new Map(), expiry: new Map() };
    this.data = globalThis.__khulanMemoryStore;
  }
  cleanup(key) {
    const expiresAt = this.data.expiry.get(key);
    if (expiresAt && expiresAt <= Date.now()) {
      this.data.values.delete(key);
      this.data.sets.delete(key);
      this.data.expiry.delete(key);
    }
  }
  async get(key) { this.cleanup(key); return this.data.values.get(key) ?? null; }
  async set(key, value, options = {}) {
    this.cleanup(key);
    if (options.nx && this.data.values.has(key)) return null;
    this.data.values.set(key, value);
    if (options.ex) this.data.expiry.set(key, Date.now() + Number(options.ex) * 1000);
    return "OK";
  }
  async del(...keys) {
    let count = 0;
    for (const key of keys.flat()) {
      count += this.data.values.delete(key) ? 1 : 0;
      count += this.data.sets.delete(key) ? 1 : 0;
      this.data.expiry.delete(key);
    }
    return count;
  }
  async sadd(key, ...members) {
    this.cleanup(key);
    const set = this.data.sets.get(key) || new Set();
    let added = 0;
    for (const member of members.flat()) {
      if (!set.has(member)) { set.add(member); added += 1; }
    }
    this.data.sets.set(key, set);
    return added;
  }
  async srem(key, ...members) {
    this.cleanup(key);
    const set = this.data.sets.get(key) || new Set();
    let removed = 0;
    for (const member of members.flat()) removed += set.delete(member) ? 1 : 0;
    return removed;
  }
  async smembers(key) { this.cleanup(key); return [...(this.data.sets.get(key) || [])]; }
  async incr(key) {
    this.cleanup(key);
    const next = Number(this.data.values.get(key) || 0) + 1;
    this.data.values.set(key, next);
    return next;
  }
  async expire(key, seconds) {
    this.data.expiry.set(key, Date.now() + Number(seconds) * 1000);
    return 1;
  }
}

let store;
export function getStore() {
  if (store) return store;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    store = Redis.fromEnv();
    return store;
  }
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    store = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    return store;
  }
  if (process.env.VERCEL) throw new AppError("Persistent storage is not configured", 503, "STORAGE_NOT_CONFIGURED");
  store = new MemoryStore();
  return store;
}

export function resetMemoryStore() {
  globalThis.__khulanMemoryStore = { values: new Map(), sets: new Map(), expiry: new Map() };
  store = new MemoryStore();
}

const normalizeUsername = (value = "") => String(value).normalize("NFKC").trim().toLowerCase();
const normalizePhone = (value = "") => String(value).trim().replace(/\s+/g, "");
const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const parseRecord = (value) => !value ? null : typeof value === "string" ? JSON.parse(value) : value;
const userKey = (id) => `khulan:user:${id}`;
const usernameKey = (username) => `khulan:username:${normalizeUsername(username)}`;
const sessionKey = (token) => `khulan:session:${sha256(token)}`;
const resetRequestKey = (id) => `khulan:password-reset-request:${id}`;
const resetTokenKey = (token) => `khulan:password-reset-token:${sha256(token)}`;
const resetUserKey = (userId) => `khulan:password-reset-user:${userId}`;

export function rateLimitIdentity(value) {
  return sha256(normalizeUsername(value) || "unknown").slice(0, 20);
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
}

export async function verifyPassword(password, encoded = "") {
  try {
    const [algorithm, n, r, p, salt, expected] = encoded.split("$");
    if (algorithm !== "scrypt") return false;
    const actual = await scryptAsync(String(password), Buffer.from(salt, "base64url"), 64, {
      N: Number(n), r: Number(r), p: Number(p),
    });
    const expectedBuffer = Buffer.from(expected, "base64url");
    return expectedBuffer.length === actual.length && crypto.timingSafeEqual(expectedBuffer, actual);
  } catch {
    return false;
  }
}

function validatePassword(password, confirmation) {
  const value = String(password || "");
  if (value.length < 10 || value.length > 128) {
    throw new AppError("Нууц үг хамгийн багадаа 10 тэмдэгт байна.", 400, "WEAK_PASSWORD");
  }
  if (confirmation !== undefined && value !== String(confirmation || "")) {
    throw new AppError("Нууц үг давталт тохирохгүй байна.", 400, "PASSWORD_MISMATCH");
  }
  return value;
}

export function validateRegistration(input = {}) {
  const username = normalizeUsername(input.username);
  const name = String(input.name || "").normalize("NFKC").trim().replace(/\s+/g, " ");
  const phone = normalizePhone(input.phone);
  const password = validatePassword(input.password);
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new AppError("Нэвтрэх нэр 3–40 тэмдэгт, латин үсэг ба тоо байна.", 400, "INVALID_USERNAME");
  if (name.length < 2 || name.length > 80) throw new AppError("Нэрээ 2–80 тэмдэгтээр оруулна уу.", 400, "INVALID_NAME");
  if (!/^[+0-9-]{8,20}$/.test(phone)) throw new AppError("Утасны дугаараа зөв оруулна уу.", 400, "INVALID_PHONE");
  return { username, name, phone, password };
}

export async function createUser(input) {
  const clean = validateRegistration(input);
  const adminUsername = normalizeUsername(process.env.KHULAN_ADMIN_USERNAME || "admin");
  if (clean.username === adminUsername) {
    throw new AppError("Энэ нэвтрэх нэрийг ашиглах боломжгүй.", 409, "USERNAME_RESERVED");
  }
  const db = getStore();
  const id = `usr_${crypto.randomUUID()}`;
  const reserved = await db.set(usernameKey(clean.username), id, { nx: true });
  if (!reserved) throw new AppError("Энэ нэвтрэх нэр бүртгэлтэй байна.", 409, "USERNAME_EXISTS");
  try {
    const now = new Date().toISOString();
    const user = {
      id,
      role: "user",
      username: clean.username,
      name: clean.name,
      phone: clean.phone,
      passwordHash: await hashPassword(clean.password),
      authVersion: 0,
      status: "pending_payment",
      paymentAttempts: 0,
      accessUntil: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.set(userKey(id), JSON.stringify(user));
    await db.sadd(USER_SET, id);
    return user;
  } catch (error) {
    await db.del(usernameKey(clean.username));
    throw error;
  }
}

export async function getUserById(id) {
  if (!id) return null;
  return parseRecord(await getStore().get(userKey(id)));
}

export async function findUserByUsername(username) {
  const id = await getStore().get(usernameKey(username));
  return id ? getUserById(id) : null;
}

export async function saveUser(user) {
  user.updatedAt = new Date().toISOString();
  await getStore().set(userKey(user.id), JSON.stringify(user));
  return user;
}

export function effectiveStatus(user) {
  if (user?.status === "active" && (!user.accessUntil || Date.parse(user.accessUntil) <= Date.now())) return "expired";
  return user?.status || "unknown";
}

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, authVersion, ...safe } = user;
  return { ...safe, status: effectiveStatus(user) };
}

export async function listUsers() {
  const ids = await getStore().smembers(USER_SET);
  const users = [];
  for (const id of ids) {
    const user = await getUserById(id);
    if (user) users.push(publicUser(user));
  }
  const rank = { payment_submitted: 0, pending_payment: 1, payment_rejected: 2, expired: 3, active: 4, revoked: 5 };
  return users.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || String(b.paymentSubmittedAt || b.createdAt).localeCompare(String(a.paymentSubmittedAt || a.createdAt)));
}

export async function submitPayment(user) {
  const status = effectiveStatus(user);
  if (!["pending_payment", "payment_rejected", "expired"].includes(status)) {
    throw new AppError("Төлбөр баталгаажуулах боломжгүй төлөв байна.", 409, "INVALID_ACCOUNT_STATUS");
  }
  user.status = "payment_submitted";
  user.paymentSubmittedAt = new Date().toISOString();
  user.paymentAttempts = Number(user.paymentAttempts || 0) + 1;
  delete user.paymentRejectedAt;
  await saveUser(user);
  await getStore().sadd(PAYMENT_SET, user.id);
  return user;
}

export async function approveUser(id, adminUsername) {
  const user = await getUserById(id);
  if (!user) throw new AppError("Хэрэглэгч олдсонгүй.", 404, "USER_NOT_FOUND");
  if (user.status !== "payment_submitted") throw new AppError("Зөвхөн төлбөр баталгаажуулсан хүсэлтийг зөвшөөрнө.", 409, "PAYMENT_NOT_SUBMITTED");
  const now = Date.now();
  const base = user.accessUntil && Date.parse(user.accessUntil) > now ? Date.parse(user.accessUntil) : now;
  user.status = "active";
  user.accessUntil = new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString();
  user.paymentApprovedAt = new Date(now).toISOString();
  user.approvedBy = adminUsername;
  await saveUser(user);
  await getStore().srem(PAYMENT_SET, user.id);
  return user;
}

export async function rejectPayment(id, adminUsername) {
  const user = await getUserById(id);
  if (!user) throw new AppError("Хэрэглэгч олдсонгүй.", 404, "USER_NOT_FOUND");
  user.status = "payment_rejected";
  user.paymentRejectedAt = new Date().toISOString();
  user.rejectedBy = adminUsername;
  await saveUser(user);
  await getStore().srem(PAYMENT_SET, user.id);
  return user;
}

export async function revokeUser(id, adminUsername) {
  const user = await getUserById(id);
  if (!user) throw new AppError("Хэрэглэгч олдсонгүй.", 404, "USER_NOT_FOUND");
  user.status = "revoked";
  user.accessUntil = null;
  user.authVersion = Number(user.authVersion || 0) + 1;
  user.revokedAt = new Date().toISOString();
  user.revokedBy = adminUsername;
  await saveUser(user);
  await getStore().srem(PAYMENT_SET, user.id);
  return user;
}

function resetPublic(record, user = null) {
  if (!record) return { requested: false };
  return {
    requested: true,
    id: record.id,
    status: record.status,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    approvedAt: record.approvedAt || null,
    rejectedAt: record.rejectedAt || null,
    completedAt: record.completedAt || null,
    user: user ? publicUser(user) : undefined,
  };
}

async function saveResetRequest(record) {
  const ttl = Math.max(60, Math.ceil((Date.parse(record.expiresAt) - Date.now()) / 1000));
  await getStore().set(resetRequestKey(record.id), JSON.stringify(record), { ex: ttl });
  return record;
}

export async function createPasswordResetRequest(input = {}) {
  const username = normalizeUsername(input.username);
  const phone = normalizePhone(input.phone);
  if (!/^[a-z0-9._-]{3,40}$/.test(username) || !/^[+0-9-]{8,20}$/.test(phone)) {
    throw new AppError("Нэвтрэх нэр эсвэл утасны дугаар тохирохгүй байна.", 400, "RECOVERY_DETAILS_INVALID");
  }
  const user = await findUserByUsername(username);
  if (!user || normalizePhone(user.phone) !== phone) {
    throw new AppError("Нэвтрэх нэр эсвэл утасны дугаар тохирохгүй байна.", 404, "RECOVERY_DETAILS_INVALID");
  }
  if (user.status === "revoked") throw new AppError("Энэ бүртгэлийн эрхийг админ цуцалсан байна.", 403, "ACCOUNT_REVOKED");

  const db = getStore();
  const previousId = await db.get(resetUserKey(user.id));
  if (previousId) {
    await db.srem(RESET_SET, previousId);
    await db.del(resetRequestKey(previousId));
  }

  const id = `rst_${crypto.randomUUID()}`;
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  const record = {
    id,
    userId: user.id,
    status: "pending",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + RESET_TTL_SECONDS * 1000).toISOString(),
  };
  await saveResetRequest(record);
  await db.set(resetTokenKey(token), id, { ex: RESET_TTL_SECONDS });
  await db.set(resetUserKey(user.id), id, { ex: RESET_TTL_SECONDS });
  await db.sadd(RESET_SET, id);
  return { token, request: resetPublic(record, user) };
}

async function getResetRequestById(id) {
  if (!id) return null;
  return parseRecord(await getStore().get(resetRequestKey(id)));
}

async function getResetRequestByToken(token) {
  if (!token) return null;
  const id = await getStore().get(resetTokenKey(token));
  return id ? getResetRequestById(id) : null;
}

export async function listPasswordResetRequests() {
  const db = getStore();
  const ids = await db.smembers(RESET_SET);
  const requests = [];
  for (const id of ids) {
    const record = await getResetRequestById(id);
    if (!record || record.status !== "pending" || Date.parse(record.expiresAt) <= Date.now()) {
      await db.srem(RESET_SET, id);
      continue;
    }
    const user = await getUserById(record.userId);
    if (user) requests.push(resetPublic(record, user));
  }
  return requests.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function approvePasswordReset(id, adminUsername) {
  const record = await getResetRequestById(id);
  if (!record) throw new AppError("Нууц үг сэргээх хүсэлт олдсонгүй.", 404, "RESET_REQUEST_NOT_FOUND");
  if (record.status !== "pending" || Date.parse(record.expiresAt) <= Date.now()) {
    throw new AppError("Энэ сэргээх хүсэлт хүчинтэй биш байна.", 409, "RESET_REQUEST_INVALID");
  }
  record.status = "approved";
  record.approvedAt = new Date().toISOString();
  record.approvedBy = adminUsername;
  await saveResetRequest(record);
  await getStore().srem(RESET_SET, record.id);
  return resetPublic(record, await getUserById(record.userId));
}

export async function rejectPasswordReset(id, adminUsername) {
  const record = await getResetRequestById(id);
  if (!record) throw new AppError("Нууц үг сэргээх хүсэлт олдсонгүй.", 404, "RESET_REQUEST_NOT_FOUND");
  if (record.status !== "pending") throw new AppError("Энэ сэргээх хүсэлт аль хэдийн шийдэгдсэн байна.", 409, "RESET_REQUEST_INVALID");
  record.status = "rejected";
  record.rejectedAt = new Date().toISOString();
  record.rejectedBy = adminUsername;
  await saveResetRequest(record);
  await getStore().srem(RESET_SET, record.id);
  return resetPublic(record, await getUserById(record.userId));
}

export async function completePasswordReset(token, password, confirmation) {
  const record = await getResetRequestByToken(token);
  if (!record || record.status !== "approved" || Date.parse(record.expiresAt) <= Date.now()) {
    throw new AppError("Нууц үг сэргээх зөвшөөрөл хүчингүй эсвэл хугацаа дууссан байна.", 409, "RESET_NOT_APPROVED");
  }
  const user = await getUserById(record.userId);
  if (!user || user.status === "revoked") throw new AppError("Бүртгэл ашиглах боломжгүй байна.", 403, "ACCOUNT_REVOKED");
  const cleanPassword = validatePassword(password, confirmation);
  user.passwordHash = await hashPassword(cleanPassword);
  user.authVersion = Number(user.authVersion || 0) + 1;
  user.passwordChangedAt = new Date().toISOString();
  await saveUser(user);

  record.status = "completed";
  record.completedAt = new Date().toISOString();
  await saveResetRequest(record);
  const db = getStore();
  await db.srem(RESET_SET, record.id);
  await db.del(resetTokenKey(token), resetUserKey(user.id));
  return publicUser(user);
}

const cookiePairs = (header = "") => Object.fromEntries(String(header).split(";").map((item) => item.trim()).filter(Boolean).map((item) => {
  const index = item.indexOf("=");
  return index < 0 ? [item, ""] : [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
}));

function secureRequest(request) {
  const proto = String(request.headers?.["x-forwarded-proto"] || "").split(",")[0].trim();
  const host = String(request.headers?.["x-forwarded-host"] || request.headers?.host || "");
  return proto === "https" || (!/^(localhost|127\.0\.0\.1)(:|$)/i.test(host) && process.env.VERCEL === "1");
}

export async function createSession(response, request, payload) {
  const token = crypto.randomBytes(32).toString("base64url");
  const ttl = payload.role === "admin" ? ADMIN_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS;
  const session = { ...payload, createdAt: new Date().toISOString() };
  if (session.role === "user" && session.authVersion === undefined) {
    const user = await getUserById(session.userId);
    session.authVersion = Number(user?.authVersion || 0);
  }
  await getStore().set(sessionKey(token), JSON.stringify(session), { ex: ttl });
  const secure = secureRequest(request);
  const name = secure ? "__Host-khulan_session" : "khulan_session";
  response.setHeader("Set-Cookie", `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttl}${secure ? "; Secure" : ""}`);
  return token;
}

export async function destroySession(response, request) {
  const cookies = cookiePairs(request.headers?.cookie);
  const token = cookies["__Host-khulan_session"] || cookies.khulan_session;
  if (token) await getStore().del(sessionKey(token));
  response.setHeader("Set-Cookie", [
    "khulan_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
    "__Host-khulan_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure",
  ]);
}

export function setPasswordResetCookie(response, request, token) {
  const secure = secureRequest(request);
  const name = secure ? "__Host-khulan_reset" : "khulan_reset";
  response.setHeader("Set-Cookie", `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${RESET_TTL_SECONDS}${secure ? "; Secure" : ""}`);
}

export function clearPasswordResetCookie(response) {
  response.setHeader("Set-Cookie", [
    "khulan_reset=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
    "__Host-khulan_reset=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure",
  ]);
}

export async function getPasswordResetContext(request) {
  const cookies = cookiePairs(request.headers?.cookie);
  const token = cookies["__Host-khulan_reset"] || cookies.khulan_reset;
  const record = await getResetRequestByToken(token);
  if (!record || Date.parse(record.expiresAt) <= Date.now()) return { token: null, request: { requested: false } };
  return { token, request: resetPublic(record) };
}

export async function getAuthContext(request) {
  const cookies = cookiePairs(request.headers?.cookie);
  const token = cookies["__Host-khulan_session"] || cookies.khulan_session;
  if (!token) return { authenticated: false, allowed: false, role: null, user: null };
  const session = parseRecord(await getStore().get(sessionKey(token)));
  if (!session) return { authenticated: false, allowed: false, role: null, user: null };
  if (session.role === "admin") return { authenticated: true, allowed: true, role: "admin", adminUsername: session.username, user: null };
  const user = await getUserById(session.userId);
  if (!user || user.status === "revoked" || Number(session.authVersion || 0) !== Number(user.authVersion || 0)) {
    return { authenticated: false, allowed: false, role: null, user: null };
  }
  const status = effectiveStatus(user);
  return { authenticated: true, allowed: status === "active", role: "user", user, status };
}

export async function authenticateCredentials(username, password) {
  const normalized = normalizeUsername(username);
  const adminUsername = normalizeUsername(process.env.KHULAN_ADMIN_USERNAME || "admin");
  const adminHash = process.env.KHULAN_ADMIN_PASSWORD_HASH;
  if (normalized === adminUsername) {
    if (adminHash && await verifyPassword(password, adminHash)) {
      return { role: "admin", username: adminUsername };
    }
    throw new AppError("Нэвтрэх нэр эсвэл нууц үг буруу байна.", 401, "INVALID_CREDENTIALS");
  }
  const user = await findUserByUsername(normalized);
  if (!user || !await verifyPassword(password, user.passwordHash)) throw new AppError("Нэвтрэх нэр эсвэл нууц үг буруу байна.", 401, "INVALID_CREDENTIALS");
  if (user.status === "revoked") throw new AppError("Энэ бүртгэлийн нэвтрэх эрхийг админ цуцалсан байна.", 403, "ACCOUNT_REVOKED");
  return { role: "user", user };
}

export async function rateLimit(request, bucket, max = 10, windowSeconds = 60) {
  const ip = String(request.headers?.["x-forwarded-for"] || request.headers?.["x-real-ip"] || request.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const bucketHash = sha256(bucket || "default").slice(0, 24);
  const key = `khulan:rate:${bucketHash}:${sha256(ip).slice(0, 24)}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
  const count = await getStore().incr(key);
  if (count === 1) await getStore().expire(key, windowSeconds + 5);
  if (count > max) throw new AppError("Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу.", 429, "RATE_LIMITED");
}

export function assertSameOrigin(request) {
  const origin = request.headers?.origin;
  if (!origin) return;
  const host = String(request.headers?.["x-forwarded-host"] || request.headers?.host || "").split(",")[0].trim();
  try {
    if (new URL(origin).host !== host) throw new Error("mismatch");
  } catch {
    throw new AppError("Хүсэлтийн эх үүсвэр зөвшөөрөгдөөгүй.", 403, "ORIGIN_NOT_ALLOWED");
  }
}

export async function readJsonBody(request, maxBytes = 16_384) {
  let parsedBody;
  try {
    parsedBody = request.body;
  } catch {
    throw new AppError("JSON хүсэлт буруу байна.", 400, "INVALID_JSON");
  }
  if (parsedBody && typeof parsedBody === "object" && !Buffer.isBuffer(parsedBody)) return parsedBody;
  let raw = typeof parsedBody === "string" ? parsedBody : Buffer.isBuffer(parsedBody) ? parsedBody.toString("utf8") : "";
  if (!raw) {
    for await (const chunk of request) {
      raw += chunk;
      if (Buffer.byteLength(raw) > maxBytes) throw new AppError("Хүсэлт хэт том байна.", 413, "BODY_TOO_LARGE");
    }
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new AppError("JSON хүсэлт буруу байна.", 400, "INVALID_JSON"); }
}

export function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "same-origin");
  response.end(JSON.stringify(payload));
}

export function sendError(response, error) {
  const status = Number(error?.status) || 500;
  const code = error?.code || "SERVER_ERROR";
  if (status >= 500) console.error("[khulan-auth]", code, error?.stack || error);
  return sendJson(response, status, { error: code, message: status >= 500 ? "Серверийн алдаа гарлаа." : error.message });
}

export const paymentInfo = Object.freeze({
  bank: "ХААН БАНК",
  account: "140005005041175502",
  accountName: "ИДЭР ХУЛАН",
  amount: 30000,
  durationDays: 30,
});

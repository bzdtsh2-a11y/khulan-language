import {
  getChapter2Overview,
  getChapter2Section,
  validateChapter2Content,
} from "../lib/topik-ch02-content.js";
import {
  checkQuizAnswer,
  getOverview,
  getSection,
  listQuizzes,
  searchVocabulary,
  validateContent,
} from "../lib/topik-content.js";

const rateBuckets = new Map();
const RATE_LIMIT = 120;
const WINDOW_MS = 60_000;

function clientKey(request) {
  return String(
    request.headers?.["x-forwarded-for"] ||
    request.headers?.["x-real-ip"] ||
    request.socket?.remoteAddress ||
    "anonymous",
  ).split(",")[0].trim();
}

function allowed(request) {
  const now = Date.now();
  const key = clientKey(request);
  const current = rateBuckets.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= RATE_LIMIT;
}

function json(response, status, payload, cache = "no-store") {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cache);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 16_384) throw new Error("BODY_TOO_LARGE");
  }
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(request, response) {
  if (!allowed(request)) {
    response.setHeader("Retry-After", "60");
    return json(response, 429, { error: "RATE_LIMITED" });
  }

  const url = new URL(request.url || "/api/topik", `http://${request.headers?.host || "localhost"}`);
  const action = url.searchParams.get("action") || "overview";

  try {
    if (request.method === "GET" && action === "overview") {
      return json(response, 200, getOverview(), "private, max-age=60");
    }
    if (request.method === "GET" && action === "section") {
      const section = getSection(url.searchParams.get("name"));
      return section
        ? json(response, 200, section, "private, max-age=60")
        : json(response, 404, { error: "SECTION_NOT_FOUND" });
    }
    if (request.method === "GET" && action === "chapter2") {
      const sectionName = url.searchParams.get("section") || "overview";
      const section = sectionName === "overview" ? getChapter2Overview() : getChapter2Section(sectionName);
      return section
        ? json(response, 200, section, "private, max-age=60")
        : json(response, 404, { error: "CHAPTER2_SECTION_NOT_FOUND" });
    }
    if (request.method === "GET" && action === "chapter2-health") {
      return json(response, 200, validateChapter2Content(), "no-store");
    }
    if (request.method === "GET" && action === "vocabulary") {
      return json(response, 200, searchVocabulary({
        query: url.searchParams.get("q") || "",
        category: url.searchParams.get("category") || "all",
        page: url.searchParams.get("page") || 1,
        limit: url.searchParams.get("limit") || 40,
      }), "private, max-age=30");
    }
    if (request.method === "GET" && action === "quizzes") {
      const ids = (url.searchParams.get("ids") || "").split(",").filter(Boolean).slice(0, 68);
      return json(response, 200, {
        items: listQuizzes({ section: url.searchParams.get("section") || "all", ids }),
      });
    }
    if (request.method === "GET" && action === "health") {
      return json(response, 200, validateContent(), "no-store");
    }
    if (request.method === "POST" && action === "answer") {
      const body = await readBody(request);
      const result = checkQuizAnswer(body.quizId, body.selectedOption);
      return result
        ? json(response, 200, result)
        : json(response, 404, { error: "QUIZ_NOT_FOUND" });
    }
    return json(response, 405, { error: "METHOD_OR_ACTION_NOT_ALLOWED" });
  } catch (error) {
    const status = error?.message === "BODY_TOO_LARGE" ? 413 : 400;
    return json(response, status, { error: status === 413 ? "BODY_TOO_LARGE" : "INVALID_REQUEST" });
  }
}

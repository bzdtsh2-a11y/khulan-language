import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAuthContext } from "../lib/auth-store.js";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(projectRoot, "public");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
};

function reject(response, wantsHtml) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (wantsHtml) {
    response.statusCode = 302;
    response.setHeader("Location", "/auth/");
    response.end();
  } else {
    response.statusCode = 401;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: "ACCESS_NOT_APPROVED" }));
  }
}

export default async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.statusCode = 405;
    response.end("Method not allowed");
    return;
  }
  const url = new URL(request.url || "/", `http://${request.headers?.host || "localhost"}`);
  let requested = url.searchParams.get("path") || "index.html";
  try { requested = decodeURIComponent(requested); } catch { requested = ""; }
  requested = requested.replace(/^[/\\]+/, "") || "index.html";
  const extension = path.extname(requested).toLowerCase();
  const wantsHtml = !extension || extension === ".html" || String(request.headers?.accept || "").includes("text/html");
  const auth = await getAuthContext(request);
  if (!auth.allowed) return reject(response, wantsHtml);
  if (requested.startsWith("auth/") || requested.includes("\0")) {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }
  const file = path.resolve(publicDir, requested);
  const withinPublic = file === publicDir || file.startsWith(`${publicDir}${path.sep}`);
  if (!withinPublic) {
    response.statusCode = 403;
    response.end("Forbidden");
    return;
  }
  try {
    const body = await fs.readFile(file);
    response.statusCode = 200;
    response.setHeader("Content-Type", mime[extension] || "application/octet-stream");
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    // Interactive lessons are rendered in same-origin iframes by the main app.
    // Keep cross-origin embedding blocked while allowing that lesson flow.
    response.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
    response.setHeader("X-Frame-Options", "SAMEORIGIN");
    response.setHeader("Referrer-Policy", "same-origin");
    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.statusCode = 404;
    response.end("Not found");
  }
}

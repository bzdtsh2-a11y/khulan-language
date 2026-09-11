import {
  AppError,
  assertSameOrigin,
  authenticateCredentials,
  clearPasswordResetCookie,
  completePasswordReset,
  createPasswordResetRequest,
  createSession,
  createUser,
  destroySession,
  getAuthContext,
  getPasswordResetContext,
  paymentInfo,
  publicUser,
  rateLimit,
  rateLimitIdentity,
  readJsonBody,
  sendError,
  sendJson,
  setPasswordResetCookie,
  submitPayment,
} from "../lib/auth-store.js";

export default async function handler(request, response) {
  const url = new URL(request.url || "/api/auth", `http://${request.headers?.host || "localhost"}`);
  const action = url.searchParams.get("action") || "me";
  try {
    if (request.method === "GET" && action === "me") {
      const auth = await getAuthContext(request);
      return sendJson(response, 200, {
        authenticated: auth.authenticated,
        allowed: auth.allowed,
        role: auth.role,
        adminUsername: auth.adminUsername || null,
        user: publicUser(auth.user),
        payment: paymentInfo,
      });
    }

    if (request.method === "GET" && action === "reset-status") {
      const reset = await getPasswordResetContext(request);
      return sendJson(response, 200, reset.request);
    }

    if (request.method !== "POST") throw new AppError("Арга зөвшөөрөгдөөгүй.", 405, "METHOD_NOT_ALLOWED");
    assertSameOrigin(request);

    if (action === "register") {
      await rateLimit(request, "register", 5, 15 * 60);
      const body = await readJsonBody(request);
      const user = await createUser(body);
      await createSession(response, request, { role: "user", userId: user.id });
      return sendJson(response, 201, { authenticated: true, allowed: false, role: "user", user: publicUser(user), payment: paymentInfo });
    }

    if (action === "login") {
      const body = await readJsonBody(request);
      await rateLimit(request, `login:${rateLimitIdentity(body.username)}`, 12, 10 * 60);
      const identity = await authenticateCredentials(body.username, body.password);
      if (identity.role === "admin") {
        await createSession(response, request, { role: "admin", username: identity.username });
        return sendJson(response, 200, { authenticated: true, allowed: true, role: "admin", adminUsername: identity.username });
      }
      await createSession(response, request, { role: "user", userId: identity.user.id });
      const status = publicUser(identity.user).status;
      return sendJson(response, 200, { authenticated: true, allowed: status === "active", role: "user", user: publicUser(identity.user), payment: paymentInfo });
    }

    if (action === "logout") {
      await destroySession(response, request);
      return sendJson(response, 200, { ok: true });
    }

    if (action === "submit-payment") {
      await rateLimit(request, "payment", 5, 10 * 60);
      const auth = await getAuthContext(request);
      if (!auth.authenticated || auth.role !== "user" || !auth.user) throw new AppError("Нэвтэрнэ үү.", 401, "UNAUTHORIZED");
      const user = await submitPayment(auth.user);
      return sendJson(response, 200, {
        ok: true,
        user: publicUser(user),
        message: "Төлбөрийг шалгаж дуустал түр хүлээнэ үү.",
      });
    }

    if (action === "request-password-reset") {
      const body = await readJsonBody(request);
      await rateLimit(request, `password-reset:${rateLimitIdentity(body.username)}`, 5, 60 * 60);
      const result = await createPasswordResetRequest(body);
      setPasswordResetCookie(response, request, result.token);
      return sendJson(response, 201, {
        ...result.request,
        message: "Нууц үг сэргээх хүсэлтийг админд илгээлээ. Админ таны бүртгэлтэй утсыг шалгаж зөвшөөртөл энэ хуудсыг хадгална уу.",
      });
    }

    if (action === "reset-password") {
      await rateLimit(request, "password-reset-complete", 8, 30 * 60);
      const reset = await getPasswordResetContext(request);
      if (!reset.token) throw new AppError("Нууц үг сэргээх хүсэлт олдсонгүй эсвэл хугацаа дууссан байна.", 409, "RESET_REQUEST_INVALID");
      const body = await readJsonBody(request);
      const user = await completePasswordReset(reset.token, body.password, body.confirmPassword);
      clearPasswordResetCookie(response);
      return sendJson(response, 200, {
        ok: true,
        user,
        message: "Нууц үг амжилттай шинэчлэгдлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.",
      });
    }

    throw new AppError("Үйлдэл олдсонгүй.", 404, "ACTION_NOT_FOUND");
  } catch (error) {
    return sendError(response, error);
  }
}
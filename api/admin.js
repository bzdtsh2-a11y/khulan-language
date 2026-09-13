import {
  AppError,
  approvePasswordReset,
  approveUser,
  assertSameOrigin,
  extendCurrentEligibleUsersOneYear,
  getAuthContext,
  listPasswordResetRequests,
  listUsers,
  publicUser,
  rateLimit,
  readJsonBody,
  rejectPasswordReset,
  rejectPayment,
  revokeUser,
  sendError,
  sendJson,
} from "../lib/auth-store.js";

async function requireAdmin(request) {
  const auth = await getAuthContext(request);
  if (!auth.authenticated || auth.role !== "admin") throw new AppError("Админ эрх шаардлагатай.", 403, "ADMIN_REQUIRED");
  return auth;
}

export default async function handler(request, response) {
  try {
    const auth = await requireAdmin(request);
    if (request.method === "GET") {
      const [users, resetRequests] = await Promise.all([listUsers(), listPasswordResetRequests()]);
      return sendJson(response, 200, {
        users,
        resetRequests,
        pendingCount: users.filter((user) => user.status === "payment_submitted").length,
        resetPendingCount: resetRequests.length,
      });
    }
    if (request.method !== "POST") throw new AppError("Арга зөвшөөрөгдөөгүй.", 405, "METHOD_NOT_ALLOWED");
    assertSameOrigin(request);
    await rateLimit(request, "admin", 60, 60);
    const body = await readJsonBody(request);

    if (body.action === "approve-reset") {
      const resetRequest = await approvePasswordReset(String(body.resetRequestId || ""), auth.adminUsername);
      return sendJson(response, 200, { ok: true, resetRequest });
    }
    if (body.action === "reject-reset") {
      const resetRequest = await rejectPasswordReset(String(body.resetRequestId || ""), auth.adminUsername);
      return sendJson(response, 200, { ok: true, resetRequest });
    }
    if (body.action === "extend-current-users-one-year") {
      const result = await extendCurrentEligibleUsersOneYear(auth.adminUsername);
      return sendJson(response, 200, { ok: true, result });
    }

    const id = String(body.userId || "");
    let user;
    if (body.action === "approve") user = await approveUser(id, auth.adminUsername);
    else if (body.action === "reject") user = await rejectPayment(id, auth.adminUsername);
    else if (body.action === "revoke") user = await revokeUser(id, auth.adminUsername);
    else throw new AppError("Админы үйлдэл буруу байна.", 400, "INVALID_ADMIN_ACTION");
    return sendJson(response, 200, { ok: true, user: publicUser(user) });
  } catch (error) {
    return sendError(response, error);
  }
}

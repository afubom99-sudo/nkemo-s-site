import {
  clearFailedLogins,
  hasSameOrigin,
  hasValidConfiguration,
  isLoginLocked,
  passwordMatches,
  recordFailedLogin,
  sendError,
  setSessionCookie,
} from "../lib/auth.js";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Method not allowed.");
  }

  if (!hasSameOrigin(req)) return sendError(res, 403, "Request not allowed.");
  if (!hasValidConfiguration()) {
    return sendError(
      res,
      503,
      "Admin sign-in is not configured. Set ADMIN_PASSWORD and SESSION_SECRET in Vercel."
    );
  }

  const ip =
    req.headers["x-real-ip"] ||
    req.headers["x-forwarded-for"]?.split(",").pop()?.trim() ||
    "unknown";
  if (isLoginLocked(ip)) {
    return sendError(
      res,
      429,
      "Too many sign-in attempts. Please wait 15 minutes and try again."
    );
  }

  const password = req.body?.password;
  if (typeof password !== "string" || password.length > 256) {
    recordFailedLogin(ip);
    return sendError(res, 401, "The password is incorrect.");
  }

  if (!passwordMatches(password)) {
    recordFailedLogin(ip);
    return sendError(res, 401, "The password is incorrect.");
  }

  clearFailedLogins(ip);
  setSessionCookie(res);
  return res.status(200).json({ authenticated: true });
}

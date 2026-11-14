import { clearSessionCookie, hasSameOrigin, sendError } from "../lib/auth.js";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Method not allowed.");
  }

  if (!hasSameOrigin(req)) return sendError(res, 403, "Request not allowed.");
  clearSessionCookie(res);
  return res.status(200).json({ authenticated: false });
}

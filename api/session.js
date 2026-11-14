import { hasValidConfiguration, isAuthenticated, sendError } from "../lib/auth.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendError(res, 405, "Method not allowed.");
  }

  if (!hasValidConfiguration()) {
    return sendError(
      res,
      503,
      "Admin sign-in is not configured. Set ADMIN_PASSWORD and SESSION_SECRET in Vercel."
    );
  }

  return res.status(200).json({ authenticated: isAuthenticated(req) });
}

import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "nkemo_admin";
const SESSION_SECONDS = 8 * 60 * 60;
const failedLogins = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_TRACKED_IPS = 1000;

export function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

export function hasValidConfiguration() {
  return Boolean(
    process.env.ADMIN_PASSWORD &&
      process.env.ADMIN_PASSWORD.length >= 12 &&
      process.env.SESSION_SECRET &&
      process.env.SESSION_SECRET.length >= 32
  );
}

export function hasBlobConfiguration() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function hasSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;

  if (!origin || !host) return false;

  try {
    const originUrl = new URL(origin);
    const forwardedProtocol = req.headers["x-forwarded-proto"]?.split(",")[0].trim();
    const protocol = forwardedProtocol || (req.socket?.encrypted ? "https" : "http");
    return originUrl.origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function authVersion() {
  return createHmac("sha256", "nkemo-admin-password")
    .update(process.env.ADMIN_PASSWORD || "")
    .digest("base64url");
}

function createSessionToken(secret) {
  const payload = Buffer.from(
    JSON.stringify({
      expiresAt: Date.now() + SESSION_SECONDS * 1000,
      authVersion: authVersion(),
    })
  ).toString("base64url");

  return `${payload}.${sign(payload, secret)}`;
}

function hasValidSessionToken(token, secret) {
  if (!token || token.length > 1024) return false;

  const separator = token.indexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = sign(payload, secret);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);

  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  ) {
    return false;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return (
      Number.isSafeInteger(data.expiresAt) &&
      data.expiresAt > Date.now() &&
      data.authVersion === authVersion()
    );
  } catch {
    return false;
  }
}

export function isAuthenticated(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return false;

  const cookieHeader = req.headers.cookie || "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));

  if (!cookie) return false;
  return hasValidSessionToken(cookie.slice(COOKIE_NAME.length + 1), secret);
}

export function setSessionCookie(res) {
  const token = createSessionToken(process.env.SESSION_SECRET);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${SESSION_SECONDS}${secure}`
  );
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secure}`
  );
}

export function passwordMatches(password) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword || !password) return false;

  const submitted = createHmac("sha256", "nkemo-admin-password")
    .update(password)
    .digest();
  const configured = createHmac("sha256", "nkemo-admin-password")
    .update(configuredPassword)
    .digest();

  return timingSafeEqual(submitted, configured);
}

export function isLoginLocked(ip) {
  const entry = failedLogins.get(ip);
  if (!entry) return false;
  if (entry.lockedUntil <= Date.now()) {
    failedLogins.delete(ip);
    return false;
  }
  return entry.attempts >= MAX_LOGIN_ATTEMPTS;
}

export function recordFailedLogin(ip) {
  const now = Date.now();
  const entry = failedLogins.get(ip);

  if (!entry || entry.lockedUntil <= now) {
    if (failedLogins.size >= MAX_TRACKED_IPS) {
      for (const [trackedIp, attempt] of failedLogins) {
        if (attempt.lockedUntil <= now) failedLogins.delete(trackedIp);
      }
      if (failedLogins.size >= MAX_TRACKED_IPS) {
        failedLogins.delete(failedLogins.keys().next().value);
      }
    }
    failedLogins.set(ip, { attempts: 1, lockedUntil: now + LOCKOUT_MS });
    return;
  }

  entry.attempts += 1;
}

export function clearFailedLogins(ip) {
  failedLogins.delete(ip);
}

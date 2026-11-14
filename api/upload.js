import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import {
  hasBlobConfiguration,
  hasSameOrigin,
  hasValidConfiguration,
  isAuthenticated,
  sendError,
} from "../lib/auth.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const SUPPORTED_TYPES = new Map([
  ["image/jpeg", { extension: "jpg", signature: [0xff, 0xd8, 0xff] }],
  ["image/png", { extension: "png", signature: [0x89, 0x50, 0x4e, 0x47] }],
  ["image/webp", { extension: "webp", signature: [0x52, 0x49, 0x46, 0x46] }],
]);

async function readImage(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_IMAGE_BYTES) {
      const error = new Error("Image is too large. The maximum file size is 4 MB.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks, total);
}

function matchesImageSignature(buffer, contentType) {
  const format = SUPPORTED_TYPES.get(contentType);
  if (!format || buffer.length < 12) return false;

  if (!format.signature.every((byte, index) => buffer[index] === byte)) {
    return false;
  }

  return contentType !== "image/webp" || buffer.toString("ascii", 8, 12) === "WEBP";
}

function getImageTitle(req) {
  const header = req.headers["x-image-title"];
  if (typeof header !== "string" || header.length > 512) return "Nkemo find";

  let title;
  try {
    title = decodeURIComponent(header);
  } catch {
    return "Nkemo find";
  }

  const cleaned = title
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);

  return cleaned || "Nkemo-find";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Method not allowed.");
  }

  if (!hasSameOrigin(req)) return sendError(res, 403, "Request not allowed.");
  if (!hasValidConfiguration()) {
    return sendError(res, 503, "Admin sign-in is not configured in Vercel.");
  }
  if (!isAuthenticated(req)) return sendError(res, 401, "Please sign in to upload photos.");
  if (!hasBlobConfiguration()) {
    return sendError(res, 503, "Connect a Vercel Blob store before uploading photos.");
  }

  const contentType = req.headers["content-type"]?.split(";")[0].trim().toLowerCase();
  if (!SUPPORTED_TYPES.has(contentType)) {
    return sendError(res, 415, "Choose a JPG, PNG, or WebP image.");
  }

  const declaredLength = Number(req.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
    return sendError(res, 413, "Image is too large. The maximum file size is 4 MB.");
  }

  try {
    const image = await readImage(req);
    if (!matchesImageSignature(image, contentType)) {
      return sendError(res, 415, "The selected file is not a valid supported image.");
    }

    const format = SUPPORTED_TYPES.get(contentType);
    const pathname = `portfolio/${randomUUID()}-${getImageTitle(req)}.${format.extension}`;
    const blob = await put(pathname, image, {
      access: "public",
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return res.status(201).json({
      image: { url: blob.url, title: getImageTitle(req).replace(/-/g, " ") },
    });
  } catch (error) {
    if (error.statusCode === 413) return sendError(res, 413, error.message);
    console.error("Could not upload a portfolio image.", error);
    return sendError(res, 502, "The photo could not be uploaded. Please try again.");
  }
}

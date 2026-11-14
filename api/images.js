import { list } from "@vercel/blob";
import { hasBlobConfiguration, sendError } from "../lib/auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendError(res, 405, "Method not allowed.");
  }

  if (!hasBlobConfiguration()) {
    return sendError(
      res,
      503,
      "Image storage is not configured. Connect a Vercel Blob store to this project."
    );
  }

  try {
    const result = await list({
      prefix: "portfolio/",
      limit: 500,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const images = result.blobs
      .map((blob) => {
        const filename = blob.pathname.split("/").pop() || "";
        const title = filename
          .replace(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-/i, "")
          .replace(/\.[^.]+$/, "")
          .replace(/[-_]+/g, " ")
          .trim();

        return {
          url: blob.url,
          title: title || "A find from Nkemo",
          uploadedAt: blob.uploadedAt,
        };
      })
      .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt));

    return res.status(200).json({ images });
  } catch (error) {
    console.error("Could not list portfolio images.", error);
    return sendError(res, 502, "Could not load the latest photos. Please try again.");
  }
}

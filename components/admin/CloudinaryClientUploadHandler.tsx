"use client";

import { createClientUploadHandler } from "@payloadcms/plugin-cloud-storage/client";
import { formatAdminURL } from "payload/shared";

type Issued = {
  filename: string;
  clientUploadContext: unknown;
  upload: { url: string; fields: Record<string, string | number | boolean> };
};

/**
 * Uploads a file from the admin straight to Cloudinary (skipping Vercel's 4.5 MB limit).
 * The server checks the user may upload, then signs exactly this one file.
 */
export const CloudinaryClientUploadHandler = createClientUploadHandler({
  handler: async ({ apiRoute, collectionSlug, docPrefix, file, serverHandlerPath, serverURL, updateFilename }) => {
    const endpoint = formatAdminURL({ apiRoute, path: serverHandlerPath, serverURL });
    const res = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionSlug, docPrefix, filename: file.name, mimeType: file.type }),
    });
    if (!res.ok) throw new Error("Could not start the upload. Please try again.");
    const issued = (await res.json()) as Issued;

    const form = new FormData();
    for (const [key, value] of Object.entries(issued.upload.fields)) form.append(key, String(value));
    form.append("file", file);

    const uploaded = await fetch(issued.upload.url, { method: "POST", body: form });
    if (!uploaded.ok) {
      const detail = await uploaded.json().catch(() => null);
      throw new Error(detail?.error?.message ?? "Upload to Cloudinary failed.");
    }

    updateFilename(issued.filename);
    return issued.clientUploadContext;
  },
});

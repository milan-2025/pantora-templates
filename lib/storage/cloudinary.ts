import path from "path";
import { Readable } from "stream";
import { v2 as cloudinary, type UploadApiOptions } from "cloudinary";
import type { Config, PayloadHandler } from "payload";
import { APIError, Forbidden } from "payload";
import { assertClientUploadAccess, assertClientUploadAllowed } from "payload/internal";
import { cloudStoragePlugin } from "@payloadcms/plugin-cloud-storage";
import type { Adapter, ClientUploadContext } from "@payloadcms/plugin-cloud-storage/types";
import {
  buildStoragePathData,
  getStorageFilePath,
  initClientUploads,
  resolveSignedURLKey,
} from "@payloadcms/plugin-cloud-storage/utilities";

/**
 * Payload storage adapter for Cloudinary.
 *
 * - `public` collections (Images & videos) are served straight from Cloudinary's CDN.
 * - `private` collections (paid Product files) are uploaded with Cloudinary's "private" delivery
 *   type, so they can't be opened without a signed, expiring download link. Downloads still go
 *   through Payload, which checks access first (see collections/ProductFiles.ts).
 * - Files are uploaded straight from the browser to Cloudinary (signed by the server), which
 *   avoids Vercel's 4.5 MB request limit for videos and large files.
 */

type Visibility = "public" | "private";
type ResourceType = "image" | "video" | "raw";

export type CloudinaryStorageOptions = {
  /** Collection slug → where its files go in Cloudinary and who can open them. */
  collections: Record<string, { folder: string; visibility: Visibility }>;
};

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "bmp", "tif", "tiff", "ico", "heic", "heif"]);
const VIDEO_EXT = new Set(["mp4", "mov", "webm", "m4v", "ogv", "avi", "mkv", "mpeg", "mpg"]);

const extOf = (filename: string) => path.extname(filename).slice(1).toLowerCase();

/** Decided from the file extension only, so upload, URL and delete always agree. */
export function resourceTypeFor(filename: string): ResourceType {
  const ext = extOf(filename);
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  return "raw";
}

/**
 * Cloudinary keeps the extension as part of the ID for "raw" files only; images and videos
 * are stored without it and the format is chosen by the delivery URL.
 */
function publicIdFor(storageFilePath: string) {
  if (resourceTypeFor(storageFilePath) === "raw") return storageFilePath;
  return storageFilePath.slice(0, -path.extname(storageFilePath).length || undefined);
}

function deliveryUrl(storageFilePath: string) {
  const resourceType = resourceTypeFor(storageFilePath);
  const publicId = publicIdFor(storageFilePath);
  const ext = extOf(storageFilePath);
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: "upload",
    secure: true,
    ...(resourceType !== "raw" && ext ? { format: ext } : {}),
  });
}

/** Short-lived signed link to a private file (forced download). */
function privateDownloadUrl(storageFilePath: string, attachment: boolean) {
  const resourceType = resourceTypeFor(storageFilePath);
  const publicId = publicIdFor(storageFilePath);
  const ext = resourceType === "raw" ? "" : extOf(storageFilePath);
  return cloudinary.utils.private_download_url(publicId, ext, {
    resource_type: resourceType,
    type: "private",
    attachment,
    expires_at: Math.floor(Date.now() / 1000) + 10 * 60,
  });
}

function uploadOptions(storageFilePath: string, visibility: Visibility): UploadApiOptions {
  return {
    public_id: publicIdFor(storageFilePath),
    resource_type: resourceTypeFor(storageFilePath),
    type: visibility === "private" ? "private" : "upload",
    overwrite: true,
    invalidate: true,
    use_filename: false,
    unique_filename: false,
  };
}

function configure() {
  const url = process.env.CLOUDINARY_URL;
  const name = process.env.CLOUDINARY_CLOUD_NAME;
  if (url) {
    // The SDK reads CLOUDINARY_URL itself; just make sure links are https.
    cloudinary.config({ secure: true });
  } else if (name) {
    cloudinary.config({
      cloud_name: name,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
  const c = cloudinary.config();
  return Boolean(c.cloud_name && c.api_key && c.api_secret);
}

function createAdapter({ visibility }: { visibility: Visibility }): Adapter {
  return ({ collection, prefix = "" }) => ({
    name: "cloudinary",
    clientUploads: true,
    requiresClientUploadReceipt: true,

    generateURL: ({ filename, prefix: docPrefix = "" }) =>
      deliveryUrl(buildStoragePathData({ collectionPrefix: prefix, docPrefix, filename }).storageFilePath),

    handleUpload: async ({ file, storageFilePath }) => {
      const options = uploadOptions(storageFilePath, visibility);
      if (file.tempFilePath) {
        await cloudinary.uploader.upload(file.tempFilePath, options);
      } else {
        await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(options, (error, result) => (error ? reject(error) : resolve(result)));
          Readable.from(file.buffer).pipe(stream);
        });
      }
    },

    handleDelete: async ({ storageFilePath }) => {
      await cloudinary.uploader.destroy(publicIdFor(storageFilePath), {
        resource_type: resourceTypeFor(storageFilePath),
        type: visibility === "private" ? "private" : "upload",
        invalidate: true,
      });
    },

    staticHandler: async (req, { doc, params: { clientUploadContext, filename } }) => {
      const storageFilePath = await getStorageFilePath({ clientUploadContext, collection, collectionPrefix: prefix, doc, filename, req });
      const source = visibility === "private" ? privateDownloadUrl(storageFilePath, !clientUploadContext) : deliveryUrl(storageFilePath);

      // Payload reads the bytes of a freshly client-uploaded file (to measure it and make
      // image sizes), so stream it through. Everyone else is redirected to Cloudinary.
      if (clientUploadContext) {
        const res = await fetch(source);
        if (!res.ok || !res.body) return new Response("Not found", { status: 404 });
        return new Response(res.body, {
          headers: {
            "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
            ...(res.headers.get("Content-Length") ? { "Content-Length": res.headers.get("Content-Length")! } : {}),
          },
        });
      }
      return new Response(null, {
        status: 302,
        headers: { Location: source, "Cache-Control": visibility === "private" ? "no-store" : "public, max-age=3600" },
      });
    },
  });
}

/**
 * Server half of the browser→Cloudinary upload:
 * the admin asks for permission, the server checks access, picks the final file name,
 * and returns a one-time Cloudinary signature for exactly that file.
 */
function clientUploadRoute(collections: CloudinaryStorageOptions["collections"]): PayloadHandler {
  return async (req) => {
    if (!req.json) throw new APIError("Invalid upload request", 400);
    const body = (await req.json()) as { collectionSlug?: unknown; docPrefix?: unknown; filename?: unknown; mimeType?: unknown };
    const { collectionSlug, docPrefix, filename, mimeType } = body;
    if (
      typeof collectionSlug !== "string" ||
      typeof filename !== "string" ||
      typeof mimeType !== "string" ||
      (docPrefix !== undefined && typeof docPrefix !== "string") ||
      !Object.hasOwn(collections, collectionSlug)
    ) {
      throw new APIError("Invalid upload request", 400);
    }

    await assertClientUploadAccess({ collectionSlug, req });
    if (!req.user) throw new Forbidden();
    const collectionConfig = (req.payload.collections as Record<string, { config: unknown }>)[collectionSlug]?.config;
    assertClientUploadAllowed({
      collection: collectionConfig as Parameters<typeof assertClientUploadAllowed>[0]["collection"],
      filename,
      mimeType,
    });

    const { folder, visibility } = collections[collectionSlug];
    const resolved = await resolveSignedURLKey({
      collectionPrefix: folder,
      collectionSlug,
      docPrefix: docPrefix as string | undefined,
      filename,
      req,
    });

    const options = uploadOptions(resolved.storageFilePath, visibility);
    const resourceType = options.resource_type as ResourceType; // part of the URL, not the signed params
    const params: Record<string, string | number | boolean> = {
      public_id: options.public_id!,
      type: options.type!,
      overwrite: true,
      invalidate: true,
      timestamp: Math.floor(Date.now() / 1000),
    };
    const config = cloudinary.config();
    const signature = cloudinary.utils.api_sign_request(params, config.api_secret!);

    return Response.json({
      filename: resolved.sanitizedFilename,
      clientUploadContext: resolved.clientUploadContext satisfies ClientUploadContext,
      upload: {
        url: `https://api.cloudinary.com/v1_1/${config.cloud_name}/${resourceType}/upload`,
        fields: { ...params, api_key: config.api_key!, signature },
      },
    });
  };
}

/** Payload plugin. Does nothing (files stay on local disk) until Cloudinary credentials are set. */
export const cloudinaryStorage =
  (options: CloudinaryStorageOptions) =>
  (incomingConfig: Config): Config => {
    const enabled = configure();

    initClientUploads({
      clientHandler: "/components/admin/CloudinaryClientUploadHandler#CloudinaryClientUploadHandler",
      collections: options.collections,
      config: incomingConfig,
      enabled,
      serverHandler: clientUploadRoute(options.collections),
      serverHandlerPath: "/cloudinary-client-upload",
    });

    if (!enabled) return incomingConfig;

    const config: Config = {
      ...incomingConfig,
      collections: (incomingConfig.collections || []).map((c) =>
        options.collections[c.slug]
          ? { ...c, upload: { ...(typeof c.upload === "object" ? c.upload : {}), disableLocalStorage: true } }
          : c,
      ),
    };

    return cloudStoragePlugin({
      collections: Object.fromEntries(
        Object.entries(options.collections).map(([slug, { folder, visibility }]) => [
          slug,
          {
            adapter: createAdapter({ visibility }),
            prefix: folder,
            // Public files load straight from Cloudinary's CDN; private ones go through Payload's access check.
            ...(visibility === "public" ? { disablePayloadAccessControl: true as const } : {}),
          },
        ]),
      ),
    })(config);
  };

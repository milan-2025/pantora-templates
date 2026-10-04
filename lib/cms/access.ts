import type { Access, FieldHook, Validate } from "payload";

export const anyone: Access = () => true;
export const authenticated: Access = ({ req }) => Boolean(req.user);
export const nobody: Access = () => false;

/** Logged-in editors see drafts; the public only sees published documents. */
export const publishedOrAuthenticated: Access = ({ req }) =>
  req.user ? true : { _status: { equals: "published" } };

// URL segments that belong to the app itself and can't be used as page slugs.
const RESERVED = new Set(["admin", "api", "blog", "checkout", "success", "_next", "media", "product-files"]);

/** Products and Pages share the top-level URL space (/<slug>), so a slug must be unique across both. */
export const validateSlug: Validate<string> = async (value, { req, id, collectionSlug }) => {
  if (!value) return "A URL slug is required";
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(value)) {
    return "Use lowercase letters, numbers, - or _ only (e.g. wedding_planner)";
  }
  if (RESERVED.has(value)) return `"${value}" is reserved by the website. Please pick another slug.`;
  if (!req?.payload) return true;
  for (const collection of ["products", "pages"] as const) {
    const clash = await req.payload.find({
      collection,
      where: { slug: { equals: value }, ...(collection === collectionSlug && id ? { id: { not_equals: id } } : {}) },
      limit: 1,
      depth: 0,
      draft: true,
      overrideAccess: true,
      req,
    });
    if (clash.totalDocs > 0) return `The URL /${value} is already used by another ${collection === "pages" ? "page" : "product"}.`;
  }
  return true;
};

/** Normalises a slug as the editor types it. */
export const formatSlug: FieldHook = ({ value }) =>
  typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "-") : value;

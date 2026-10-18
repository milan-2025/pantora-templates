import type { CollectionConfig, Field } from "payload";
import { authenticated, formatSlug, publishedOrAuthenticated, validateSlug } from "@/lib/cms/access";
import { revalidateAfterChange, revalidateAfterDelete } from "@/lib/cms/revalidate";

export const MOCKUP_TABS = [
  { label: "Budget", value: "budget" },
  { label: "Guests", value: "guests" },
  { label: "Vendors", value: "vendors" },
  { label: "Payments", value: "payments" },
  { label: "Dashboard", value: "dashboard" },
];

export const FEATURE_ICONS = [
  { label: "Calculator", value: "Calculator" },
  { label: "People", value: "Users" },
  { label: "Bell / reminder", value: "BellRing" },
  { label: "Spreadsheet", value: "FileSpreadsheet" },
  { label: "Phone", value: "Smartphone" },
  { label: "Refresh / updates", value: "RefreshCw" },
  { label: "Heart", value: "Heart" },
  { label: "Calendar", value: "CalendarDays" },
  { label: "Wallet", value: "Wallet" },
  { label: "Gift", value: "Gift" },
];

// Small helpers so each section reads cleanly below.
const eyebrow: Field = { name: "eyebrow", type: "text", admin: { description: "Small label above the heading" } };
const heading: Field = { name: "heading", type: "text" };
const headingAccent: Field = {
  name: "headingAccent",
  type: "text",
  admin: { description: "Optional second part of the heading, shown in the accent colour/italic" },
};
const media = (name: string, description?: string): Field => ({
  name,
  type: "upload",
  relationTo: "media",
  admin: description ? { description } : undefined,
});

export const Products: CollectionConfig = {
  slug: "products",
  admin: {
    group: "Shop",
    useAsTitle: "name",
    defaultColumns: ["name", "slug", "price", "_status", "updatedAt"],
    description: "Each product gets its own sales page at pandoratemplates.com/<slug>.",
    preview: (doc) => `/${doc.slug}`,
  },
  versions: { drafts: true },
  access: {
    read: publishedOrAuthenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    afterChange: [revalidateAfterChange((d) => (d.slug ? [`/${d.slug}`, "/"] : ["/"]))],
    afterDelete: [revalidateAfterDelete((d) => (d.slug ? [`/${d.slug}`, "/"] : ["/"]))],
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Product & price",
          fields: [
            { name: "name", type: "text", required: true },
            {
              name: "slug",
              type: "text",
              required: true,
              unique: true,
              index: true,
              validate: validateSlug,
              hooks: { beforeValidate: [formatSlug] },
              admin: { description: "The page address, e.g. wedding_planner → pandoratemplates.com/wedding_planner" },
            },
            { name: "tagline", type: "textarea", admin: { description: "One-line pitch, used under the hero heading and on product cards" } },
            media("cardImage", "Image for product cards on the homepage"),
            {
              name: "price",
              type: "number",
              required: true,
              min: 0,
              admin: { description: "Regular price in ₹. Set a lower price under the Offer tab." },
            },
            { name: "formats", type: "text", hasMany: true, admin: { description: "e.g. Excel, Google Sheets" } },
            {
              name: "includes",
              type: "array",
              labels: { singular: "Item", plural: "What's included" },
              fields: [{ name: "text", type: "text", required: true }],
            },
            {
              name: "downloadFile",
              type: "upload",
              relationTo: "product-files",
              admin: { description: "The file buyers download after paying (kept private)" },
            },
            {
              name: "googleSheetsCopyUrl",
              type: "text",
              admin: { description: "Google Sheets 'make a copy' link given to buyers (ends with /copy)" },
            },
          ],
        },
        {
          label: "Offer",
          description: "An optional lower price, plus an optional free bonus for quick buyers. The price never changes per visitor.",
          fields: [
            {
              name: "offer",
              type: "group",
              label: "Offer price",
              fields: [
                { name: "enabled", type: "checkbox", defaultValue: false, label: "Offer price is running" },
                { name: "price", type: "number", min: 0, admin: { description: "Offer price in ₹ (the regular price is shown crossed out)" } },
                {
                  name: "mode",
                  type: "radio",
                  defaultValue: "always",
                  // Products saved with the old per-visitor price timer become "No end date".
                  hooks: { beforeValidate: [({ value }) => (value === "endDate" ? "endDate" : "always")] },
                  options: [
                    { label: "No end date", value: "always" },
                    { label: "Ends on a fixed date for everyone", value: "endDate" },
                  ],
                },
                {
                  name: "endsAt",
                  type: "date",
                  admin: {
                    condition: (_, sibling) => sibling?.mode === "endDate",
                    date: { pickerAppearance: "dayAndTime" },
                    description: "When the offer price ends for everyone; checkout then charges the regular price",
                  },
                },
                {
                  name: "showCountdown",
                  type: "checkbox",
                  defaultValue: true,
                  label: "Show countdown to the end date",
                  admin: { condition: (_, sibling) => sibling?.mode === "endDate" },
                },
              ],
            },
            {
              name: "bonus",
              type: "group",
              label: "Quick-order bonus",
              admin: {
                description:
                  "A free extra for visitors who order within a set time of their first visit (e.g. 15 minutes). " +
                  "The site shows a countdown, and orders placed in time get the bonus automatically.",
              },
              fields: [
                { name: "enabled", type: "checkbox", defaultValue: false, label: "Bonus is running" },
                {
                  name: "title",
                  type: "text",
                  admin: { description: 'Short name shown in the countdown, e.g. "Wedding Day Checklist"' },
                },
                {
                  name: "minutes",
                  type: "number",
                  min: 1,
                  max: 1440,
                  defaultValue: 15,
                  admin: { description: "Minutes each visitor has from their first visit (reloading doesn't reset it)" },
                },
                {
                  name: "file",
                  type: "upload",
                  relationTo: "product-files",
                  admin: { description: "The bonus file buyers download (kept private)" },
                },
                {
                  name: "link",
                  type: "text",
                  admin: { description: "Optional: a bonus link instead of, or as well as, a file (e.g. a Google Sheets copy link)" },
                },
              ],
            },
            {
              name: "salesCounter",
              type: "group",
              label: "Sales counter",
              admin: {
                description: "Shows how many people have bought this, counted from real paid orders on this website.",
              },
              fields: [
                { name: "show", type: "checkbox", defaultValue: false, label: "Show the sales counter" },
                {
                  name: "previousSales",
                  type: "number",
                  min: 0,
                  defaultValue: 0,
                  admin: {
                    description:
                      "Real sales made before this website (e.g. via WhatsApp or Instagram). Added to the website's paid orders. Only enter genuine sales.",
                  },
                },
                {
                  name: "minimumToShow",
                  type: "number",
                  min: 0,
                  defaultValue: 10,
                  admin: { description: "The counter stays hidden until total sales reach this number" },
                },
                {
                  name: "text",
                  type: "text",
                  defaultValue: "{count} couples are already planning with this sheet",
                  admin: { description: "Use {count} where the number should go" },
                },
              ],
            },
            {
              name: "showRecentPurchases",
              type: "checkbox",
              defaultValue: true,
              label: "Show recent-purchase popups (real paid orders from the last 30 days)",
            },
          ],
        },
        {
          name: "hero",
          label: "Hero",
          fields: [
            eyebrow,
            { name: "headline", type: "text", defaultValue: "Your wedding plans," },
            { name: "headlineAccent", type: "text", defaultValue: "sorted." },
            { name: "subheadline", type: "textarea" },
            { name: "ctaLabel", type: "text", defaultValue: "Get the planner" },
            { name: "trustPoints", type: "text", hasMany: true, admin: { description: "Short ticks under the buttons" } },
            { name: "badge", type: "text", admin: { description: "Floating badge on the spreadsheet preview" } },
            media("media", "Optional image or video shown behind the spreadsheet preview"),
          ],
        },
        {
          label: "Audience",
          fields: [
            {
              name: "audienceLine",
              type: "textarea",
              admin: { description: "Who it's for. Shown under the hero and above the features." },
            },
          ],
        },
        {
          name: "pain",
          label: "Pain points",
          fields: [
            eyebrow,
            heading,
            headingAccent,
            {
              name: "items",
              type: "array",
              fields: [
                { name: "emoji", type: "text" },
                { name: "text", type: "text", required: true },
              ],
            },
            { name: "resolution", type: "text", admin: { description: "Line that appears once the cards 'sort' themselves" } },
          ],
        },
        {
          name: "showcase",
          label: "Product tour",
          fields: [
            eyebrow,
            heading,
            headingAccent,
            {
              name: "tabs",
              type: "array",
              fields: [
                { name: "mockup", type: "select", options: MOCKUP_TABS, required: true, admin: { description: "Which spreadsheet tab to animate" } },
                { name: "label", type: "text", required: true },
                { name: "emoji", type: "text" },
                { name: "headline", type: "text" },
                { name: "text", type: "textarea" },
                media("media", "Optional screenshot or screen-recording for this tab. Leave empty to show nothing."),
              ],
            },
          ],
        },
        {
          name: "highlights",
          label: "Feature highlights",
          fields: [
            eyebrow,
            heading,
            headingAccent,
            {
              name: "items",
              type: "array",
              admin: { description: "3–4 big features with an image each" },
              fields: [
                { name: "title", type: "text", required: true },
                { name: "text", type: "textarea" },
                { name: "bullets", type: "text", hasMany: true },
                media("image", "Screenshot or photo. If empty, an animated spreadsheet preview is shown instead."),
                { name: "mockup", type: "select", options: MOCKUP_TABS, admin: { description: "Preview shown when there's no image" } },
              ],
            },
          ],
        },
        {
          name: "features",
          label: "Features grid",
          fields: [
            eyebrow,
            heading,
            headingAccent,
            {
              name: "items",
              type: "array",
              fields: [
                { name: "icon", type: "select", options: FEATURE_ICONS, defaultValue: "Calculator" },
                { name: "title", type: "text", required: true },
                { name: "text", type: "textarea" },
              ],
            },
          ],
        },
        {
          name: "steps",
          label: "How it works",
          fields: [
            eyebrow,
            heading,
            { name: "items", type: "array", fields: [{ name: "title", type: "text", required: true }, { name: "text", type: "text" }] },
          ],
        },
        {
          name: "testimonials",
          label: "Testimonials",
          fields: [
            eyebrow,
            heading,
            {
              name: "items",
              type: "array",
              admin: { description: "Real customer reviews only" },
              fields: [
                { name: "name", type: "text", required: true },
                { name: "city", type: "text" },
                { name: "text", type: "textarea", required: true },
              ],
            },
          ],
        },
        {
          name: "faq",
          label: "FAQ",
          fields: [
            eyebrow,
            heading,
            {
              name: "items",
              type: "array",
              fields: [
                { name: "question", type: "text", required: true },
                { name: "answer", type: "textarea", required: true },
              ],
            },
          ],
        },
        {
          name: "contact",
          label: "Contact form",
          fields: [
            { name: "show", type: "checkbox", defaultValue: true, label: "Show contact form on this page" },
            heading,
            { name: "text", type: "textarea" },
          ],
        },
        {
          name: "finalCta",
          label: "Final call to action",
          fields: [
            heading,
            headingAccent,
            { name: "text", type: "textarea" },
            { name: "buttonLabel", type: "text" },
            media("media", "Optional background image or video"),
          ],
        },
        {
          name: "seo",
          label: "SEO",
          fields: [
            { name: "title", type: "text" },
            { name: "description", type: "textarea" },
            media("image", "Image shown when the page is shared (1200×630 recommended)"),
          ],
        },
      ],
    },
  ],
};

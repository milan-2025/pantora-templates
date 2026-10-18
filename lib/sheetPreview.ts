import type { Product } from "@/payload-types";

/** One tab of the animated spreadsheet preview. Every part is optional; only filled parts are drawn. */
export type PreviewSheet = {
  label: string;
  emoji?: string | null;
  stats?: { label: string; value: string }[] | null;
  columns?: string[] | null;
  /** One row per line, cells separated by | (or tabs, when pasted from Excel). */
  rows?: string | null;
  progressLabel?: string | null;
  progressPercent?: number | null;
  bars?: number[] | null;
  donut?: number[] | null;
  chartLabel?: string | null;
};

export type SheetPreview = { fileName: string; formula: string; sheets: PreviewSheet[] };

/** The Wedding Planner's preview (used by the seed and to fill in existing databases). */
export const WEDDING_PREVIEW = {
  fileName: "our-wedding-planner.xlsx",
  formula: "=SUM(Budget[Spent])  · totals update automatically",
  sheets: [
    {
      label: "Budget",
      emoji: "💰",
      columns: ["Category", "Budget", "Spent", "Left"],
      rows: [
        "Venue | ₹6,00,000 | ₹4,50,000 | ₹1,50,000",
        "Catering | ₹5,00,000 | ₹3,80,000 | ₹1,20,000",
        "Decor | ₹2,00,000 | ₹90,000 | ₹1,10,000",
        "Photography | ₹1,50,000 | ₹1,50,000 | ₹0",
        "Outfits | ₹2,50,000 | ₹1,20,000 | ₹1,30,000",
      ].join("\n"),
      progressLabel: "Budget spent",
      progressPercent: 70,
    },
    {
      label: "Guests",
      emoji: "👨‍👩‍👧",
      stats: [
        { label: "Invited", value: "412" },
        { label: "Confirmed", value: "286" },
        { label: "Pending", value: "126" },
      ],
      columns: ["Guest", "Side", "#", "RSVP"],
      rows: [
        "Sharma family | Bride | 6 | Yes",
        "Bua ji 👑 | Groom | 2 | Yes",
        "College gang | Bride | 12 | Maybe",
        "Mehta uncle | Groom | 4 | Pending",
        "Office team | Groom | 8 | Yes",
      ].join("\n"),
    },
    {
      label: "Vendors",
      emoji: "📸",
      columns: ["Vendor", "Type", "Status"],
      rows: [
        "Lens & Love Studio | 📸 Photo | Booked",
        "Spice Route Caterers | 🍛 Catering | Booked",
        "Gendaphool Decor | 🌼 Decor | Quote",
        "Beats by Kabir | 🎧 Music | Booked",
        "Glam by Riya | 💄 Makeup | Shortlist",
      ].join("\n"),
    },
    {
      label: "Payments",
      emoji: "📅",
      columns: ["Payment", "Amount", "Due"],
      rows: [
        "Venue advance | ₹2,00,000 | Paid",
        "Caterer 2nd instalment | ₹1,50,000 | In 3 days",
        "Photographer balance | ₹75,000 | In 12 days",
        "Decor advance | ₹45,000 | Paid",
        "Mehendi artist | ₹18,000 | In 20 days",
      ].join("\n"),
    },
    {
      label: "Dashboard",
      emoji: "📊",
      stats: [
        { label: "Days to go", value: "87" },
        { label: "Budget used", value: "68%" },
        { label: "Vendors booked", value: "9" },
      ],
      donut: [35, 25, 20, 20],
      chartLabel: "Spend split",
      bars: [60, 85, 40, 95, 70],
    },
  ],
} satisfies SheetPreview;

/**
 * The preview for a product, from its "Sheet preview" tab. A product with no sheets yet gets a simple
 * one built from its name and "What's included" list, so it never shows another product's data.
 */
export function sheetPreview(product: Pick<Product, "name" | "slug" | "includes" | "preview">): SheetPreview {
  const p = product.preview;
  const fileName = p?.fileName?.trim() || `${(product.slug || "template").replace(/_/g, "-")}.xlsx`;
  const formula = p?.formula?.trim() || "totals update automatically";
  const sheets = (p?.sheets ?? []).filter((s) => s.label);
  if (sheets.length) return { fileName, formula, sheets };

  const items = (product.includes ?? []).map((i) => i.text).filter(Boolean).slice(0, 8);
  return {
    fileName,
    formula,
    sheets: [
      {
        label: "Overview",
        emoji: "📋",
        columns: ["What's included", "Status"],
        rows: (items.length ? items : [product.name]).map((t) => `${t.replace(/\|/g, "/")} | Ready`).join("\n"),
      },
    ],
  };
}

/** Old "which tab" values (budget, guests…) map to the 1st, 2nd… tab of the product's own preview. */
const LEGACY_TABS = ["budget", "guests", "vendors", "payments", "dashboard"];
export function previewTabIndex(value: string | null | undefined, count: number) {
  const i = Math.max(0, LEGACY_TABS.indexOf(value ?? ""));
  return count ? Math.min(i, count - 1) : 0;
}
export const previewTabValue = (index: number) => LEGACY_TABS[index] ?? LEGACY_TABS[0];

export function parseRows(rows: string | null | undefined): string[][] {
  return (rows ?? "")
    .split(/\r?\n/)
    .map((line) => line.split(/\t|\|/).map((c) => c.trim()))
    .filter((cells) => cells.some(Boolean))
    .slice(0, 8);
}

/** "₹4,50,000", "68%", "450 kcal" → a number that can count up, with its prefix/suffix kept. */
export function parseNumberCell(s: string): { value: number; format: (n: number) => string } | null {
  const m = s.trim().match(/^([₹$€£+]?)(\s?)(\d[\d,]*(?:\.\d+)?)(\s?)(%|[a-zA-Z]{1,5})?$/);
  if (!m) return null;
  const [, prefix, gap1, num, gap2, suffix = ""] = m;
  const value = Number(num.replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  const decimals = num.split(".")[1]?.length ?? 0;
  const grouped = num.includes(",");
  const format = (n: number) => {
    const body = grouped
      ? n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : n.toFixed(decimals);
    return `${prefix}${gap1}${body}${suffix ? gap2 + suffix : ""}`;
  };
  return { value, format };
}

/** Colour for a status pill, from common words ("Paid", "Pending", "In 3 days"…). */
export function pillTone(s: string): { className: string; pulse: boolean } {
  const t = s.toLowerCase();
  const days = t.match(/in (\d+) days?/);
  if (days) {
    const n = Number(days[1]);
    if (n <= 5) return { className: "bg-blush text-coral", pulse: true };
    return { className: n <= 14 ? "bg-sand text-marigold-deep" : "bg-lavender text-plum", pulse: false };
  }
  if (/\b(overdue|urgent|late|missed|failed)\b/.test(t)) return { className: "bg-blush text-coral", pulse: true };
  if (/\b(pending|due|no|skipped|not started)\b/.test(t)) return { className: "bg-blush text-coral", pulse: false };
  if (/(✓|✅)|\b(paid|done|yes|booked|complete|completed|confirmed|active|ready|won|hit|on track)\b/.test(t))
    return { className: "bg-mint text-teal", pulse: false };
  if (/\b(maybe|quote|in progress|progress|soon|waiting|partial|review|draft)\b/.test(t))
    return { className: "bg-sand text-marigold-deep", pulse: false };
  return { className: "bg-lavender text-plum", pulse: false };
}

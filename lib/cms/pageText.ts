/**
 * Plain-text helpers for pages built from blocks: a meta description when the editor left the SEO one empty,
 * and an <h1> for pages that have no hero banner (legal pages, contact), so every page has exactly one main heading.
 */

type LexNode = { type?: string; tag?: string; text?: string; children?: LexNode[] };
type Layout = ReadonlyArray<{ blockType: string; [k: string]: unknown }> | null | undefined;

const textOf = (n: LexNode | undefined): string =>
  !n ? "" : typeof n.text === "string" ? n.text : (n.children ?? []).map(textOf).join(n.type === "list" || n.type === "listitem" ? " " : "");

const rootChildren = (content: unknown): LexNode[] => (content as { root?: LexNode } | null)?.root?.children ?? [];

/** Cuts at a word boundary and adds "…", for descriptions of about 155 characters. */
export function clip(s: string, max = 155) {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).replace(/[\s,;:.–-]+$/, "")}…`;
}

/** The page's first real sentences: hero text, then rich text paragraphs, then the contact form's intro. */
export function pageDescription(layout: Layout): string | undefined {
  for (const b of layout ?? []) {
    if (b.blockType === "hero" && typeof b.text === "string" && b.text.trim()) return clip(b.text);
    if (b.blockType === "richText") {
      const paras = rootChildren(b.content)
        .filter((n) => n.type === "paragraph" || n.type === "list")
        .map(textOf)
        .map((t) => t.trim())
        .filter((t) => t && !/^last updated/i.test(t));
      let out = "";
      for (const p of paras) {
        out = out ? `${out} ${p}` : p;
        if (out.length >= 110) break;
      }
      if (out) return clip(out);
    }
    if ((b.blockType === "contactForm" || b.blockType === "cta" || b.blockType === "featureGrid") && typeof b.text === "string" && b.text.trim()) {
      return clip(b.text);
    }
  }
  return undefined;
}

/**
 * How the page gets its one <h1>:
 *  - "hero": a hero banner already has it (or custom HTML brings its own),
 *  - "promote": the first block's heading becomes the <h1> (rich text or contact form),
 *  - "hidden": a visually hidden <h1> with the page title.
 */
export function mainHeadingPlan(layout: Layout): "hero" | "promote" | "hidden" {
  const blocks = layout ?? [];
  if (blocks.some((b) => b.blockType === "hero" || b.blockType === "html")) return "hero";
  const first = blocks[0];
  if (first?.blockType === "contactForm") return "promote";
  if (first?.blockType === "richText" && rootChildren(first.content).some((n) => n.type === "heading")) return "promote";
  return "hidden";
}

/** A copy of rich text whose first heading is an <h1> (unless it already has one). */
export function withMainHeading<T>(content: T): T {
  const children = rootChildren(content);
  if (children.some((n) => n.type === "heading" && n.tag === "h1")) return content;
  const i = children.findIndex((n) => n.type === "heading");
  if (i < 0) return content;
  const root = (content as { root: LexNode }).root;
  return { ...content, root: { ...root, children: children.map((n, j) => (j === i ? { ...n, tag: "h1" } : n)) } } as T;
}

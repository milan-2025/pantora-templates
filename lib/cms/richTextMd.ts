/**
 * Turns a small subset of Markdown into Payload's Lexical rich-text JSON, so long-form content
 * (blog posts in lib/content/blogPosts.ts) can be written and reviewed as plain text.
 *
 * Supported: "## " and "### " headings, "- " bullet lists, "1. " numbered lists, blank-line paragraphs,
 * **bold** and [link text](/url). Links open in the same tab unless they start with http.
 */
type Node = Record<string, unknown>;

const text = (t: string, bold = false): Node => ({ type: "text", text: t, format: bold ? 1 : 0, detail: 0, mode: "normal", style: "", version: 1 });

const element = (type: string, children: Node[], extra: Node = {}): Node => ({
  type,
  format: "",
  indent: 0,
  version: 1,
  direction: "ltr",
  children,
  ...extra,
});

const link = (label: Node[], url: string): Node =>
  element("link", label, { version: 3, fields: { linkType: "custom", url, newTab: /^https?:/i.test(url) } });

/** Inline Markdown (bold and links) → Lexical inline nodes. */
export function inline(src: string): Node[] {
  const out: Node[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index > last) out.push(text(src.slice(last, m.index)));
    if (m[1] !== undefined) out.push(link(inline(m[1]), m[2]));
    else out.push(text(m[3], true));
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(text(src.slice(last)));
  return out;
}

/** Markdown → the `content` value of a rich-text field. */
export function mdToLexical(md: string) {
  const children: Node[] = [];
  const blocks = md.trim().split(/\n\s*\n/);
  for (const raw of blocks) {
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    const first = lines[0];
    const heading = /^(#{2,3}) (.+)$/.exec(first);
    if (heading && lines.length === 1) {
      children.push(element("heading", inline(heading[2]), { tag: heading[1] === "##" ? "h2" : "h3" }));
    } else if (lines.every((l) => /^- /.test(l))) {
      children.push(element("list", lines.map((l, i) => element("listitem", inline(l.slice(2)), { value: i + 1 })), { listType: "bullet", tag: "ul", start: 1 }));
    } else if (lines.every((l) => /^\d+\. /.test(l))) {
      children.push(
        element("list", lines.map((l, i) => element("listitem", inline(l.replace(/^\d+\. /, "")), { value: i + 1 })), { listType: "number", tag: "ol", start: 1 }),
      );
    } else {
      children.push(element("paragraph", inline(lines.join(" ")), { textFormat: 0, textStyle: "" }));
    }
  }
  return { root: { type: "root", format: "", indent: 0, version: 1, direction: "ltr", children } };
}

/** Every link URL in a Markdown string (used by tests to check internal links point at real pages). */
export const mdLinks = (md: string) => [...md.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);

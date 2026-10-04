/** Tiny builders for Lexical rich-text JSON, used by the seed script. */

type Node = Record<string, unknown>;

const text = (t: string, bold = false): Node => ({
  type: "text",
  text: t,
  format: bold ? 1 : 0,
  detail: 0,
  mode: "normal",
  style: "",
  version: 1,
});

const block = (type: string, children: Node[], extra: Node = {}): Node => ({
  type,
  format: "",
  indent: 0,
  version: 1,
  direction: "ltr",
  children,
  ...extra,
});

export const p = (t: string) => block("paragraph", [text(t)], { textFormat: 0, textStyle: "" });
export const h = (tag: "h2" | "h3", t: string) => block("heading", [text(t)], { tag });
export const ul = (items: string[]) =>
  block(
    "list",
    items.map((t, i) => block("listitem", [text(t)], { value: i + 1 })),
    { listType: "bullet", tag: "ul", start: 1 },
  );

export const doc = (...children: Node[]) => ({
  root: { type: "root", format: "", indent: 0, version: 1, direction: "ltr", children },
}) as never;

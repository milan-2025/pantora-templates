"use client";

import { useState } from "react";
import { useFormFields } from "@payloadcms/ui";

const btn: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 14px",
  marginRight: 8,
  marginBottom: 8,
  borderRadius: 999,
  border: "1px solid var(--theme-elevation-250)",
  background: "var(--theme-elevation-50)",
  color: "var(--theme-elevation-800)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
};

const links = (slug: string) => ({
  live: `/i/${slug}`,
  preview: `/api/shaadi/admin-open/${encodeURIComponent(slug)}?to=preview`,
  edit: `/api/shaadi/admin-open/${encodeURIComponent(slug)}?to=edit`,
});

/** Preview / edit / live links on an invite's admin page. */
export function InviteLinksField() {
  const slug = useFormFields(([fields]) => fields.slug?.value) as string | undefined;
  const status = useFormFields(([fields]) => fields.paymentStatus?.value) as string | undefined;
  const [copied, setCopied] = useState(false);
  if (!slug) return null;
  const l = links(slug);
  const copy = () => {
    void navigator.clipboard?.writeText(`${window.location.origin}${l.live}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div style={{ margin: "4px 0 24px", padding: 16, borderRadius: 12, border: "1px solid var(--theme-elevation-150)", background: "var(--theme-elevation-0)" }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>Invite links</div>
      <a href={l.preview} target="_blank" rel="noopener noreferrer" style={btn}>▶ Preview (full screen)</a>
      <a href={l.edit} target="_blank" rel="noopener noreferrer" style={btn}>✎ Edit invite</a>
      <a href={l.live} target="_blank" rel="noopener noreferrer" style={btn}>🔗 Live guest link</a>
      <button type="button" onClick={copy} style={btn}>{copied ? "Copied ✓" : "Copy guest link"}</button>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--theme-elevation-500)" }}>
        Preview and Edit open the couple&apos;s own editor. Anything you save there changes their invite. The live guest link works once the
        invite is marked Paid{status === "paid" ? "" : " (it isn’t yet)"}.
      </p>
    </div>
  );
}

/** Compact links in the invites list. */
export function InviteLinksCell({ rowData }: { rowData?: { slug?: string } }) {
  const slug = rowData?.slug;
  if (!slug) return null;
  const l = links(slug);
  const a: React.CSSProperties = { marginRight: 10, fontWeight: 600, whiteSpace: "nowrap" };
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <a href={l.preview} target="_blank" rel="noopener noreferrer" style={a}>Preview</a>
      <a href={l.edit} target="_blank" rel="noopener noreferrer" style={a}>Edit</a>
      <a href={l.live} target="_blank" rel="noopener noreferrer" style={a}>Live</a>
    </span>
  );
}

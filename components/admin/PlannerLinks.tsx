"use client";

import { useDocumentInfo } from "@payloadcms/ui";

const btn: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 14px",
  marginRight: 8,
  borderRadius: 999,
  border: "1px solid var(--theme-elevation-250)",
  background: "var(--theme-elevation-50)",
  color: "var(--theme-elevation-800)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
};

const href = (id: string | number) => `/api/planner/admin-open/${encodeURIComponent(String(id))}`;

/** "Open planner (view only)" on a customer planner's admin page. */
export function PlannerLinksField() {
  const { id } = useDocumentInfo();
  if (!id) return null;
  return (
    <div style={{ margin: "4px 0 24px", padding: 16, borderRadius: 12, border: "1px solid var(--theme-elevation-150)" }}>
      <a href={href(id)} target="_blank" rel="noopener noreferrer" style={btn}>👁 Open planner (view only)</a>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--theme-elevation-500)" }}>
        Opens the customer&apos;s planner exactly as they see it, read-only, for support. The link works for 2 hours.
      </p>
    </div>
  );
}

export function PlannerLinksCell({ rowData }: { rowData?: { id?: string | number } }) {
  if (!rowData?.id) return null;
  return (
    <a href={href(rowData.id)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontWeight: 600 }}>
      View
    </a>
  );
}

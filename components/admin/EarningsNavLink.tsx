import Link from "next/link";

/** Extra link in the admin sidebar. */
export function EarningsNavLink() {
  return (
    <Link
      href="/admin/affiliate-earnings"
      style={{ display: "block", padding: "6px 0", fontWeight: 600, color: "var(--theme-elevation-800)", textDecoration: "none" }}
    >
      💰 Affiliate earnings
    </Link>
  );
}

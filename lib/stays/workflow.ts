/**
 * Stays: the review and publication workflow. Pure, so the rules are tested directly.
 *
 * Hosts: draft → submitted; they can withdraw a submission, resubmit after changes were requested or a rejection,
 * and ask for an approved/inactive listing to be published. They can never approve or publish.
 * Admin: everything else.
 */
import type { Status } from "./constants";

export type Action =
  | "submit" | "withdraw" | "request_publish" // host
  | "review" | "approve" | "reject" | "request_changes" | "publish" | "unpublish" | "deactivate" | "reactivate"; // admin

const HOST: Record<string, { from: Status[]; to: Status | null }> = {
  submit: { from: ["draft", "changes_requested", "rejected"], to: "submitted" },
  withdraw: { from: ["submitted"], to: "draft" },
  request_publish: { from: ["approved", "inactive"], to: null }, // only raises a flag for the admin
};
const ADMIN: Record<string, { from: Status[]; to: Status }> = {
  review: { from: ["submitted"], to: "under_review" },
  approve: { from: ["draft", "submitted", "under_review", "changes_requested", "rejected", "inactive"], to: "approved" },
  reject: { from: ["submitted", "under_review", "approved", "changes_requested"], to: "rejected" },
  request_changes: { from: ["submitted", "under_review", "approved", "rejected"], to: "changes_requested" },
  publish: { from: ["draft", "submitted", "under_review", "approved", "inactive", "changes_requested"], to: "published" },
  unpublish: { from: ["published"], to: "approved" },
  deactivate: { from: ["draft", "submitted", "under_review", "approved", "rejected", "changes_requested", "published"], to: "inactive" },
  reactivate: { from: ["inactive"], to: "approved" },
};

export const HOST_ACTIONS = Object.keys(HOST) as Action[];
export const ADMIN_ACTIONS = Object.keys(ADMIN) as Action[];
/** Actions that must come with a reason the host can read. */
export const NEEDS_REASON: Action[] = ["reject", "request_changes"];

export type Transition = { ok: true; to: Status | null } | { ok: false; error: string };

export function transition(role: "admin" | "host", action: string, from: Status): Transition {
  const table = role === "admin" ? ADMIN : HOST;
  const t = table[action];
  if (!t) return { ok: false, error: role === "host" && action in ADMIN ? "Only the administrator can do that" : "Unknown action" };
  if (!t.from.includes(from)) return { ok: false, error: `Not possible while the property is ${from.replace("_", " ")}` };
  return { ok: true, to: t.to };
}

/** Statuses in which the host edits the property directly. In the others, the host's edits wait for the admin. */
export const HOST_EDITS_DIRECTLY: Status[] = ["draft", "submitted", "under_review", "changes_requested", "rejected"];

/** Timestamps set when a property reaches a status. */
export function stampsFor(to: Status | null, now: number): Record<string, number> {
  if (to === "approved") return { approvedAt: now };
  if (to === "published") return { publishedAt: now };
  if (to === "submitted") return { submittedAt: now };
  return {};
}

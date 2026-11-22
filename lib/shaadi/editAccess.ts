import "server-only";
import { randomInt } from "crypto";
import type { Payload } from "payload";
import { sendWithBrevo } from "@/lib/brevo";
import { findInvite } from "@/lib/invites";
import { codesMatch, hashCode, normEmail, validEmail } from "@/lib/planner/core";

/**
 * "Edit this invite" from the guest page: the couple types their email, gets a 6-digit code,
 * and the code opens the editor (by handing back the invite's private edit key).
 * Emails that may edit: the invite's contact email, and, if it is connected to a wedding planner,
 * the planner's owner and its "can edit" family members.
 * Codes live in the planner's sign-in code table under "invite:<invite id>:<email>", valid 15 minutes, 5 tries.
 */

const CODE_MINUTES = 15;
const secret = () => `${process.env.PAYLOAD_SECRET || "dev-secret-change-me"}:invite-edit`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

export class EditAccessError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

async function editorsOf(payload: Payload, invite: Doc) {
  const out = new Set<string>();
  if (invite.contactEmail) out.add(normEmail(invite.contactEmail));
  const pid = invite.planner && typeof invite.planner === "object" ? invite.planner.id : invite.planner;
  if (pid) {
    const p = (await payload.findByID({ collection: "planners", id: String(pid), depth: 0, overrideAccess: true, select: { ownerEmail: true, collaborators: true } }).catch(() => null)) as Doc | null;
    if (p?.ownerEmail) out.add(normEmail(p.ownerEmail));
    for (const c of p?.collaborators ?? []) if (c?.email && c.role !== "viewer") out.add(normEmail(c.email));
  }
  return out;
}

const key = (invite: Doc, email: string) => `invite:${invite.id}:${email}`;

/** Emails a code if this email may edit the invite. Says the same either way, so it doesn't reveal who the couple is. */
export async function startEditAccess(payload: Payload, slug: string, raw: unknown) {
  const email = normEmail(raw);
  if (!validEmail(email)) throw new EditAccessError("Please enter a valid email");
  const invite = (await findInvite(payload, slug)) as Doc | null;
  if (!invite?.editToken) return { ok: true };
  if (!(await editorsOf(payload, invite)).has(email)) return { ok: true };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0"), k = key(invite, email);
  await payload.delete({ collection: "planner-logins", where: { email: { equals: k } }, overrideAccess: true }).catch(() => null);
  await payload.create({ collection: "planner-logins", data: { email: k, codeHash: hashCode(secret(), k, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(), attempts: 0 } as never, overrideAccess: true });
  await sendWithBrevo({
    to: [{ email }],
    subject: `${code} is your code to edit your wedding invite`,
    html: `<!doctype html><html><body style="margin:0;background:#FBF5EA;font-family:Arial,Helvetica,sans-serif;color:#2A2A2A"><div style="max-width:520px;margin:0 auto;padding:32px 20px"><div style="background:#FFFDF8;border:1px solid #EBE2EF;border-radius:24px;padding:28px">
      <h2 style="margin:0 0 8px;color:#3B1F4A">Edit your invite</h2><p>Type this code to open the editor for ${esc(invite.names || "your invite")}:</p>
      <p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#3B1F4A;margin:14px 0">${code}</p>
      <p style="font-size:13px;color:#666">It works for ${CODE_MINUTES} minutes. Didn't ask for it? You can ignore this email; nobody can edit without the code.</p></div></div></body></html>`,
    text: `Your code to edit your wedding invite is ${code}. It works for ${CODE_MINUTES} minutes.`,
  });
  return { ok: true, ...(process.env.BREVO_API_KEY || process.env.NODE_ENV === "production" ? {} : { devCode: code }) };
}

/** Checks the code; on success returns the invite's private edit key so the page can open the editor. */
export async function verifyEditAccess(payload: Payload, slug: string, raw: unknown, rawCode: unknown) {
  const email = normEmail(raw), code = String(rawCode ?? "").replace(/\D/g, "");
  const invite = (await findInvite(payload, slug)) as Doc | null;
  const expired = new EditAccessError("That code has expired. Ask for a new one.", 401);
  if (!invite?.editToken) throw expired;
  const k = key(invite, email);
  const row = (await payload.find({ collection: "planner-logins", where: { email: { equals: k } }, limit: 1, sort: "-createdAt", depth: 0, overrideAccess: true })).docs[0] as Doc | undefined;
  if (!row || new Date(row.expiresAt).getTime() < Date.now()) throw expired;
  if ((row.attempts ?? 0) >= 5) throw new EditAccessError("Too many wrong tries. Ask for a new code.", 429);
  if (code.length !== 6 || !codesMatch(row.codeHash, hashCode(secret(), k, code))) {
    await payload.update({ collection: "planner-logins", id: row.id, data: { attempts: (row.attempts ?? 0) + 1 } as never, overrideAccess: true });
    throw new EditAccessError("That code isn't right. Check the latest email, or ask for a new code.", 401);
  }
  await payload.delete({ collection: "planner-logins", where: { email: { equals: k } }, overrideAccess: true });
  return { slug: String(invite.slug), token: String(invite.editToken) };
}

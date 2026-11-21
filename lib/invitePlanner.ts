import "server-only";
import { randomBytes, timingSafeEqual } from "crypto";
import type { Payload } from "payload";
import { sendWithBrevo } from "@/lib/brevo";
import {
  cleanState, coupleNames, editLink, findInvite, getPlanConfig, hasUnsavedChanges, isLive, newToken, planRank, randomSuffix,
  sendInviteLiveEmail, slugify,
} from "@/lib/invites";
import {
  familiesOf, familyLinks, importGuestOps, matchFamily, newGuestOps, replyOps, seedState, syncedState,
  type InvEvent, type InvGuest, type PState, type Reply,
} from "@/lib/invitePlannerCore";
import { PlannerError } from "@/lib/planner/core";
import { savePlanner, type Role } from "@/lib/planner/server";

/*
 * Wedding planner ↔ wedding invite maker, the database side. Rules live in invitePlannerCore.ts.
 * Only these two products are linked; nothing here touches the other tools.
 */

// Payload documents read loosely (both states are free-form JSON).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const idOf = (v: unknown) => (v && typeof v === "object" ? String((v as Doc).id) : v ? String(v) : null);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const BY = "Wedding invite"; // shown in the planner's activity log for changes made by RSVPs

export const inviteUrl = (slug: string) => `${siteUrl()}/i/${slug}`;

/* ---------- settings ---------- */

export async function bundleInfo(payload: Payload) {
  const g = (await payload.findGlobal({ slug: "planner-landing" as never, depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null;
  const price = Math.max(1, Math.round(Number(g?.bundlePrice) || 2999));
  return { on: g?.bundleOn !== false, price, crossSell: g?.crossSellOn !== false };
}

/* ---------- linking ---------- */

export async function linkedInvite(payload: Payload, planner: Doc): Promise<Doc | null> {
  const id = idOf(planner.invite);
  if (!id) return null;
  return ((await payload.findByID({ collection: "invites", id, depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null) ?? null;
}

const reload = async (payload: Payload, id: string) => (await payload.findByID({ collection: "planners", id, depth: 0, overrideAccess: true })) as Doc;

/** The planner's invite, made now (names, date, functions and families filled in) if it has none. */
export async function createInviteFor(payload: Payload, planner: Doc): Promise<Doc> {
  const have = await linkedInvite(payload, planner);
  if (have) return have;
  const state = cleanState(seedState((planner.state ?? {}) as PState));
  if (!state) throw new PlannerError("Couldn't make the invite. Please try again.", 500);
  const base = slugify(`${state.b}-${state.g}`) || "our-wedding";
  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const doc = (await payload.create({
        collection: "invites",
        data: { slug: `${base}-${randomSuffix()}`, names: coupleNames(state), editToken: newToken(), state, planner: planner.id, contactEmail: planner.ownerEmail, plannerSyncAt: now } as never,
        overrideAccess: true,
      })) as Doc;
      await payload.update({ collection: "planners", id: planner.id, data: { invite: doc.id } as never, depth: 0, overrideAccess: true });
      return doc;
    } catch {
      // the link is taken: try another
    }
  }
  throw new PlannerError("Couldn't make the invite link. Please try again.", 500);
}

const sameToken = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};

/** "https://…/i/<link>/edit#k=<key>" (or just the two parts) → { slug, token }. */
export function parseEditLink(link: unknown, slug?: unknown, token?: unknown) {
  if (typeof slug === "string" && typeof token === "string" && slug && token) return { slug: slug.trim(), token: token.trim() };
  const m = /\/i\/([^/#?\s]+)\/edit\/?(?:\?[^#]*)?#(?:.*&)?k=([A-Za-z0-9]+)/.exec(String(link ?? ""));
  return m ? { slug: decodeURIComponent(m[1]), token: m[2] } : null;
}

/**
 * Connects an invite the couple made on its own (they prove it with their private edit link). The invite's
 * guests the planner doesn't have are added to the planner first, earlier RSVPs are applied, then the
 * planner takes over the guest list.
 */
export async function connectInvite(payload: Payload, planner: Doc, by: string, role: Role, slug: string, token: string) {
  const invite = (await findInvite(payload, slug)) as Doc | null;
  if (!invite || !sameToken(String(invite.editToken ?? ""), token)) throw new PlannerError("That edit link doesn't match an invite. Copy it again from your email or the invite editor.", 404);
  const mine = idOf(planner.invite);
  if (mine && mine !== String(invite.id)) throw new PlannerError("This planner is already connected to another invite.", 409);
  const theirs = idOf(invite.planner);
  if (theirs && theirs !== String(planner.id)) throw new PlannerError("That invite is already connected to another planner.", 409);
  if (mine === String(invite.id)) return invite;

  const st = (invite.state ?? {}) as Doc;
  let n = 0;
  const ops = importGuestOps((planner.state ?? {}) as PState, (st.gu ?? []) as InvGuest[], (st.ev ?? []) as InvEvent[], () => "iv" + randomBytes(6).toString("hex"));
  if (ops.length) {
    await savePlanner(payload, String(planner.id), by, role, ops, `Added ${ops.length} guest${ops.length > 1 ? "s" : ""} from your wedding invite`);
    n = ops.length;
  }
  await payload.update({ collection: "invites", id: invite.id, data: { planner: planner.id, ...(invite.contactEmail ? {} : { contactEmail: planner.ownerEmail }) } as never, depth: 0, overrideAccess: true });
  await payload.update({ collection: "planners", id: planner.id, data: { invite: invite.id } as never, depth: 0, overrideAccess: true });

  // Replies that came in before: match them while the invite still has its own guest names.
  const linked = { ...invite, planner: planner.id };
  const old = await payload.find({ collection: "invite-rsvps", where: { invite: { equals: invite.id } }, sort: "createdAt", limit: 500, depth: 0, overrideAccess: true });
  for (const r of old.docs as Doc[]) if (!r.plannerStatus) await routeReply(payload, linked, r).catch((e) => console.error("[invite-rsvp-link]", e));
  await syncInvite(payload, await reload(payload, String(planner.id)));
  return { ...linked, imported: n };
}

/* ---------- planner → invite ---------- */

/**
 * Brings the invite's draft up to date with the planner. Guests take effect at once (the invite treats
 * the guest list as live data); names, date and functions wait in the draft until the couple publishes,
 * with a note telling them what changed.
 */
export async function syncInvite(payload: Payload, planner: Doc) {
  const invite = await linkedInvite(payload, planner);
  if (!invite || idOf(invite.planner) !== String(planner.id)) return null;
  const st = (invite.state ?? {}) as Doc;
  const { state, changes } = syncedState((planner.state ?? {}) as PState, st);
  const clean = cleanState(state);
  if (!clean || JSON.stringify(clean) === JSON.stringify(st)) return invite;
  const data: Doc = { state: clean, names: coupleNames(clean) };
  if (changes.length) {
    const pending = invite.plannerSyncAt && (!invite.publishedAt || invite.plannerSyncAt > invite.publishedAt) ? String(invite.plannerNote ?? "") : "";
    const note = [...new Set([...pending.split(" · ").filter(Boolean), ...changes])].join(" · ");
    data.plannerSyncAt = new Date().toISOString();
    data.plannerNote = note.length > 290 ? note.slice(0, 288) + "…" : note;
  }
  return (await payload.update({ collection: "invites", id: invite.id, data: data as never, depth: 0, overrideAccess: true })) as Doc;
}

/* ---------- invite → planner ---------- */

const replyOf = (r: Doc): Reply => ({
  name: String(r.name ?? ""), guests: Number(r.guests) || 0, events: String(r.events ?? ""), meal: r.meal ?? "", side: r.side ?? "",
  guest: r.guest ?? "", message: r.message ?? "", at: r.createdAt,
});

async function applyTo(payload: Payload, planner: Doc, key: string, rsvp: Doc) {
  const r = replyOps((planner.state ?? {}) as PState, key, replyOf(rsvp));
  if (!r) return false;
  try {
    await savePlanner(payload, String(planner.id), BY, "owner", r.ops, r.summary);
  } catch (e) {
    // e.g. the planner's plan ended: keep the reply for the couple to apply later
    console.error("[invite-rsvp-apply]", e instanceof Error ? e.message : e);
    await payload.update({ collection: "invite-rsvps", id: rsvp.id, data: { plannerStatus: "review" } as never, depth: 0, overrideAccess: true });
    return false;
  }
  await payload.update({ collection: "invite-rsvps", id: rsvp.id, data: { plannerStatus: "applied", plannerFamily: key } as never, depth: 0, overrideAccess: true });
  return true;
}

/** A new RSVP on a connected invite: straight into the family's guest rows, or onto the couple's review list. */
export async function routeReply(payload: Payload, invite: Doc, rsvp: Doc) {
  const pid = idOf(invite.planner);
  if (!pid) return null;
  const planner = (await payload.findByID({ collection: "planners", id: pid, depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null;
  if (!planner) return null;
  const gu = ((invite.state ?? {}) as Doc).gu ?? [];
  const key = matchFamily((planner.state ?? {}) as PState, gu as InvGuest[], replyOf(rsvp));
  if (key && (await applyTo(payload, planner, key, rsvp))) return "applied";
  if (!key) await payload.update({ collection: "invite-rsvps", id: rsvp.id, data: { plannerStatus: "review" } as never, depth: 0, overrideAccess: true });
  return "review";
}

/** The couple decides about a reply nobody could match: it's this family, it's a new guest, or ignore it. */
export async function reviewReply(payload: Payload, planner: Doc, by: string, role: Role, rsvpId: string, action: string, family?: string) {
  const rsvp = (await payload.findByID({ collection: "invite-rsvps", id: rsvpId, depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null;
  if (!rsvp || !planner.invite || idOf(rsvp.invite) !== idOf(planner.invite)) throw new PlannerError("That reply isn't on your invite", 404);
  if (action === "ignore") {
    await payload.update({ collection: "invite-rsvps", id: rsvp.id, data: { plannerStatus: "ignored" } as never, depth: 0, overrideAccess: true });
    return { ok: true };
  }
  if (action === "match") {
    const key = familiesOf((planner.state ?? {}) as PState).find((f) => f.k === family)?.k;
    if (!key) throw new PlannerError("Pick a family from your guest list");
    if (!(await applyTo(payload, planner, key, rsvp))) throw new PlannerError("Couldn't update the guest list. Check that your plan is active.", 402);
    return { ok: true };
  }
  if (action === "add") {
    const r = newGuestOps((planner.state ?? {}) as PState, replyOf(rsvp), "iv" + randomBytes(6).toString("hex"));
    await savePlanner(payload, String(planner.id), by, role, r.ops, r.summary);
    await payload.update({ collection: "invite-rsvps", id: rsvp.id, data: { plannerStatus: "applied", plannerFamily: r.ops[0].r.group } as never, depth: 0, overrideAccess: true });
    return { ok: true };
  }
  throw new PlannerError("Unknown action");
}

/* ---------- what the planner shows ---------- */

export async function inviteSummary(payload: Payload, planner: Doc) {
  const bundle = await bundleInfo(payload);
  const invite = await linkedInvite(payload, planner);
  if (!invite) return { linked: false as const, bundle: { on: bundle.on, price: bundle.price } };
  const live = isLive(invite as never);
  const premium = live && planRank(invite.plan) >= planRank("premium");
  const url = inviteUrl(invite.slug);
  const st = (invite.state ?? {}) as Doc;
  const [review, replies] = await Promise.all([
    payload.find({ collection: "invite-rsvps", where: { and: [{ invite: { equals: invite.id } }, { plannerStatus: { equals: "review" } }] }, sort: "-createdAt", limit: 100, depth: 0, overrideAccess: true }),
    payload.count({ collection: "invite-rsvps", where: { invite: { equals: invite.id } }, overrideAccess: true }),
  ]);
  const pendingNote = invite.plannerSyncAt && (!invite.publishedAt || invite.plannerSyncAt > invite.publishedAt) ? String(invite.plannerNote ?? "") : "";
  return {
    linked: true as const,
    slug: invite.slug, url, live, plan: invite.plan ?? null, premium, expiresAt: invite.expiresAt ?? null, publishedAt: invite.publishedAt ?? null,
    unsaved: hasUnsavedChanges(invite as never), note: pendingNote,
    links: premium ? familyLinks(st.gu ?? [], url) : {},
    families: Array.isArray(st.gu) ? st.gu.length : 0,
    replies: replies.totalDocs,
    review: (review.docs as Doc[]).map((r) => ({ id: String(r.id), name: r.name, guests: r.guests, events: r.events ?? "", meal: r.meal ?? "", message: r.message ?? "", side: r.side ?? "", at: r.createdAt })),
    bundle: { on: bundle.on && !premium, price: bundle.price },
  };
}

export const editUrlOf = (invite: Doc) => editLink(invite as never);

/* ---------- bundle ---------- */

/** Planner + Invite bundle paid: the planner's invite (made now if needed) goes live on Premium. */
export async function grantBundleInvite(payload: Payload, planner: Doc) {
  const invite = await createInviteFor(payload, planner);
  if (isLive(invite as never) && planRank(invite.plan) >= planRank("premium")) return invite;
  const { months } = await getPlanConfig(payload);
  const expires = new Date();
  expires.setMonth(expires.getMonth() + months);
  const live = isLive(invite as never);
  const doc = (await payload.update({
    collection: "invites",
    id: invite.id,
    data: {
      paymentStatus: "paid", plan: "premium", paidAt: new Date().toISOString(),
      ...(live && invite.expiresAt ? {} : { expiresAt: expires.toISOString() }),
      ...(invite.published ? {} : { published: invite.state, publishedAt: new Date().toISOString() }),
      ...(invite.contactEmail ? {} : { contactEmail: planner.ownerEmail }),
      manualNote: [invite.manualNote, "Planner + Invite bundle"].filter(Boolean).join(" · "),
    } as never,
    depth: 0,
    overrideAccess: true,
  })) as Doc;
  await sendInviteLiveEmail(doc as never, months).catch((e) => console.error("[bundle-invite-email]", e));
  return doc;
}

/* ---------- cross-sell emails (planner ↔ invite only) ---------- */

const shell = (body: string) =>
  `<!doctype html><html><body style="margin:0;background:#FBF5EA;font-family:Arial,Helvetica,sans-serif;color:#2A2A2A"><div style="max-width:520px;margin:0 auto;padding:32px 20px"><div style="background:#FFFDF8;border:1px solid #EBE2EF;border-radius:24px;padding:28px">${body}</div><p style="text-align:center;font-size:12px;color:#888">Pandora Templates · Open the box. Everything’s ready.</p></div></body></html>`;
const btn = (href: string, text: string) => `<a href="${href}" style="display:inline-block;padding:12px 22px;background:#3B1F4A;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">${text}</a>`;

/**
 * Two days after a purchase, one email about the other product: invite buyers hear about the planner,
 * planner buyers about the invite. Each customer gets it once. Run by the daily reminders job.
 */
export async function sendCrossSells(payload: Payload, now = Date.now()) {
  const { crossSell } = await bundleInfo(payload);
  if (!crossSell) return { invites: 0, planners: 0, skipped: "switched off" };
  const before = new Date(now - 2 * 864e5).toISOString();
  const after = new Date(now - 30 * 864e5).toISOString(); // don't email old customers when this first goes live
  let invites = 0, planners = 0;

  const inv = await payload.find({
    collection: "invites",
    where: { and: [{ paymentStatus: { equals: "paid" } }, { paidAt: { less_than: before } }, { paidAt: { greater_than: after } }, { planner: { exists: false } }, { crossSellAt: { exists: false } }, { contactEmail: { exists: true } }] },
    limit: 40, depth: 0, overrideAccess: true,
  });
  for (const i of inv.docs as Doc[]) {
    try {
      const link = `${siteUrl()}/planner/signup?utm_source=invite-email#ik=${encodeURIComponent(i.slug)}.${i.editToken}`;
      await sendWithBrevo({
        to: [{ email: i.contactEmail }],
        subject: "Your invite is out. Now plan the rest of the wedding 📋",
        html: shell(`<h2 style="margin:0 0 8px;color:#3B1F4A">Guests are opening your invite${i.names ? ", " + esc(String(i.names)) : ""} 💌</h2>
          <p>Next comes the hard part: who is coming to which function, rooms, cabs, vendors and the budget.</p>
          <p>The <b>Pandora Wedding Planner</b> does all of it, and it connects to your invite: your guest list moves in, and every RSVP lands in the planner by itself.</p>
          <p>${btn(link, "Try the planner free for 14 days")}</p>
          <p style="font-size:13px;color:#666">No card needed. Sign in with this email address and your invite connects automatically.</p>`),
      });
      invites++;
    } catch (e) {
      console.error("[cross-sell-invite]", i.slug, e);
    }
    await payload.update({ collection: "invites", id: i.id, data: { crossSellAt: new Date(now).toISOString() } as never, depth: 0, overrideAccess: true });
  }

  const pl = await payload.find({
    collection: "planners",
    where: { and: [{ status: { equals: "paid" } }, { paidAt: { less_than: before } }, { paidAt: { greater_than: after } }, { invite: { exists: false } }, { crossSellAt: { exists: false } }] },
    limit: 40, depth: 0, overrideAccess: true,
  });
  for (const p of pl.docs as Doc[]) {
    try {
      await sendWithBrevo({
        to: [{ email: p.ownerEmail }],
        subject: "Send your guests a beautiful invite, straight from your planner 💌",
        html: shell(`<h2 style="margin:0 0 8px;color:#3B1F4A">Your guest list is ready. Time to invite them!</h2>
          <p>Make a digital wedding invite from your planner in one tap: names, date, functions and families are filled in for you.</p>
          <ul style="padding-left:18px;line-height:1.6"><li>A personal link for every family, showing only their functions</li><li>Send it from the planner's WhatsApp button</li><li>RSVPs and blessings come back into your guest list by themselves</li></ul>
          <p>${btn(`${siteUrl()}/planner#invite`, "Make my invite")}</p>`),
      });
      planners++;
    } catch (e) {
      console.error("[cross-sell-planner]", p.id, e);
    }
    await payload.update({ collection: "planners", id: p.id, data: { crossSellAt: new Date(now).toISOString() } as never, depth: 0, overrideAccess: true });
  }
  return { invites, planners };
}

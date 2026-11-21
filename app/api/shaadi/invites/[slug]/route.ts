import { NextResponse } from "next/server";
import { APIError } from "payload";
import { getPayloadClient } from "@/lib/cms/queries";
import { authorize, checkSlugShape, cleanState, coupleNames, editSession, isLive, lockAge, lockFree } from "@/lib/invites";
import { clientIp, rateLimit } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * An invite connected to the wedding planner: the planner owns the guest list, so the saved guests always win
 * (keeping the editor's "sent" marks). If the planner changed the draft after this editor loaded it
 * (psa = the planner-sync time the editor knows), the planner's names, date and events are kept too and the
 * editor is told to reload them, so an open editor never undoes the planner's changes.
 */
function withPlanner(invite: { planner?: unknown; plannerSyncAt?: string | null; state?: unknown }, state: Record<string, unknown>, psa: unknown) {
  if (!invite.planner) return { state, reload: false };
  const saved = (invite.state ?? {}) as Record<string, unknown>;
  const mine = new Map(((state.gu ?? []) as { k?: string; n: string; s?: number; r?: number }[]).map((g) => [g.k || g.n, g]));
  const out: Record<string, unknown> = {
    ...state,
    gu: ((saved.gu ?? []) as { k?: string; n: string; s?: number; r?: number }[]).map((g) => {
      const m = mine.get(g.k || g.n);
      return { ...g, ...(m?.s || g.s ? { s: Math.max(m?.s ?? 0, g.s ?? 0) } : {}), ...(m?.r || g.r ? { r: Math.max(m?.r ?? 0, g.r ?? 0) } : {}) };
    }),
    grp: saved.grp ?? state.grp,
  };
  const stale = Boolean(invite.plannerSyncAt) && (typeof psa !== "string" || psa < String(invite.plannerSyncAt));
  if (stale) for (const k of ["b", "g", "date", "ev"]) if (k in saved) out[k] = saved[k];
  return { state: out, reload: stale };
}

/** Autosaves the couple's draft (needs their private edit token). Guests keep seeing the last published version. */
export async function PUT(req: Request, { params }: Ctx) {
  if (!rateLimit(`invite-save:${clientIp(req)}`, 120, 60_000)) return NextResponse.json({ error: "Too many saves" }, { status: 429 });
  const { slug } = await params;
  const payload = await getPayloadClient();
  const invite = await authorize(req, payload, slug);
  if (!invite) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  if (!lockFree(invite, editSession(req))) return NextResponse.json({ error: "locked" }, { status: 409 });
  const body = (await req.json().catch(() => null)) as { state?: unknown; psa?: unknown } | null;
  const raw = cleanState(body?.state);
  if (!raw) return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
  const { state, reload } = withPlanner(invite, raw, body?.psa);

  await payload.update({ collection: "invites", id: invite.id, data: { state, names: coupleNames(state) }, overrideAccess: true });
  return NextResponse.json({ ok: true, paid: isLive(invite), plan: invite.plan ?? null, ...(reload ? { reload: true } : {}) });
}

/**
 * The couple changes their invite link (needs their private edit token). Allowed before and after payment:
 * the old link keeps working and forwards guests to the new one.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!rateLimit(`invite-link:${clientIp(req)}`, 20, 3_600_000)) {
    return NextResponse.json({ error: "Too many changes. Please try again later." }, { status: 429 });
  }
  const { slug } = await params;
  const payload = await getPayloadClient();
  const invite = await authorize(req, payload, slug);
  if (!invite) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { want?: unknown } | null;
  const { slug: want, error } = checkSlugShape(body?.want);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (want === invite.slug) return NextResponse.json({ slug: want });
  try {
    const doc = await payload.update({ collection: "invites", id: invite.id, data: { slug: want }, overrideAccess: true });
    return NextResponse.json({ slug: doc.slug });
  } catch (e) {
    const msg = e instanceof APIError ? e.message : "That link is already taken. Please choose another.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}

/**
 * Editor actions (need the private edit token):
 * - op "lock": claim or renew the editing lease for this browser tab ({ take: true } takes it over from another tab;
 *   { release: true } lets go). Only one tab or device can edit an invite at a time.
 * - op "publish": the Save button. Saves the draft and makes it the version guests see.
 */
export async function POST(req: Request, { params }: Ctx) {
  if (!rateLimit(`invite-op:${clientIp(req)}`, 120, 60_000)) return NextResponse.json({ error: "Slow down" }, { status: 429 });
  const { slug } = await params;
  const payload = await getPayloadClient();
  const invite = await authorize(req, payload, slug);
  if (!invite) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const sid = editSession(req);
  const body = (await req.json().catch(() => null)) as { op?: string; take?: boolean; release?: boolean; state?: unknown; psa?: unknown } | null;

  if (body?.op === "lock") {
    if (!sid) return NextResponse.json({ error: "No editor session" }, { status: 400 });
    if (body.release) {
      if (invite.editSid === sid) await payload.update({ collection: "invites", id: invite.id, data: { editSid: null, editAt: null }, overrideAccess: true });
      return NextResponse.json({ ok: true });
    }
    if (!body.take && !lockFree(invite, sid)) return NextResponse.json({ ok: false, held: true, ago: lockAge(invite) });
    await payload.update({ collection: "invites", id: invite.id, data: { editSid: sid, editAt: new Date().toISOString() }, overrideAccess: true });
    return NextResponse.json({ ok: true, ...(invite.planner ? { psa: invite.plannerSyncAt ?? null } : {}) });
  }

  if (body?.op === "publish") {
    if (!lockFree(invite, sid)) return NextResponse.json({ error: "locked" }, { status: 409 });
    const raw = cleanState(body.state);
    if (!raw) return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
    const { state, reload } = withPlanner(invite, raw, body.psa);
    const publishedAt = new Date().toISOString();
    await payload.update({ collection: "invites", id: invite.id, data: { state, published: state, publishedAt, names: coupleNames(state) }, overrideAccess: true });
    return NextResponse.json({ ok: true, publishedAt, live: isLive(invite), ...(reload ? { reload: true } : {}) });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Stays host API. Hosts sign in with email + password (own cookie, separate from the site's admin login).
 * A host only ever reaches properties whose hostId is their own; every query below includes that condition.
 * Responses use hostProperty(), which leaves out listing prices, margins and admin notes.
 */
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { HOST_EDITS_DIRECTLY, NEEDS_REASON, stampsFor, transition } from "@/lib/stays/workflow";
import { cleanHostInput, missingForReview, str, text } from "@/lib/stays/property";
import { createProperty, mediaAction, store, withHostInput } from "@/lib/stays/actions";
import {
  amenityDefs, checkPassword, dbs, getSettings, hashPassword, hostCookie, hostFrom, hostToken, nextHostCode, notifyAdmin, publicSettings, rid,
  sameOrigin, tokenHash, type Actor, type C,
} from "@/lib/stays/server";
import { hostProperty, type StoredProperty } from "@/lib/stays/views";
import { STATUS_LABEL } from "@/lib/stays/constants";

export const dynamic = "force-dynamic";

const json = (v: unknown, status = 200) => NextResponse.json(v, { status, headers: { "cache-control": "no-store" } });
const email = (v: unknown) => {
  const e = String(v ?? "").trim().toLowerCase().slice(0, 160);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : "";
};
const phone = (v: unknown) => String(v ?? "").replace(/[^\d+]/g, "").slice(0, 16);
const pwOk = (p: unknown) => typeof p === "string" && p.length >= 8 && p.length <= 200;
const me = (h: any) => ({ id: h._id, hostCode: h.hostCode, name: h.name, email: h.email || "", phone: h.phone || "", whatsapp: h.whatsapp || "", payout: h.payout || "" });

function signedIn(h: any, body: unknown) {
  const res = json(body);
  res.cookies.set(hostCookie(hostToken(h)));
  return res;
}

async function ownProperty(c: C, actor: Actor, id: unknown): Promise<StoredProperty | null> {
  return c.properties.findOne({ _id: String(id || ""), hostId: actor.id, archived: { $ne: true } });
}

export async function GET(req: NextRequest) {
  const a = req.nextUrl.searchParams.get("a") || "";
  const c = await dbs();
  if (a === "invite") {
    const t = String(req.nextUrl.searchParams.get("token") || "");
    const h = t ? await c.hosts.findOne({ inviteHash: tokenHash(t), inviteExpires: { $gt: Date.now() } }) : null;
    return h ? json({ name: h.name, email: h.email || "" }) : json({ error: "This invite link is not valid any more. Ask for a new one." }, 404);
  }
  const actor = await hostFrom(req, c);
  if (a === "me") {
    const s = await getSettings(c);
    return json({ host: actor ? me((actor as any).host) : null, settings: publicSettings(s), amenities: await amenityDefs(c) });
  }
  if (!actor) return json({ error: "Please sign in" }, 401);
  if (a === "properties") {
    const list: StoredProperty[] = await c.properties.find({ hostId: actor.id, archived: { $ne: true } }).sort({ updatedAt: -1 }).toArray();
    return json(list.map(hostProperty));
  }
  if (a === "property") {
    const p = await ownProperty(c, actor, req.nextUrl.searchParams.get("id"));
    return p ? json(hostProperty(p)) : json({ error: "Not found" }, 404);
  }
  return json({ error: "Unknown request" }, 400);
}

export async function POST(req: NextRequest) {
  const a = req.nextUrl.searchParams.get("a") || "";
  if (!sameOrigin(req)) return json({ error: "Forbidden" }, 403);
  const b: any = await req.json().catch(() => ({}));
  const c = await dbs();
  const ip = clientIp(req);

  // ----- account -----
  if (a === "register") {
    if (!rateLimit(`stay-reg:${ip}`, 5, 3600_000)) return json({ error: "Too many attempts. Try again later." }, 429);
    const e = email(b.email), name = str(b.name, 80);
    if (!name || !e) return json({ error: "Please enter your name and a valid email" }, 400);
    if (!pwOk(b.password)) return json({ error: "Password must be at least 8 characters" }, 400);
    if (await c.hosts.findOne({ email: e })) return json({ error: "An account with this email already exists. Please sign in." }, 409);
    const h = { _id: rid(), hostCode: await nextHostCode(c), name, email: e, phone: phone(b.phone), whatsapp: phone(b.whatsapp || b.phone), payout: "", notes: "", status: "active", passwordHash: hashPassword(b.password), sv: 0, createdAt: Date.now(), lastLoginAt: Date.now(), source: "signup" };
    try { await c.hosts.insertOne(h); } catch { return json({ error: "An account with this email already exists. Please sign in." }, 409); }
    await notifyAdmin(c, "host", `New host registered: ${name} (${h.hostCode})`);
    return signedIn(h, { host: me(h) });
  }
  if (a === "invite_accept") {
    if (!rateLimit(`stay-inv:${ip}`, 10, 3600_000)) return json({ error: "Too many attempts. Try again later." }, 429);
    const t = String(b.token || "");
    const h = t ? await c.hosts.findOne({ inviteHash: tokenHash(t), inviteExpires: { $gt: Date.now() } }) : null;
    if (!h) return json({ error: "This invite link is not valid any more. Ask for a new one." }, 404);
    if (!pwOk(b.password)) return json({ error: "Password must be at least 8 characters" }, 400);
    const e = email(b.email) || h.email;
    if (!e) return json({ error: "Please enter your email" }, 400);
    const clash = await c.hosts.findOne({ email: e, _id: { $ne: h._id } });
    if (clash) return json({ error: "Another account already uses this email" }, 409);
    const sv = (h.sv || 0) + 1;
    await c.hosts.updateOne({ _id: h._id }, { $set: { email: e, passwordHash: hashPassword(b.password), status: "active", sv, lastLoginAt: Date.now() }, $unset: { inviteHash: "", inviteExpires: "" } });
    const fresh = await c.hosts.findOne({ _id: h._id });
    return signedIn(fresh, { host: me(fresh) });
  }
  if (a === "login") {
    const e = email(b.email);
    if (!rateLimit(`stay-login:${ip}`, 20, 900_000) || !rateLimit(`stay-login:${e}`, 8, 900_000)) return json({ error: "Too many attempts. Wait 15 minutes and try again." }, 429);
    const h = e ? await c.hosts.findOne({ email: e }) : null;
    if (!h || !h.passwordHash || !checkPassword(String(b.password || ""), h.passwordHash)) return json({ error: "Wrong email or password" }, 401);
    if (h.status !== "active") return json({ error: "Your account is paused. Please contact us." }, 403);
    await c.hosts.updateOne({ _id: h._id }, { $set: { lastLoginAt: Date.now() } });
    return signedIn(h, { host: me(h) });
  }
  if (a === "logout") {
    const res = json({ ok: true });
    res.cookies.set(hostCookie("", 0));
    return res;
  }

  const actor = await hostFrom(req, c);
  if (!actor) return json({ error: "Please sign in" }, 401);
  const host = (actor as any).host;

  if (a === "profile_save") {
    const name = str(b.name, 80);
    if (!name) return json({ error: "Please enter your name" }, 400);
    await c.hosts.updateOne({ _id: actor.id }, { $set: { name, phone: phone(b.phone), whatsapp: phone(b.whatsapp), payout: text(b.payout, 600), updatedAt: Date.now() } });
    return json({ host: me(await c.hosts.findOne({ _id: actor.id })) });
  }
  if (a === "password_change") {
    if (!checkPassword(String(b.current || ""), host.passwordHash)) return json({ error: "Current password is wrong" }, 400);
    if (!pwOk(b.password)) return json({ error: "New password must be at least 8 characters" }, 400);
    const sv = (host.sv || 0) + 1;
    await c.hosts.updateOne({ _id: actor.id }, { $set: { passwordHash: hashPassword(b.password), sv } });
    return signedIn({ ...host, sv }, { ok: true });
  }

  // ----- properties -----
  if (a === "property_create") {
    if (!rateLimit(`stay-hostnew:${actor.id}`, 30, 86400_000)) return json({ error: "Too many new properties today" }, 429);
    const s = await getSettings(c);
    const p = await createProperty(c, s, actor, "host", actor.id);
    const keys = new Set((await amenityDefs(c)).map((x) => x.key));
    const saved = await store(c, actor, p, withHostInput(p, cleanHostInput(b, keys)));
    return json(hostProperty(saved));
  }

  const p = await ownProperty(c, actor, b.id);
  if (!p) return json({ error: "Not found" }, 404);

  if (a === "property_save") {
    const keys = new Set((await amenityDefs(c)).map((x) => x.key));
    const input = cleanHostInput(b, keys);
    if (HOST_EDITS_DIRECTLY.includes(p.status)) {
      return json(hostProperty(await store(c, actor, p, withHostInput(p, input))));
    }
    // Live listing: the admin reviews the host's changes before guests see them.
    const next = await store(c, actor, p, { ...p, hostChanges: { data: input, at: Date.now() } }, "host_changes");
    await notifyAdmin(c, "changes", `${p.code}: ${host.name} edited a live listing (waiting for your review)`, p);
    return json({ ...hostProperty(next), notice: "Thanks! Your changes are saved and will appear once we review them." });
  }
  if (a === "property_action") {
    const t = transition("host", String(b.action), p.status);
    if (!t.ok) return json({ error: t.error }, 400);
    if (NEEDS_REASON.includes(b.action)) return json({ error: "Not allowed" }, 403);
    if (b.action === "submit") {
      const miss = missingForReview(p);
      if (miss.length) return json({ error: `Please fill in: ${miss.join(", ")}` }, 400);
    }
    const next = await store(c, actor, p, {
      ...p, ...(t.to ? { status: t.to } : {}), ...stampsFor(t.to, Date.now()),
      ...(b.action === "request_publish" ? { publishRequested: true } : {}),
    }, b.action);
    if (b.action === "submit") await notifyAdmin(c, "submission", `${p.code} "${p.title}" was submitted by ${host.name}`, p);
    if (b.action === "request_publish") await notifyAdmin(c, "publish_request", `${p.code}: ${host.name} asked for the listing to be published`, p);
    return json({ ...hostProperty(next), statusLabel: STATUS_LABEL[next.status] });
  }
  if (a.startsWith("media_") && a !== "media_approve" && a !== "media_keep") {
    const r = await mediaAction(c, actor, p, a, b);
    return json(r.property ? { ...r.body, property: hostProperty(r.property) } : r.body, r.status);
  }
  return json({ error: "Unknown request" }, 400);
}

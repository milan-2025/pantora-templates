/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LeadFlow CRM API (served to the browser at /CRM/api.php?r=... via a rewrite in next.config.ts).
 * Data lives in the site's existing MongoDB, in its own collections: crm_users, crm_leads, crm_settings.
 * Nothing here touches the shop, checkout or Payload admin collections.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getPayloadClient } from "@/lib/cms/queries";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const E = process.env;
const rid = () => crypto.randomBytes(9).toString("hex");
const digits = (p: any) => String(p ?? "").replace(/\D/g, "").slice(-10);
const json = (v: any, status = 200) => NextResponse.json(v, { status });
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// ---------- passwords + sessions (no extra dependencies) ----------
const hash = (pw: string) => {
  const s = crypto.randomBytes(16).toString("hex");
  return `scrypt$${s}$${crypto.scryptSync(pw, s, 64).toString("hex")}`;
};
const verify = (pw: string, h: string) => {
  const [, s, x] = String(h).split("$");
  return !!s && !!x && same(crypto.scryptSync(pw, s, 64).toString("hex"), x);
};
const sign = (p: string) => crypto.createHmac("sha256", `${E.PAYLOAD_SECRET || ""}:crm`).update(p).digest("base64url");
const makeToken = (u: any) => {
  const p = Buffer.from(JSON.stringify({ id: u._id, exp: Date.now() + 30 * 864e5 })).toString("base64url");
  return `${p}.${sign(p)}`;
};
const readToken = (req: NextRequest) => {
  const [p, s] = (req.cookies.get("crm_t")?.value || "").split(".");
  if (!p || !s || !same(s, sign(p))) return null;
  try {
    const u = JSON.parse(Buffer.from(p, "base64url").toString());
    return u.exp > Date.now() ? (u.id as string) : null;
  } catch {
    return null;
  }
};

// ---------- database (re-uses Payload's MongoDB connection) ----------
async function dbs() {
  const db = (await getPayloadClient()).db.connection.db as any;
  return { users: db.collection("crm_users"), leads: db.collection("crm_leads"), settings: db.collection("crm_settings") };
}
type C = Awaited<ReturnType<typeof dbs>>;
const teamNames = async (c: C) => (await c.users.find({}).sort({ name: 1 }).toArray()).map((u: any) => u.name as string);
const row = (d: any) => ({ id: d._id, ...d.data });

async function seed(c: C) {
  if (await c.users.countDocuments()) return;
  await c.users.createIndex({ email: 1 }, { unique: true });
  const list = (E.CRM_USERS || "").split(",").filter(Boolean);
  for (let i = 0; i < list.length; i++) {
    const [n, e, p] = list[i].split("|");
    if (n && e && p) await c.users.insertOne({ _id: rid(), name: n.trim(), email: e.trim().toLowerCase(), pass: hash(p), role: i === 0 ? "admin" : "agent" });
  }
}

// ---------- building a lead from a row of columns (Meta webhook + Google Sheets) ----------
const find = (raw: Record<string, string>, exact: string[], like: string[], ex?: RegExp): [string | null, string] => {
  for (const e of exact) for (const [k, v] of Object.entries(raw)) if (v !== "" && k.toLowerCase() === e) return [k, v];
  for (const [k, v] of Object.entries(raw)) if (v !== "" && !(ex && ex.test(k.toLowerCase()))) for (const x of like) if (k.toLowerCase().includes(x)) return [k, v];
  return [null, ""];
};
function buildLead(raw: Record<string, string>, source: string, imp: string) {
  const used: (string | null)[] = [];
  let [k, name] = find(raw, ["full_name", "full name", "name", "customer name"], ["name"], /campaign|adset|ad_|ad name|form|page|company/);
  used.push(k);
  if (!name) {
    const [k1, f1] = find(raw, ["first_name", "first name"], []);
    const [k2, f2] = find(raw, ["last_name", "last name"], []);
    name = `${f1} ${f2}`.trim();
    used.push(k1, k2);
  }
  let phone: string;
  [k, phone] = find(raw, ["phone_number", "phone", "mobile", "whatsapp"], ["phone", "mobile", "whatsapp"], /name/);
  used.push(k);
  phone = phone.replace(/^p:/, "");
  let email: string;
  [k, email] = find(raw, ["email", "e-mail"], ["mail"]);
  used.push(k);
  email = email.toLowerCase();
  const pick = (ex: string[], like: string[]) => { const [kk, v] = find(raw, ex, like); used.push(kk); return v; };
  const campaign = pick(["campaign_name", "campaign"], ["campaign"]);
  const adset = pick(["adset_name", "ad set name", "adset"], []);
  const ad = pick(["ad_name", "ad name"], []);
  const ts = pick(["created_time", "timestamp", "created", "date"], ["time", "date"]);
  const extra: Record<string, string> = {};
  for (const [kk, v] of Object.entries(raw)) if (v !== "" && !used.includes(kk)) extra[kk] = v;
  const t = ts ? Date.parse(ts) : NaN;
  if (!name && !phone && !email) return null;
  return { name, phone, email, campaign, adset, ad, source, imp, raw, extra, status: "New", owner: "", created: isNaN(t) ? Date.now() : t, notes: [] as any[] };
}
async function addLead(c: C, d: any) {
  const pk = digits(d.phone);
  if ((pk && (await c.leads.findOne({ pk }))) || (d.email && (await c.leads.findOne({ "data.email": d.email })))) return false;
  const names = await teamNames(c);
  const n = await c.leads.countDocuments();
  d.owner = names.length ? names[n % names.length] : "";
  await c.leads.insertOne({ _id: rid(), pk, created: d.created, data: d });
  return true;
}
async function ingestMeta(c: C, id: string) {
  const g = E.META_GRAPH_VERSION || "v23.0";
  const j: any = await (await fetch(`https://graph.facebook.com/${g}/${id}?access_token=${encodeURIComponent(E.META_PAGE_TOKEN || "")}`)).json();
  if (!j.field_data) throw new Error(JSON.stringify(j));
  const raw: Record<string, string> = {};
  for (const x of j.field_data) raw[String(x.name)] = String((x.values || [])[0] ?? "");
  Object.assign(raw, { campaign_name: j.campaign_name || "", adset_name: j.adset_name || "", ad_name: j.ad_name || "" });
  const d = buildLead(raw, "Meta Lead Ads", "meta");
  if (d) await addLead(c, d);
}

// ---------- the API ----------
async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const r = url.searchParams.get("r") || "";
  const raw = req.method === "POST" ? await req.text() : "";
  let body: any = {};
  try { body = JSON.parse(raw) || {}; } catch { /* empty body */ }
  const c = await dbs();

  // Meta Lead Ads webhook (token + signature protected, no login)
  if (r === "webhook") {
    if (req.method === "GET") {
      const ok = E.META_VERIFY_TOKEN && url.searchParams.get("hub.verify_token") === E.META_VERIFY_TOKEN;
      return ok ? new Response(url.searchParams.get("hub.challenge") || "", { headers: { "content-type": "text/plain" } }) : new Response("forbidden", { status: 403 });
    }
    const exp = "sha256=" + crypto.createHmac("sha256", E.META_APP_SECRET || "").update(raw).digest("hex");
    if (!E.META_APP_SECRET || !same(req.headers.get("x-hub-signature-256") || "", exp)) return new Response("forbidden", { status: 403 });
    for (const en of body.entry || []) for (const ch of en.changes || []) if (ch.field === "leadgen") {
      try { await ingestMeta(c, ch.value.leadgen_id); } catch (e) { console.error("[crm] lead error", e); }
    }
    return json({});
  }

  // Google Sheets / form webhook
  if (r === "sheet") {
    if (!E.SHEET_TOKEN || !same(E.SHEET_TOKEN, url.searchParams.get("token") || "")) return json({ error: "forbidden" }, 403);
    const rows: any[] = Array.isArray(body.rows) ? body.rows : [body];
    let added = 0, skipped = 0;
    for (const row0 of rows.slice(0, 500)) {
      if (!row0 || typeof row0 !== "object") continue;
      const rw: Record<string, string> = {};
      for (const [k, v] of Object.entries(row0)) rw[k.trim()] = String(v ?? "").trim();
      const d = buildLead(rw, "Google Sheet", "sheet");
      if (!d) continue;
      (await addLead(c, d)) ? added++ : skipped++;
    }
    return json({ added, skipped });
  }

  // Login
  if (r === "login") {
    if (!rateLimit(`crm-login:${clientIp(req)}`, 10, 10 * 60_000)) return json({ error: "Too many attempts. Try again in a few minutes." }, 429);
    await seed(c);
    const u = await c.users.findOne({ email: String(body.email || "").trim().toLowerCase() });
    if (u && verify(String(body.password || ""), u.pass)) {
      const res = json({ name: u.name });
      res.cookies.set("crm_t", makeToken(u), { httpOnly: true, secure: E.NODE_ENV === "production", sameSite: "lax", path: "/CRM", maxAge: 30 * 86400 });
      return res;
    }
    await new Promise((ok) => setTimeout(ok, 1000));
    return json({ error: "bad" }, 401);
  }
  if (r === "logout") {
    const res = json({ ok: 1 });
    res.cookies.set("crm_t", "", { path: "/CRM", maxAge: 0 });
    return res;
  }

  // Everything below needs a logged-in user (re-checked against the database on every call)
  const uid = readToken(req);
  const U = uid ? await c.users.findOne({ _id: uid }) : null;
  if (!U) return json({ error: "auth" }, 401);
  const admin = U.role === "admin";
  const only = () => (admin ? null : json({ error: "Admins only" }, 403));
  const mine = (d: any) => admin || (d?.owner ?? "") === U.name;
  const clean = (o: any) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !k.startsWith("$") && !k.includes(".")));
  const id = url.searchParams.get("id") || "";
  const key = url.searchParams.get("k") || "";

  switch (r) {
    case "me": return json({ id: U._id, name: U.name, role: U.role });
    case "leads": {
      const docs = await c.leads.find(admin ? {} : { "data.owner": U.name }).sort({ created: -1 }).limit(5000).toArray();
      return json(docs.map(row));
    }
    case "leads_add": {
      const d = clean(body) as any;
      if (!admin && !d.owner) d.owner = U.name;
      const nid = rid();
      await c.leads.insertOne({ _id: nid, pk: digits(d.phone), created: d.created || Date.now(), data: d });
      return json({ id: nid });
    }
    case "leads_update": {
      const old = await c.leads.findOne({ _id: id });
      if (!old) return json({ error: "nf" }, 404);
      if (!mine(old.data)) return json({ error: "Not your lead" }, 403);
      const set: any = {};
      for (const [k, v] of Object.entries(clean(body))) set[`data.${k}`] = v;
      if ("phone" in body) set.pk = digits(body.phone);
      if (Object.keys(set).length) await c.leads.updateOne({ _id: id }, { $set: set });
      return json({ ok: 1 });
    }
    case "leads_delete": { const x = only(); if (x) return x; await c.leads.deleteOne({ _id: id }); return json({ ok: 1 }); }
    case "settings": {
      if (key === "team") return json({ names: await teamNames(c) });
      const x = await c.settings.findOne({ _id: key });
      return json(x ? x.v : null);
    }
    case "settings_set": { const x = only(); if (x) return x; await c.settings.replaceOne({ _id: key }, { _id: key, v: body }, { upsert: true }); return json({ ok: 1 }); }
    case "users_list": {
      const x = only(); if (x) return x;
      return json((await c.users.find({}).sort({ name: 1 }).toArray()).map((u: any) => ({ id: u._id, name: u.name, email: u.email, role: u.role })));
    }
    case "user_save": {
      const x = only(); if (x) return x;
      const n = String(body.name || "").trim(), e = String(body.email || "").trim().toLowerCase(), ro = body.role === "admin" ? "admin" : "agent", pw = String(body.password || ""), uid2 = String(body.id || "");
      if (!n || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return json({ error: "Enter a name and a valid email" }, 400);
      if (await c.users.findOne({ $or: [{ name: n }, { email: e }], _id: { $ne: uid2 } })) return json({ error: "That name or email is already used" }, 400);
      if (pw && pw.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
      if (!uid2) {
        if (!pw) return json({ error: "Set a password (min 8 characters)" }, 400);
        await c.users.insertOne({ _id: rid(), name: n, email: e, pass: hash(pw), role: ro });
      } else {
        const old = await c.users.findOne({ _id: uid2 });
        if (!old) return json({ error: "User not found" }, 404);
        if (old.role === "admin" && ro !== "admin" && (await c.users.countDocuments({ role: "admin" })) < 2) return json({ error: "Keep at least one admin" }, 400);
        await c.users.updateOne({ _id: uid2 }, { $set: { name: n, email: e, role: ro, ...(pw ? { pass: hash(pw) } : {}) } });
        if (old.name !== n) await c.leads.updateMany({ "data.owner": old.name }, { $set: { "data.owner": n } });
      }
      return json({ ok: 1 });
    }
    case "user_delete": {
      const x = only(); if (x) return x;
      if (body.id === U._id) return json({ error: "You cannot delete yourself" }, 400);
      await c.users.deleteOne({ _id: String(body.id || "") });
      return json({ ok: 1 });
    }
    case "password": {
      if (!verify(String(body.old || ""), U.pass)) return json({ error: "Current password is wrong" }, 400);
      if (String(body.new || "").length < 8) return json({ error: "New password must be at least 8 characters" }, 400);
      await c.users.updateOne({ _id: U._id }, { $set: { pass: hash(String(body.new)) } });
      return json({ ok: 1 });
    }
  }
  return json({ error: "unknown" }, 404);
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }

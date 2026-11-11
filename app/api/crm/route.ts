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

// ---------- plans ----------
const PLANS: Record<string, { users: number; leads: number }> = {
  trial: { users: 5, leads: 500 },
  starter: { users: 3, leads: 2000 },
  growth: { users: 10, leads: 10000 },
  internal: { users: 1e9, leads: 1e9 },
};
const isSA = (email: string) => (E.CRM_SUPERADMINS || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean).includes(String(email).toLowerCase());
const state = (w: any) => {
  const now = Date.now();
  const end = w.plan === "trial" ? w.trialEnds : w.validUntil;
  const ro = w.plan === "internal" ? false : !!end && end < now;
  return { ro, daysLeft: end && w.plan !== "internal" ? Math.ceil((end - now) / 864e5) : null };
};

// ---------- database (re-uses Payload's MongoDB connection) ----------
async function dbs() {
  const db = (await getPayloadClient()).db.connection.db as any;
  return { users: db.collection("crm_users"), leads: db.collection("crm_leads"), settings: db.collection("crm_settings"), ws: db.collection("crm_workspaces") };
}
type C = Awaited<ReturnType<typeof dbs>>;
const teamNames = async (c: C, ws: string) => (await c.users.find({ ws }).sort({ name: 1 }).toArray()).map((u: any) => u.name as string);
const row = (d: any) => ({ id: d._id, ...d.data });
const sk = (ws: string, k: string) => `${ws}:${k}`;

async function newWs(c: C, name: string, plan: string, trialDays: number) {
  const w = { _id: rid(), name, plan, status: "active", createdAt: Date.now(), trialEnds: Date.now() + trialDays * 864e5, sheetToken: crypto.randomBytes(18).toString("hex") };
  await c.ws.insertOne(w);
  return w;
}
// Runs once per server start: unique email index, and moves the original single-company data into its own "internal" workspace.
let booted = false;
async function boot(c: C) {
  if (booted) return;
  await c.users.createIndex({ email: 1 }, { unique: true }).catch(() => {});
  let w = await c.ws.findOne({ plan: "internal" });
  const old = await c.users.countDocuments({ ws: { $exists: false } });
  const list = (E.CRM_USERS || "").split(",").filter(Boolean);
  if (!w && (old || list.length)) w = await newWs(c, E.CRM_COMPANY || "Pandora Templates", "internal", 0);
  if (w) {
    await c.users.updateMany({ ws: { $exists: false } }, { $set: { ws: w._id } });
    await c.leads.updateMany({ ws: { $exists: false } }, { $set: { ws: w._id } });
    for (const s of await c.settings.find({ ws: { $exists: false } }).toArray()) {
      await c.settings.insertOne({ _id: sk(w._id, s._id), ws: w._id, k: s._id, v: s.v });
      await c.settings.deleteOne({ _id: s._id });
    }
    if (!(await c.users.countDocuments({ ws: w._id }))) {
      for (let i = 0; i < list.length; i++) {
        const [n, e, p] = list[i].split("|");
        if (n && e && p) await c.users.insertOne({ _id: rid(), ws: w._id, name: n.trim(), email: e.trim().toLowerCase(), pass: hash(p), role: i === 0 ? "admin" : "agent" });
      }
    }
  }
  booted = true;
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
async function addLead(c: C, w: any, d: any) {
  const pk = digits(d.phone);
  if ((pk && (await c.leads.findOne({ ws: w._id, pk }))) || (d.email && (await c.leads.findOne({ ws: w._id, "data.email": d.email })))) return "dup";
  if ((await c.leads.countDocuments({ ws: w._id })) >= PLANS[w.plan].leads) return "limit";
  const names = await teamNames(c, w._id);
  const n = await c.leads.countDocuments({ ws: w._id });
  d.owner = names.length ? names[n % names.length] : "";
  await c.leads.insertOne({ _id: rid(), ws: w._id, pk, created: d.created, data: d });
  return "ok";
}
async function ingestMeta(c: C, w: any, id: string) {
  const g = E.META_GRAPH_VERSION || "v23.0";
  const j: any = await (await fetch(`https://graph.facebook.com/${g}/${id}?access_token=${encodeURIComponent(E.META_PAGE_TOKEN || "")}`)).json();
  if (!j.field_data) throw new Error(JSON.stringify(j));
  const raw: Record<string, string> = {};
  for (const x of j.field_data) raw[String(x.name)] = String((x.values || [])[0] ?? "");
  Object.assign(raw, { campaign_name: j.campaign_name || "", adset_name: j.adset_name || "", ad_name: j.ad_name || "" });
  const d = buildLead(raw, "Meta Lead Ads", "meta");
  if (d) await addLead(c, w, d);
}

const WRITES = new Set(["leads_add", "leads_update", "leads_delete", "settings_set", "user_save"]);
const setCookie = (res: NextResponse, u: any) => res.cookies.set("crm_t", makeToken(u), { httpOnly: true, secure: E.NODE_ENV === "production", sameSite: "lax", path: "/CRM", maxAge: 30 * 86400 });

// ---------- the API ----------
async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const r = url.searchParams.get("r") || "";
  const raw = req.method === "POST" ? await req.text() : "";
  let body: any = {};
  try { body = JSON.parse(raw) || {}; } catch { /* empty body */ }
  const c = await dbs();
  await boot(c);

  // Meta Lead Ads webhook: delivers into the internal workspace (per-customer Meta connections come later)
  if (r === "webhook") {
    if (req.method === "GET") {
      const ok = E.META_VERIFY_TOKEN && url.searchParams.get("hub.verify_token") === E.META_VERIFY_TOKEN;
      return ok ? new Response(url.searchParams.get("hub.challenge") || "", { headers: { "content-type": "text/plain" } }) : new Response("forbidden", { status: 403 });
    }
    const exp = "sha256=" + crypto.createHmac("sha256", E.META_APP_SECRET || "").update(raw).digest("hex");
    if (!E.META_APP_SECRET || !same(req.headers.get("x-hub-signature-256") || "", exp)) return new Response("forbidden", { status: 403 });
    const w = await c.ws.findOne({ plan: "internal" });
    if (!w) return new Response("no workspace", { status: 404 });
    for (const en of body.entry || []) for (const ch of en.changes || []) if (ch.field === "leadgen") {
      try { await ingestMeta(c, w, ch.value.leadgen_id); } catch (e) { console.error("[crm] lead error", e); }
    }
    return json({});
  }

  // Google Sheets / form webhook: each workspace has its own secret token
  if (r === "sheet") {
    const tk = url.searchParams.get("token") || "";
    let w = tk.length > 10 ? await c.ws.findOne({ sheetToken: tk }) : null;
    if (!w && E.SHEET_TOKEN && same(E.SHEET_TOKEN, tk)) w = await c.ws.findOne({ plan: "internal" });
    if (!w || w.status === "suspended") return json({ error: "forbidden" }, 403);
    if (state(w).ro) return json({ error: "Subscription ended" }, 402);
    const rows: any[] = Array.isArray(body.rows) ? body.rows : [body];
    let added = 0, skipped = 0;
    for (const row0 of rows.slice(0, 500)) {
      if (!row0 || typeof row0 !== "object") continue;
      const rw: Record<string, string> = {};
      for (const [k, v] of Object.entries(row0)) rw[k.trim()] = String(v ?? "").trim();
      const d = buildLead(rw, "Google Sheet", "sheet");
      if (!d) continue;
      (await addLead(c, w, d)) === "ok" ? added++ : skipped++;
    }
    return json({ added, skipped });
  }

  // Sign up a new company (creates a workspace on a 14-day trial)
  if (r === "signup") {
    if (!rateLimit(`crm-signup:${clientIp(req)}`, 5, 3600_000)) return json({ error: "Too many signups from this network. Try again later." }, 429);
    if (body.website) return json({ ok: 1 }); // honeypot field for bots
    const company = String(body.company || "").trim().slice(0, 80), name = String(body.name || "").trim().slice(0, 60), email = String(body.email || "").trim().toLowerCase(), pw = String(body.password || "");
    if (!company || !name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter your company, name and a valid email" }, 400);
    if (pw.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
    if (await c.users.findOne({ email })) return json({ error: "An account with this email already exists. Please log in." }, 400);
    const w = await newWs(c, company, "trial", 14);
    const u = { _id: rid(), ws: w._id, name, email, pass: hash(pw), role: "admin" };
    await c.users.insertOne(u);
    const res = json({ name });
    setCookie(res, u);
    return res;
  }

  // Login
  if (r === "login") {
    if (!rateLimit(`crm-login:${clientIp(req)}`, 10, 10 * 60_000)) return json({ error: "Too many attempts. Try again in a few minutes." }, 429);
    const u = await c.users.findOne({ email: String(body.email || "").trim().toLowerCase() });
    if (u && verify(String(body.password || ""), u.pass)) {
      const res = json({ name: u.name });
      setCookie(res, u);
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

  // Everything below needs a logged-in user; user and workspace are re-checked against the database on every call
  const uid = readToken(req);
  const U = uid ? await c.users.findOne({ _id: uid }) : null;
  const W = U ? await c.ws.findOne({ _id: U.ws }) : null;
  if (!U || !W) return json({ error: "auth" }, 401);
  if (W.status === "suspended") return json({ error: "This account is suspended. Please contact support." }, 403);
  const st = state(W);
  if (st.ro && WRITES.has(r)) return json({ error: "Your trial or subscription has ended. Your data is safe. Contact us to continue." }, 402);
  const ws = W._id as string;
  const admin = U.role === "admin";
  const sa = isSA(U.email);
  const only = () => (admin ? null : json({ error: "Admins only" }, 403));
  const mine = (d: any) => admin || (d?.owner ?? "") === U.name;
  const clean = (o: any) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !k.startsWith("$") && !k.includes(".")));
  const id = url.searchParams.get("id") || "";
  const key = url.searchParams.get("k") || "";

  switch (r) {
    case "me": return json({ id: U._id, name: U.name, role: U.role, sa, ws: { name: W.name, plan: W.plan, daysLeft: st.daysLeft, readonly: st.ro, sheetToken: admin ? W.sheetToken : undefined } });
    case "leads": {
      const docs = await c.leads.find(admin ? { ws } : { ws, "data.owner": U.name }).sort({ created: -1 }).limit(5000).toArray();
      return json(docs.map(row));
    }
    case "leads_add": {
      if ((await c.leads.countDocuments({ ws })) >= PLANS[W.plan].leads) return json({ error: `Your plan allows ${PLANS[W.plan].leads} leads. Contact us to upgrade.` }, 403);
      const d = clean(body) as any;
      if (!admin && !d.owner) d.owner = U.name;
      const nid = rid();
      await c.leads.insertOne({ _id: nid, ws, pk: digits(d.phone), created: d.created || Date.now(), data: d });
      return json({ id: nid });
    }
    case "leads_update": {
      const old = await c.leads.findOne({ _id: id, ws });
      if (!old) return json({ error: "nf" }, 404);
      if (!mine(old.data)) return json({ error: "Not your lead" }, 403);
      const set: any = {};
      for (const [k, v] of Object.entries(clean(body))) set[`data.${k}`] = v;
      if ("phone" in body) set.pk = digits(body.phone);
      if (Object.keys(set).length) await c.leads.updateOne({ _id: id, ws }, { $set: set });
      return json({ ok: 1 });
    }
    case "leads_delete": { const x = only(); if (x) return x; await c.leads.deleteOne({ _id: id, ws }); return json({ ok: 1 }); }
    case "settings": {
      if (key === "team") return json({ names: await teamNames(c, ws) });
      const x = await c.settings.findOne({ _id: sk(ws, key) });
      return json(x ? x.v : null);
    }
    case "settings_set": { const x = only(); if (x) return x; await c.settings.replaceOne({ _id: sk(ws, key) }, { _id: sk(ws, key), ws, k: key, v: body }, { upsert: true }); return json({ ok: 1 }); }
    case "users_list": {
      const x = only(); if (x) return x;
      return json((await c.users.find({ ws }).sort({ name: 1 }).toArray()).map((u: any) => ({ id: u._id, name: u.name, email: u.email, role: u.role })));
    }
    case "user_save": {
      const x = only(); if (x) return x;
      const n = String(body.name || "").trim(), e = String(body.email || "").trim().toLowerCase(), ro = body.role === "admin" ? "admin" : "agent", pw = String(body.password || ""), uid2 = String(body.id || "");
      if (!n || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return json({ error: "Enter a name and a valid email" }, 400);
      if (await c.users.findOne({ $or: [{ ws, name: n }, { email: e }], _id: { $ne: uid2 } })) return json({ error: "That name or email is already used" }, 400);
      if (pw && pw.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
      if (!uid2) {
        if (!pw) return json({ error: "Set a password (min 8 characters)" }, 400);
        if ((await c.users.countDocuments({ ws })) >= PLANS[W.plan].users) return json({ error: `Your plan allows ${PLANS[W.plan].users} users. Contact us to upgrade.` }, 403);
        await c.users.insertOne({ _id: rid(), ws, name: n, email: e, pass: hash(pw), role: ro });
      } else {
        const old = await c.users.findOne({ _id: uid2, ws });
        if (!old) return json({ error: "User not found" }, 404);
        if (old.role === "admin" && ro !== "admin" && (await c.users.countDocuments({ ws, role: "admin" })) < 2) return json({ error: "Keep at least one admin" }, 400);
        await c.users.updateOne({ _id: uid2 }, { $set: { name: n, email: e, role: ro, ...(pw ? { pass: hash(pw) } : {}) } });
        if (old.name !== n) await c.leads.updateMany({ ws, "data.owner": old.name }, { $set: { "data.owner": n } });
      }
      return json({ ok: 1 });
    }
    case "user_delete": {
      const x = only(); if (x) return x;
      if (body.id === U._id) return json({ error: "You cannot delete yourself" }, 400);
      await c.users.deleteOne({ _id: String(body.id || ""), ws });
      return json({ ok: 1 });
    }
    case "password": {
      if (!verify(String(body.old || ""), U.pass)) return json({ error: "Current password is wrong" }, 400);
      if (String(body.new || "").length < 8) return json({ error: "New password must be at least 8 characters" }, 400);
      await c.users.updateOne({ _id: U._id }, { $set: { pass: hash(String(body.new)) } });
      return json({ ok: 1 });
    }
    // ----- platform admin (you): manage every customer company -----
    case "sa_list": {
      if (!sa) return json({ error: "Not allowed" }, 403);
      const all = await c.ws.find({}).sort({ createdAt: -1 }).toArray();
      return json(await Promise.all(all.map(async (w: any) => ({ id: w._id, name: w.name, plan: w.plan, status: w.status, createdAt: w.createdAt, trialEnds: w.trialEnds, validUntil: w.validUntil || null, users: await c.users.countDocuments({ ws: w._id }), leads: await c.leads.countDocuments({ ws: w._id }) }))));
    }
    case "sa_update": {
      if (!sa) return json({ error: "Not allowed" }, 403);
      const set: any = {};
      if (body.plan) { if (!PLANS[body.plan]) return json({ error: "Unknown plan" }, 400); set.plan = body.plan; }
      if (body.status === "active" || body.status === "suspended") set.status = body.status;
      if ("validUntil" in body) { const t = body.validUntil ? Date.parse(`${body.validUntil}T23:59:59`) : NaN; set.validUntil = isNaN(t) ? null : t; }
      if (+body.extendDays > 0) set.trialEnds = Math.max(Date.now(), (await c.ws.findOne({ _id: String(body.id) }))?.trialEnds || 0) + Math.min(+body.extendDays, 365) * 864e5;
      await c.ws.updateOne({ _id: String(body.id || "") }, { $set: set });
      return json({ ok: 1 });
    }
  }
  return json({ error: "unknown" }, 404);
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }

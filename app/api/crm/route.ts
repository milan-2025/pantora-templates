/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LeadFlow CRM API (served to the browser at /CRM/api.php?r=... via a rewrite in next.config.ts).
 * Data lives in the site's existing MongoDB, in its own collections: crm_users, crm_leads, crm_settings.
 * Nothing here touches the shop, checkout or Payload admin collections.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getPayloadClient } from "@/lib/cms/queries";
import { getPaymentProvider } from "@/lib/payments";
import { BILLING_MONTHS, BillingError, CRM_PRICES, markCrmPaid, quoteCrm } from "@/lib/crm/billing";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import {
  UNIT_STATUSES, UNIT_LIMITS, PROJECT_TYPES, canRelease, canTransition, cleanUnit, expiredHoldFilter,
  holdFilter, holdHours, modeOf, releaseUpdate, type UnitStatus,
} from "@/lib/crm/realestate";
import { buildReport } from "@/lib/crm/reports";
import { cleanImages, cleanMapUrl, formatCode, projectPhotoId, reservedCodes, resolveProject, unitLabel } from "@/lib/crm/property";
import { cleanPinned } from "@/lib/crm/notes";
import { MAX_DOCS, cleanDocName, cleanVideos, docFolder, docInFolder } from "@/lib/crm/media";
import { v2 as cloudinary } from "cloudinary";
import { cleanEnquiry, cleanPhone10, parseAmenities, safeHttpsUrl } from "@/lib/crm/publicPage";
import { canChangeStatus, cleanPct, commissionAmount, effectiveRate, partnerLeadFields, partnerStats, shouldCreate, summarize } from "@/lib/crm/commission";
import { addVisit, cleanOutcome, cleanVisit, listVisits, removeVisit, rescheduleVisit, stageOnDone, stageOnSchedule, updateVisit, visitNote } from "@/lib/crm/visits";

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
  return { users: db.collection("crm_users"), leads: db.collection("crm_leads"), settings: db.collection("crm_settings"), ws: db.collection("crm_workspaces"), projects: db.collection("crm_projects"), units: db.collection("crm_units"), commissions: db.collection("crm_commissions") };
}
type C = Awaited<ReturnType<typeof dbs>>;
/** Create (or cancel) the channel-partner commission when a unit is booked / released. */
async function syncCommission(c: C, ws: string, unit: any, lead: any, to: string) {
  if (to === "available" || to === "hard_hold") {
    await c.commissions.updateMany({ ws, unitId: unit._id, status: { $in: ["pending", "approved"] } }, { $set: { status: "cancelled", updated: Date.now() } });
    return;
  }
  if (to !== "booked" && to !== "sold") return;
  const l = lead || (unit.leadId ? await c.leads.findOne({ _id: unit.leadId, ws }) : null);
  const pid = l?.data?.partnerId;
  if (!pid) return;
  const partner = await c.users.findOne({ _id: pid, ws, role: "partner" });
  if (!partner) return;
  const proj = await c.projects.findOne({ _id: unit.project, ws });
  const rate = effectiveRate(partner.rate, proj?.commissionPct);
  if (!shouldCreate(pid, rate, unit.price)) return;
  if (await c.commissions.findOne({ ws, unitId: unit._id, leadId: l._id, status: { $ne: "cancelled" } })) return;
  await c.commissions.insertOne({
    _id: rid(), ws, leadId: l._id, leadName: l.data?.name || "", unitId: unit._id, unitLabel: `${unit.tower ? unit.tower + " " : ""}${unit.no}`,
    projectId: unit.project, projectName: proj?.name || "", partnerId: partner._id, partnerName: partner.name,
    saleValue: unit.price, rate, amount: commissionAmount(unit.price, rate), status: "pending", created: Date.now(), updated: Date.now(),
  });
}

/** Next Property ID for a company (PR-001, PR-002 ...). Atomic, so two admins adding projects at once never clash. */
async function nextCode(c: C, ws: string) {
  const r: any = await c.ws.findOneAndUpdate({ _id: ws }, { $inc: { propSeq: 1 } }, { returnDocument: "after" });
  const doc = r && "value" in r && r.value !== undefined && !("propSeq" in r) ? r.value : r;
  return formatCode(doc?.propSeq || 1);
}
/** Best-effort removal of a unit's private files from Cloudinary (used when units or projects are deleted). */
async function dropDocs(list: any[]) {
  for (const d of list || []) { try { await cloudinary.uploader.destroy(d.pid, { resource_type: "raw", type: "private", invalidate: true }); } catch (e) { console.error("[crm] doc delete", e); } }
}

/** Reserve `count` unit IDs (PR-001-U001 ...) in one project. Gives the project a Property ID first if it has none. */
async function reserveUnitCodes(c: C, ws: string, proj: any, count: number): Promise<string[]> {
  if (count <= 0) return [];
  let code = proj.code;
  if (!code) { code = await nextCode(c, ws); await c.projects.updateOne({ _id: proj._id, ws, code: { $exists: false } }, { $set: { code } }); code = (await c.projects.findOne({ _id: proj._id, ws }))?.code || code; }
  const r: any = await c.projects.findOneAndUpdate({ _id: proj._id, ws }, { $inc: { unitSeq: count } }, { returnDocument: "after" });
  const doc = r && "value" in r && r.value !== undefined && !("unitSeq" in r) ? r.value : r;
  return reservedCodes(code, doc?.unitSeq || count, count);
}
/** Link a lead to a unit (and so to its project). An unknown or other-company unit clears the link. */
async function linkUnit(c: C, ws: string, unitId: unknown) {
  const u = unitId ? await c.units.findOne({ _id: String(unitId), ws }) : null;
  if (!u) return { unitId: "", unitCode: "", unit: "" } as Record<string, string>;
  const pr = await c.projects.findOne({ _id: u.project, ws });
  return { unitId: u._id, unitCode: u.code || "", unit: unitLabel(u), ...(pr ? { projectId: pr._id, project: pr.name } : {}) } as Record<string, string>;
}

/** Links a lead to one of the company's projects (by id, or by typed name for older data). */
async function linkProject(c: C, ws: string, input: { projectId?: unknown; project?: unknown }) {
  const ps = await c.projects.find({ ws }, { projection: { name: 1 } }).toArray();
  return resolveProject(ps.map((p: any) => ({ id: p._id, name: p.name })), input);
}

const teamNames = async (c: C, ws: string) => (await c.users.find({ ws, role: { $ne: "partner" } }).sort({ name: 1 }).toArray()).map((u: any) => u.name as string);
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
  // Real estate mode: one unit number per project per company, and fast status lookups
  await c.units.createIndex({ ws: 1, project: 1, no: 1 }, { unique: true }).catch(() => {});
  await c.units.createIndex({ ws: 1, status: 1 }).catch(() => {});
  await c.projects.createIndex({ ws: 1, name: 1 }).catch(() => {});
  await c.commissions.createIndex({ ws: 1, partnerId: 1, status: 1 }).catch(() => {});
  await c.projects.createIndex({ pub: 1 }).catch(() => {});
  await c.projects.createIndex({ ws: 1, code: 1 }, { unique: true, partialFilterExpression: { code: { $type: "string" } } }).catch(() => {});
  await c.leads.createIndex({ ws: 1, "data.projectId": 1 }).catch(() => {});
  await c.units.createIndex({ pub: 1 }).catch(() => {});
  await c.ws.createIndex({ catPub: 1 }).catch(() => {});
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
async function addLead(c: C, w: any, d: any, owner?: string) {
  const pk = digits(d.phone);
  if ((pk && (await c.leads.findOne({ ws: w._id, pk }))) || (d.email && (await c.leads.findOne({ ws: w._id, "data.email": d.email })))) return "dup";
  if ((await c.leads.countDocuments({ ws: w._id })) >= PLANS[w.plan].leads) return "limit";
  const names = await teamNames(c, w._id);
  const n = await c.leads.countDocuments({ ws: w._id });
  d.owner = owner || (names.length ? names[n % names.length] : "");
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

const WRITES = new Set([
  "leads_add", "leads_update", "leads_delete", "settings_set", "user_save",
  "mode_set", "project_save", "project_delete", "unit_save", "units_import", "unit_delete", "unit_hold", "unit_release", "unit_status",
  "visit_save", "visit_done", "visit_delete", "commission_update", "unit_doc_sign", "unit_doc_add", "unit_doc_delete",
]);
// Only available when the company has switched Real estate mode on (Menu > Real estate mode).
const RE_ACTIONS = new Set(["projects_list", "project_save", "project_delete", "units_list", "unit_save", "units_import", "unit_delete", "unit_hold", "unit_release", "unit_status", "visits_list", "visit_save", "visit_done", "visit_delete", "partners_list", "commissions_list", "commission_update", "report", "upload_sign", "unit_doc_sign", "unit_doc_add", "unit_doc_url", "unit_doc_delete"]);
// Channel partners can only use these (their own leads, the project list, and their own commissions).
const PARTNER_OK = new Set(["me", "leads", "leads_add", "leads_update", "settings", "projects_list", "units_list", "commissions_list", "password"]);
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

  // Public project page enquiry form (no login): creates a lead in the company that owns the project
  if (r === "enquiry") {
    if (!rateLimit(`enq:${clientIp(req)}`, 5, 36e5)) return json({ error: "Too many enquiries. Please call us instead." }, 429);
    if (String(body.website || "")) return json({ ok: 1 }); // hidden spam-trap field was filled in by a bot
    const pub = String(body.pub || "");
    const proj = pub.length >= 10 ? await c.projects.findOne({ pub, published: true }) : null;
    const w = proj ? await c.ws.findOne({ _id: proj.ws }) : null;
    if (!proj || !w || w.status === "suspended" || modeOf(w) !== "realestate" || state(w).ro) return json({ error: "This project is not taking enquiries right now." }, 404);
    if (!rateLimit(`enqp:${pub}`, 200, 36e5)) return json({ error: "We are very busy. Please try again later." }, 429);
    const ce = cleanEnquiry(body);
    if (!ce.ok) return json({ error: ce.error }, 400);
    // asked from a single-unit page: the unit must belong to this project
    const un = /^[a-f0-9]{10,40}$/.test(String(body.unit || "")) ? await c.units.findOne({ pub: String(body.unit), ws: w._id, project: proj._id }) : null;
    const refU = /^[a-f0-9]{8,40}$/.test(String(body.ref || "")) ? await c.users.findOne({ _id: String(body.ref), ws: w._id }) : null;
    const d: any = { name: ce.name, phone: ce.phone, source: "Project page", campaign: proj.name, project: proj.name, projectId: proj._id, ...(un ? { unitId: un._id, unitCode: un.code || "", unit: unitLabel(un), source: "Unit page" } : {}), status: "New", prio: "Warm", notes: [...(ce.message ? [{ t: Date.now(), by: un ? "Unit page" : "Project page", x: ce.message }] : []), ...(un ? [{ t: Date.now(), by: "Unit page", x: `Asked about unit ${unitLabel(un)}${un.code ? " (" + un.code + ")" : ""}` }] : [])], created: Date.now() };
    if (refU?.role === "partner") { d.partnerId = refU._id; d.partner = refU.name; }
    const res = await addLead(c, w, d, refU && refU.role !== "partner" ? refU.name : undefined);
    if (res === "dup") {
      const ex = await c.leads.findOne({ ws: w._id, pk: ce.phone });
      if (ex) await c.leads.updateOne({ _id: ex._id, ws: w._id }, { $set: { "data.notes": [{ t: Date.now(), by: "Project page", x: `Enquired again about ${un ? "unit " + unitLabel(un) + (un.code ? " (" + un.code + ")" : "") + " at " : ""}${proj.name}${ce.message ? ": " + ce.message : ""}` }, ...(ex.data?.notes || [])] } });
    } else if (res === "limit") return json({ error: "We could not take your enquiry online. Please call us." }, 503);
    await c.projects.updateOne({ _id: proj._id }, { $inc: { enquiries: 1 } });
    if (un) await c.units.updateOne({ _id: un._id }, { $inc: { enquiries: 1 } });
    return json({ ok: 1 });
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
    // Sign-ups from the LeadFlow for Real Estate page (/real-estate-crm) start with real estate mode on.
    if (body.for === "real-estate") await c.ws.updateOne({ _id: w._id }, { $set: { mode: "realestate" } });
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
  const mode = modeOf(W);
  if (RE_ACTIONS.has(r) && mode !== "realestate") return json({ error: "Real estate mode is off. Turn it on in the menu." }, 403);
  const admin = U.role === "admin";
  const sa = isSA(U.email);
  const partner = U.role === "partner"; // external channel partner: sees only leads they brought in
  if (partner && mode !== "realestate") return json({ error: "Channel partner access is switched off for this company." }, 403);
  if (partner && !PARTNER_OK.has(r)) return json({ error: "Not available for channel partners" }, 403);
  const only = () => (admin ? null : json({ error: "Admins only" }, 403));
  const mine = (d: any) => admin || (partner ? d?.partnerId === U._id : (d?.owner ?? "") === U.name);
  const clean = (o: any) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !k.startsWith("$") && !k.includes(".")));
  const id = url.searchParams.get("id") || "";
  const key = url.searchParams.get("k") || "";

  switch (r) {
    // Plan & billing (admins). Not in WRITES, so a company whose trial or plan has ended can still pay.
    case "billing":
      return json({
        plan: W.plan, validUntil: W.validUntil || null, trialEnds: W.trialEnds || null, daysLeft: st.daysLeft, readonly: st.ro, admin,
        prices: CRM_PRICES, months: BILLING_MONTHS,
        payments: admin ? (W.payments || []).slice(-12).reverse().map((p: any) => ({ plan: p.plan, months: p.months, amount: p.amount, at: p.at, until: p.until, paymentId: p.paymentId })) : [],
      });
    case "billing_checkout": {
      const no = only(); if (no) return no;
      if (!rateLimit(`crm-billing:${ws}`, 20, 3600_000)) return json({ error: "Too many tries. Please wait a little and try again." }, 429);
      let q;
      try { q = quoteCrm(body.plan, body.months); } catch (e) { return json({ error: e instanceof BillingError ? e.message : "Could not start the payment" }, 400); }
      const order = await getPaymentProvider().createOrder({
        amount: q.total, currency: "INR",
        customer: { name: U.name || W.name, email: U.email, phone: "", city: "" } as never,
        description: `LeadFlow ${q.name} – ${q.months} month${q.months === 1 ? "" : "s"} (${W.name})`,
      });
      await c.ws.updateOne({ _id: ws }, { $set: { billing: { orderId: order.orderId, plan: q.plan, months: q.months, amount: q.total, by: U._id, at: Date.now() } } });
      return json({ orderId: order.orderId, provider: order.provider, clientData: order.clientData ?? null, total: q.total, plan: q.plan, months: q.months });
    }
    case "billing_verify": {
      const no = only(); if (no) return no;
      const orderId = String(W.billing?.orderId || "");
      if (!orderId) return json({ error: "No payment to confirm" }, 400);
      const v = await getPaymentProvider().verify({ orderId, payload: body });
      if (!v.ok) return json({ error: "Payment could not be verified. If money was taken, it will be confirmed automatically within a few minutes." }, 400);
      await markCrmPaid(orderId, v.paymentId);
      const fresh = await c.ws.findOne({ _id: ws });
      return json({ ok: 1, plan: fresh?.plan, validUntil: fresh?.validUntil || null });
    }
    case "me": if (mode === "realestate" && !W.catPub) { W.catPub = rid(); await c.ws.updateOne({ _id: ws, catPub: { $exists: false } }, { $set: { catPub: W.catPub } }); W.catPub = (await c.ws.findOne({ _id: ws }))?.catPub || W.catPub; }
      return json({ id: U._id, name: U.name, role: U.role, sa, ws: { name: W.name, plan: W.plan, mode, catPub: mode === "realestate" ? W.catPub : undefined, daysLeft: st.daysLeft, readonly: st.ro, sheetToken: admin ? W.sheetToken : undefined } });
    case "leads": {
      const docs = await c.leads.find(admin ? { ws } : partner ? { ws, "data.partnerId": U._id } : { ws, "data.owner": U.name }).sort({ created: -1 }).limit(5000).toArray();
      return json(docs.map(row));
    }
    case "leads_add": {
      if ((await c.leads.countDocuments({ ws })) >= PLANS[W.plan].leads) return json({ error: `Your plan allows ${PLANS[W.plan].leads} leads. Contact us to upgrade.` }, 403);
      let d = clean(body) as any;
      delete d.partnerId; delete d.partner;
      if ("pinned" in d) d.pinned = cleanPinned(d.pinned);
      if (partner) {
        // A partner registers a buyer: first registration wins, and the lead is assigned to the sales team.
        const pk = digits(d.phone);
        if (pk.length < 10) return json({ error: "Enter a valid 10-digit phone number" }, 400);
        if (await c.leads.findOne({ ws, pk })) return json({ error: "This customer is already registered with us." }, 409);
        const names = await teamNames(c, ws);
        const n = await c.leads.countDocuments({ ws });
        d = { ...partnerLeadFields(d), status: "New", source: "Channel partner", owner: names.length ? names[n % names.length] : "", partnerId: U._id, partner: U.name, notes: [], created: Date.now() };
      } else if (!admin && !d.owner) d.owner = U.name;
      if (admin && body.partnerId) {
        const pu = await c.users.findOne({ _id: String(body.partnerId), ws, role: "partner" });
        if (pu) { d.partnerId = pu._id; d.partner = pu.name; }
      }
      delete d.unitId; delete d.unitCode;
      if (mode === "realestate" && ("projectId" in body || "project" in body)) Object.assign(d, await linkProject(c, ws, body));
      if (mode === "realestate" && body.unitId) Object.assign(d, await linkUnit(c, ws, body.unitId));
      const nid = rid();
      await c.leads.insertOne({ _id: nid, ws, pk: digits(d.phone), created: d.created || Date.now(), data: d });
      return json({ id: nid });
    }
    case "leads_update": {
      const old = await c.leads.findOne({ _id: id, ws });
      if (!old) return json({ error: "nf" }, 404);
      if (!mine(old.data)) return json({ error: "Not your lead" }, 403);
      const set: any = {};
      const fields: Record<string, any> = partner ? partnerLeadFields(body) : { ...clean(body) };
      delete fields.partnerId; delete fields.partner; // attribution can only be changed below, by an admin
      delete fields.projectId; delete fields.project; // the project link is checked below
      if ("pinned" in fields) fields.pinned = cleanPinned(fields.pinned);
      for (const [k, v] of Object.entries(fields)) set[`data.${k}`] = v;
      delete fields.unitId; delete fields.unitCode; delete fields.unit; // unit link is checked below
      if (mode === "realestate" && ("projectId" in body || "project" in body)) {
        const lp = await linkProject(c, ws, body);
        set["data.projectId"] = lp.projectId; set["data.project"] = lp.project;
        // a unit from another project no longer fits
        if (!("unitId" in body) && old.data?.unitId) {
          const ou = await c.units.findOne({ _id: old.data.unitId, ws });
          if (!ou || ou.project !== lp.projectId) { set["data.unitId"] = ""; set["data.unitCode"] = ""; set["data.unit"] = ""; }
        }
      }
      if (mode === "realestate" && "unitId" in body) for (const [k, v] of Object.entries(await linkUnit(c, ws, body.unitId))) set[`data.${k}`] = v;
      else if ("unit" in body && !partner && mode !== "realestate") set["data.unit"] = String(body.unit ?? "").slice(0, 60);
      if ("phone" in fields) set.pk = digits(fields.phone);
      if (admin && "partnerId" in body) {
        const pu = body.partnerId ? await c.users.findOne({ _id: String(body.partnerId), ws, role: "partner" }) : null;
        set["data.partnerId"] = pu ? pu._id : "";
        set["data.partner"] = pu ? pu.name : "";
      }
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
      return json((await c.users.find({ ws }).sort({ name: 1 }).toArray()).map((u: any) => ({ id: u._id, name: u.name, email: u.email, role: u.role, rate: u.rate ?? null })));
    }
    case "user_save": {
      const x = only(); if (x) return x;
      const n = String(body.name || "").trim(), e = String(body.email || "").trim().toLowerCase(), ro = body.role === "admin" ? "admin" : body.role === "partner" ? "partner" : "agent", rate = cleanPct(body.rate), pw = String(body.password || ""), uid2 = String(body.id || "");
      if (!n || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return json({ error: "Enter a name and a valid email" }, 400);
      if (await c.users.findOne({ $or: [{ ws, name: n }, { email: e }], _id: { $ne: uid2 } })) return json({ error: "That name or email is already used" }, 400);
      if (pw && pw.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
      if (!uid2) {
        if (!pw) return json({ error: "Set a password (min 8 characters)" }, 400);
        if (ro === "partner" && mode !== "realestate") return json({ error: "Turn on Real estate mode to add channel partners." }, 403);
        if (ro === "partner") { if ((await c.users.countDocuments({ ws, role: "partner" })) >= 200) return json({ error: "Partner limit reached (200)." }, 403); }
        else if ((await c.users.countDocuments({ ws, role: { $ne: "partner" } })) >= PLANS[W.plan].users) return json({ error: `Your plan allows ${PLANS[W.plan].users} users. Contact us to upgrade.` }, 403);
        await c.users.insertOne({ _id: rid(), ws, name: n, email: e, pass: hash(pw), role: ro, ...(ro === "partner" ? { rate } : {}) });
      } else {
        const old = await c.users.findOne({ _id: uid2, ws });
        if (!old) return json({ error: "User not found" }, 404);
        if (old.role === "admin" && ro !== "admin" && (await c.users.countDocuments({ ws, role: "admin" })) < 2) return json({ error: "Keep at least one admin" }, 400);
        await c.users.updateOne({ _id: uid2 }, { $set: { name: n, email: e, role: ro, rate: ro === "partner" ? rate : null, ...(pw ? { pass: hash(pw) } : {}) } });
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

    // ----- Real estate mode (only reachable when the company has it switched on) -----
    case "mode_set": {
      const x = only(); if (x) return x;
      const m = body.mode === "realestate" ? "realestate" : "general";
      await c.ws.updateOne({ _id: ws }, { $set: { mode: m } }); // turning it off hides the features; no data is deleted
      return json({ mode: m });
    }
    case "projects_list": {
      const ps = await c.projects.find({ ws }).sort({ name: 1 }).toArray();
      for (const p of ps) if (!p.pub) { p.pub = rid(); await c.projects.updateOne({ _id: p._id, ws }, { $set: { pub: p.pub } }); } // older projects get their public link id
      for (const p of [...ps].filter((x: any) => !x.code).sort((a: any, b: any) => (a.created || 0) - (b.created || 0))) { // and their Property ID
        p.code = await nextCode(c, ws);
        await c.projects.updateOne({ _id: p._id, ws }, { $set: { code: p.code } });
      }
      return json(ps.map((p: any) => ({ id: p._id, code: p.code, pub: p.pub, published: !!p.published, name: p.name, images: p.images || [], mapUrl: p.mapUrl || "", videos: p.videos || [], city: p.city || "", locality: p.locality || "", type: p.type || "residential", reraNumber: p.reraNumber || "", holdHours: p.holdHours || 48, ...(admin ? { commissionPct: p.commissionPct ?? null, about: p.about || "", amenities: p.amenities || [], cover: p.cover || "", contactPhone: p.contactPhone || "", views: p.views || 0, enquiries: p.enquiries || 0 } : {}) })));
    }
    case "project_save": {
      const x = only(); if (x) return x;
      const name = String(body.name || "").trim().slice(0, 80);
      if (!name) return json({ error: "Enter a project name" }, 400);
      const pid = String(body.id || "");
      if (await c.projects.findOne({ ws, name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }, _id: { $ne: pid } })) return json({ error: "A project with this name already exists" }, 400);
      const doc = {
        name, city: String(body.city || "").trim().slice(0, 60), locality: String(body.locality || "").trim().slice(0, 80),
        type: (PROJECT_TYPES as readonly string[]).includes(body.type) ? body.type : "residential",
        reraNumber: String(body.reraNumber || "").trim().slice(0, 40), holdHours: holdHours(body.holdHours), commissionPct: cleanPct(body.commissionPct),
        published: !!body.published, about: String(body.about || "").trim().slice(0, 1500), amenities: parseAmenities(body.amenities), cover: safeHttpsUrl(body.cover), contactPhone: cleanPhone10(body.contactPhone),
        images: cleanImages(body.images), mapUrl: cleanMapUrl(body.mapUrl), videos: cleanVideos(body.videos),
      };
      if (body.mapUrl && !doc.mapUrl) return json({ error: "Paste a Google Maps link (it starts with https://maps.app.goo.gl/ or https://www.google.com/maps/)" }, 400);
      if (!doc.cover && doc.images.length) doc.cover = doc.images[0];
      if (pid) {
        const r2 = await c.projects.updateOne({ _id: pid, ws }, { $set: doc });
        if (!r2.matchedCount) return json({ error: "nf" }, 404);
        await c.leads.updateMany({ ws, "data.projectId": pid }, { $set: { "data.project": name } }); // keep lead labels in step with a renamed project
        return json({ id: pid });
      }
      const nid = rid();
      await c.projects.insertOne({ _id: nid, ws, pub: rid(), code: await nextCode(c, ws), created: Date.now(), ...doc });
      return json({ id: nid });
    }
    case "project_delete": {
      const x = only(); if (x) return x;
      const pid = String(body.id || "");
      const projDoc = await c.projects.findOne({ _id: pid, ws });
      if (!projDoc) return json({ ok: 1 });
      const gone = await c.units.find({ ws, project: pid }).toArray();
      await c.units.deleteMany({ ws, project: pid });
      await c.projects.deleteOne({ _id: pid, ws });
      await dropDocs(gone.flatMap((u: any) => u.docs || []));
      // photos uploaded through the CRM for this project (pasted links to other sites are left alone)
      for (const img of new Set([...(projDoc.images || []), projDoc.cover].filter(Boolean))) {
        const photo = projectPhotoId(img, ws, pid);
        if (photo) { try { await cloudinary.uploader.destroy(photo, { invalidate: true }); } catch (e) { console.error("[crm] photo delete", e); } }
      }
      await c.leads.updateMany({ ws, "data.projectId": pid }, { $set: { "data.projectId": "", "data.unitId": "", "data.unitCode": "" } });
      return json({ ok: 1 });
    }
    case "units_list": {
      await c.units.updateMany(expiredHoldFilter(ws, Date.now()), releaseUpdate()); // unpaid soft holds free themselves
      const q: any = { ws };
      if (id) q.project = id;
      const us = await c.units.find(q).sort({ project: 1, tower: 1, floor: 1, no: 1 }).limit(5000).toArray();
      for (const u of us) if (!u.pub) { u.pub = rid(); await c.units.updateOne({ _id: u._id, ws }, { $set: { pub: u.pub } }); } // share-link id
      const missing = us.filter((u: any) => !u.code);
      if (missing.length) { // older units get their unit ID, in the order they were added
        const byP = new Map<string, any[]>();
        for (const u of missing) (byP.get(u.project) || byP.set(u.project, []).get(u.project)!).push(u);
        for (const [pId, list] of byP) {
          const proj = await c.projects.findOne({ _id: pId, ws });
          if (!proj) continue;
          list.sort((a: any, b: any) => (a.created || 0) - (b.created || 0) || String(a.no).localeCompare(String(b.no), undefined, { numeric: true }));
          const codes = await reserveUnitCodes(c, ws, proj, list.length);
          for (let i = 0; i < list.length; i++) { list[i].code = codes[i]; await c.units.updateOne({ _id: list[i]._id, ws }, { $set: { code: codes[i] } }); }
        }
      }
      return json(us.map((u: any) => ({ id: u._id, code: u.code || "", pub: u.pub, videos: u.videos || [], views: u.views || 0, enquiries: u.enquiries || 0, ...(partner ? {} : { docs: (u.docs || []).map((d: any) => ({ id: d.id, name: d.name, bytes: d.bytes || 0, by: d.by || "", t: d.t })) }), project: u.project, no: u.no, tower: u.tower || "", floor: u.floor ?? null, bhk: u.bhk || "", area: u.area ?? null, price: u.price ?? null, status: u.status, heldUntil: u.heldUntil || null, ...(partner ? {} : { heldBy: u.heldBy || "", leadId: u.leadId || "", leadName: u.leadName || "" }) })));
    }
    case "unit_save": {
      const x = only(); if (x) return x;
      const proj = await c.projects.findOne({ _id: String(body.project || ""), ws });
      if (!proj) return json({ error: "Pick a project first" }, 400);
      const cu = cleanUnit(body);
      if (!cu.ok) return json({ error: cu.error }, 400);
      const uid2 = String(body.id || "");
      try {
        if (uid2) {
          const cur = await c.units.findOne({ _id: uid2, ws });
          if (!cur) return json({ error: "nf" }, 404);
          if (cur.project !== proj._id) return json({ error: "A unit cannot be moved to another project" }, 400);
          await c.units.updateOne({ _id: uid2, ws }, { $set: { ...cu.unit, ...("videos" in body ? { videos: cleanVideos(body.videos) } : {}), updated: Date.now() } });
          await c.leads.updateMany({ ws, "data.unitId": uid2 }, { $set: { "data.unit": unitLabel(cu.unit) } }); // keep lead labels in step
          return json({ id: uid2 });
        }
        if ((await c.units.countDocuments({ ws })) >= (UNIT_LIMITS[W.plan] ?? 0)) return json({ error: `Your plan allows ${UNIT_LIMITS[W.plan]} units. Contact us to upgrade.` }, 403);
        if (await c.units.findOne({ ws, project: proj._id, no: cu.unit.no })) return json({ error: "That unit number already exists in this project" }, 400);
        const nid = rid();
        const [code] = await reserveUnitCodes(c, ws, proj, 1);
        await c.units.insertOne({ _id: nid, ws, project: proj._id, code, pub: rid(), ...cu.unit, videos: cleanVideos(body.videos), status: "available", created: Date.now(), updated: Date.now() });
        return json({ id: nid, code });
      } catch (e: any) {
        if (e?.code === 11000) return json({ error: "That unit number already exists in this project" }, 400);
        throw e;
      }
    }
    case "units_import": {
      const x = only(); if (x) return x;
      const proj = await c.projects.findOne({ _id: String(body.project || ""), ws });
      if (!proj) return json({ error: "Pick a project first" }, 400);
      const rows: any[] = Array.isArray(body.rows) ? body.rows.slice(0, 1000) : [];
      const have = new Set((await c.units.find({ ws, project: proj._id }, { projection: { no: 1 } }).toArray()).map((u: any) => u.no));
      let room = (UNIT_LIMITS[W.plan] ?? 0) - (await c.units.countDocuments({ ws }));
      const docs: any[] = []; let skipped = 0, capped = 0;
      for (const row0 of rows) {
        const cu = row0 && typeof row0 === "object" ? cleanUnit(row0) : ({ ok: false } as const);
        if (!cu.ok || have.has(cu.unit.no)) { skipped++; continue; }
        if (room <= 0) { capped++; continue; }
        have.add(cu.unit.no); room--;
        docs.push({ _id: rid(), ws, project: proj._id, ...cu.unit, status: "available", created: Date.now(), updated: Date.now() });
      }
      const codes = await reserveUnitCodes(c, ws, proj, docs.length);
      docs.forEach((d, i) => { d.code = codes[i]; d.pub = rid(); });
      if (docs.length) { try { await c.units.insertMany(docs, { ordered: false }); } catch (e: any) { if (e?.code !== 11000 && !e?.writeErrors) throw e; } }
      return json({ added: docs.length, skipped, overLimit: capped });
    }
    case "unit_delete": {
      const x = only(); if (x) return x;
      const uidD = String(body.id || "");
      const before = await c.units.findOne({ _id: uidD, ws });
      const del = await c.units.deleteOne({ _id: uidD, ws });
      if (del.deletedCount) await dropDocs(before?.docs || []);
      if (del.deletedCount) await c.leads.updateMany({ ws, "data.unitId": uidD }, { $set: { "data.unitId": "", "data.unitCode": "" } });
      return json({ ok: 1 });
    }
    case "unit_hold": {
      await c.units.updateMany(expiredHoldFilter(ws, Date.now()), releaseUpdate());
      const unit = await c.units.findOne({ _id: String(body.id || ""), ws });
      if (!unit) return json({ error: "nf" }, 404);
      if (!canTransition(unit.status as UnitStatus, "soft_hold", admin)) return json({ error: "This unit is not available" }, 409);
      const proj = await c.projects.findOne({ _id: unit.project, ws });
      let lead: any = null;
      if (body.leadId) {
        lead = await c.leads.findOne({ _id: String(body.leadId), ws });
        if (!lead || !mine(lead.data)) return json({ error: "Lead not found" }, 404);
      }
      const hrs = holdHours(body.hours, proj?.holdHours || 48);
      const r2 = await c.units.updateOne(holdFilter(ws, unit._id), { $set: { status: "soft_hold", heldUntil: Date.now() + hrs * 36e5, heldBy: U.name, leadId: lead?._id || "", leadName: lead?.data?.name || "", updated: Date.now() } });
      if (!r2.matchedCount) return json({ error: "Someone else just held this unit" }, 409);
      return json({ ok: 1 });
    }
    case "unit_release": {
      const unit = await c.units.findOne({ _id: String(body.id || ""), ws });
      if (!unit) return json({ error: "nf" }, 404);
      if (!canRelease(unit, { name: U.name, admin })) return json({ error: "Only the person who placed the hold, or an admin, can release it" }, 403);
      await c.units.updateOne({ _id: unit._id, ws }, releaseUpdate());
      return json({ ok: 1 });
    }
    case "unit_status": {
      const x = only(); if (x) return x;
      const to = String(body.status || "") as UnitStatus;
      if (!(UNIT_STATUSES as readonly string[]).includes(to) || to === "soft_hold") return json({ error: "Invalid status" }, 400);
      const unit = await c.units.findOne({ _id: String(body.id || ""), ws });
      if (!unit) return json({ error: "nf" }, 404);
      if (!canTransition(unit.status as UnitStatus, to, true)) return json({ error: `A ${unit.status.replace("_", " ")} unit cannot be changed to ${to.replace("_", " ")}` }, 409);
      let lead: any = null;
      if (body.leadId) { lead = await c.leads.findOne({ _id: String(body.leadId), ws }); if (!lead) return json({ error: "Lead not found" }, 404); }
      const upd: any = to === "available" ? releaseUpdate() : { $set: { status: to, updated: Date.now(), ...(lead ? { leadId: lead._id, leadName: lead.data?.name || "" } : {}) }, $unset: { heldUntil: "", heldBy: "" } };
      const r2 = await c.units.updateOne({ _id: unit._id, ws, status: unit.status }, upd); // fails if someone changed it in the meantime
      if (!r2.matchedCount) return json({ error: "This unit was just changed by someone else. Refresh and try again." }, 409);
      await syncCommission(c, ws, unit, lead, to);
      if (lead && to === "booked" && lead.data?.status !== "Won") {
        const pr = await c.projects.findOne({ _id: unit.project, ws });
        await c.leads.updateOne({ _id: lead._id, ws }, { $set: { "data.status": "Booked", "data.unit": unitLabel(unit), "data.unitId": unit._id, "data.unitCode": unit.code || "", ...(pr ? { "data.projectId": pr._id, "data.project": pr.name } : {}) } });
      }
      return json({ ok: 1 });
    }


    // ----- Site visits (stored on the lead as appointments of type "Site visit") -----
    case "visits_list": {
      const now = url.searchParams.get("now") || "";
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(now)) return json({ error: "Missing time" }, 400);
      const q: any = admin ? { ws } : { ws, "data.owner": U.name };
      q["data.appts.type"] = "Site visit";
      const docs = await c.leads.find(q).limit(5000).toArray();
      return json(listVisits(docs.map(row) as any, now).slice(0, 2000));
    }
    case "visit_save": {
      const lead = await c.leads.findOne({ _id: String(body.leadId || ""), ws });
      if (!lead || !mine(lead.data)) return json({ error: "Lead not found" }, 404);
      const cv = cleanVisit(body);
      if (!cv.ok) return json({ error: cv.error }, 400);
      let appts: any[] | null;
      let vid = String(body.id || "");
      if (vid) { appts = rescheduleVisit(lead.data.appts, vid, cv.v); if (!appts) return json({ error: "Visit not found" }, 404); }
      else { appts = addVisit(lead.data.appts, cv.v); vid = appts[appts.length - 1].id; }
      await c.leads.updateOne({ _id: lead._id, ws }, { $set: { "data.appts": appts, "data.status": stageOnSchedule(lead.data.status || "New") } });
      return json({ id: vid });
    }
    case "visit_done": {
      const lead = await c.leads.findOne({ _id: String(body.leadId || ""), ws });
      if (!lead || !mine(lead.data)) return json({ error: "Lead not found" }, 404);
      const outcome = cleanOutcome(body.outcome);
      if (!outcome) return json({ error: "Choose how the visit went" }, 400);
      const vid = String(body.id || "");
      const feedback = String(body.feedback || "").trim().slice(0, 500);
      const appts = updateVisit(lead.data.appts, vid, { done: true, outcome, feedback, doneAt: Date.now() });
      if (!appts) return json({ error: "Visit not found" }, 404);
      const visit = appts.find((a: any) => a.id === vid)!;
      const set: any = { "data.appts": appts, "data.status": stageOnDone(lead.data.status || "New", outcome), "data.notes": [visitNote(U.name, visit, outcome, feedback), ...(lead.data.notes || [])] };
      if (outcome === "not_interested") set["data.prio"] = "Cold";
      await c.leads.updateOne({ _id: lead._id, ws }, { $set: set });
      return json({ ok: 1 });
    }
    case "visit_delete": {
      const lead = await c.leads.findOne({ _id: String(body.leadId || ""), ws });
      if (!lead || !mine(lead.data)) return json({ error: "Lead not found" }, 404);
      await c.leads.updateOne({ _id: lead._id, ws }, { $set: { "data.appts": removeVisit(lead.data.appts, String(body.id || "")) } });
      return json({ ok: 1 });
    }


    // ----- Channel partners and commissions -----
    case "partners_list": {
      const x = only(); if (x) return x;
      const ps = await c.users.find({ ws, role: "partner" }).sort({ name: 1 }).toArray();
      const ids = ps.map((p: any) => p._id);
      const ls = ids.length ? await c.leads.find({ ws, "data.partnerId": { $in: ids } }).limit(10000).toArray() : [];
      const cs = await c.commissions.find({ ws }).limit(10000).toArray();
      return json(partnerStats(ps.map((p: any) => ({ id: p._id, name: p.name, email: p.email, rate: p.rate })), ls.map((l: any) => ({ status: l.data?.status, partnerId: l.data?.partnerId })), cs));
    }
    case "commissions_list": {
      const q: any = admin ? { ws } : { ws, partnerId: U._id };
      const st = url.searchParams.get("status");
      if (st) q.status = st;
      const cs = await c.commissions.find(q).sort({ created: -1 }).limit(2000).toArray();
      const all = st ? await c.commissions.find(admin ? { ws } : { ws, partnerId: U._id }).limit(5000).toArray() : cs;
      return json({ items: cs.map((m: any) => ({ id: m._id, leadName: m.leadName, unit: m.unitLabel, project: m.projectName, partnerId: m.partnerId, partner: m.partnerName, saleValue: m.saleValue, rate: m.rate, amount: m.amount, status: m.status, created: m.created, paidAt: m.paidAt || null, note: m.note || "" })), totals: summarize(all) });
    }
    case "commission_update": {
      const x = only(); if (x) return x;
      const cm = await c.commissions.findOne({ _id: String(body.id || ""), ws });
      if (!cm) return json({ error: "nf" }, 404);
      const set: any = { updated: Date.now() };
      if (body.status !== undefined && body.status !== cm.status) {
        if (!canChangeStatus(cm.status, String(body.status))) return json({ error: `A ${cm.status} commission cannot be changed to ${body.status}` }, 409);
        set.status = String(body.status);
        set.paidAt = body.status === "paid" ? Date.now() : null;
      }
      if (body.amount !== undefined && body.amount !== "") {
        const a = Math.round(Number(body.amount));
        if (!Number.isFinite(a) || a < 0) return json({ error: "Enter a valid amount" }, 400);
        if (cm.status === "paid" && set.status !== "approved") return json({ error: "Reopen a paid commission before changing its amount" }, 409);
        set.amount = a; set.manual = true;
      }
      if (body.note !== undefined) set.note = String(body.note || "").trim().slice(0, 200);
      await c.commissions.updateOne({ _id: cm._id, ws, status: cm.status }, { $set: set });
      return json({ ok: 1 });
    }


    // ----- Reports (admins only): leads received in the period are followed through to visits and bookings -----
    case "report": {
      const x = only(); if (x) return x;
      const ts = (k: string) => { const v = url.searchParams.get(k); return v && /^\d{10,14}$/.test(v) ? Number(v) : null; };
      const [ls, us, ps, cs] = await Promise.all([
        c.leads.find({ ws }).limit(20000).toArray(), c.units.find({ ws }).limit(20000).toArray(),
        c.projects.find({ ws }).toArray(), c.commissions.find({ ws }).limit(20000).toArray(),
      ]);
      return json(buildReport({
        from: ts("from"), to: ts("to"),
        leads: ls.map((l: any) => ({ id: l._id, created: l.created, status: l.data?.status, source: l.data?.source, owner: l.data?.owner, partnerId: l.data?.partnerId, partner: l.data?.partner, project: l.data?.project, projectId: l.data?.projectId, appts: l.data?.appts })),
        units: us.map((u: any) => ({ id: u._id, project: u.project, status: u.status, price: u.price, leadId: u.leadId })),
        projects: ps.map((p: any) => ({ id: p._id, code: p.code, name: p.name, views: p.views, enquiries: p.enquiries })),
        commissions: cs.map((m: any) => ({ partnerId: m.partnerId, status: m.status, amount: m.amount, created: m.created })),
      }));
    }


    // ----- Project photos: signs a direct browser-to-Cloudinary upload (images only, into this company's folder) -----
    case "upload_sign": {
      const x = only(); if (x) return x;
      if (!rateLimit(`crm-upload:${ws}`, 200, 36e5)) return json({ error: "Too many uploads. Please try again later." }, 429);
      const proj = await c.projects.findOne({ _id: String(body.project || ""), ws });
      if (!proj) return json({ error: "Save the project first, then add photos" }, 400);
      const cfg = cloudinary.config();
      if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) return json({ error: "Photo uploads are not set up yet (CLOUDINARY_URL is missing). You can paste image links instead." }, 503);
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = `crm/${ws}/projects/${proj._id}`;
      const allowed_formats = "jpg,jpeg,png,webp,heic,avif";
      const signature = cloudinary.utils.api_sign_request({ allowed_formats, folder, timestamp }, cfg.api_secret);
      return json({ url: `https://api.cloudinary.com/v1_1/${cfg.cloud_name}/image/upload`, fields: { api_key: cfg.api_key, timestamp, folder, allowed_formats, signature } });
    }


    // ----- Private unit documents: Cloudinary "private" files, only opened through short-lived signed links -----
    case "unit_doc_sign": {
      const unit = await c.units.findOne({ _id: String(body.unit || ""), ws });
      if (!unit) return json({ error: "nf" }, 404);
      if ((unit.docs || []).length >= MAX_DOCS) return json({ error: `A unit can have up to ${MAX_DOCS} documents. Delete one first.` }, 400);
      if (!rateLimit(`crm-doc:${ws}`, 300, 36e5)) return json({ error: "Too many uploads. Please try again later." }, 429);
      const cfg = cloudinary.config();
      if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) return json({ error: "Document uploads are not set up yet (CLOUDINARY_URL is missing)." }, 503);
      const timestamp = Math.floor(Date.now() / 1000);
      const p = { folder: docFolder(ws, unit._id), timestamp, type: "private", use_filename: "true", unique_filename: "true" };
      return json({ url: `https://api.cloudinary.com/v1_1/${cfg.cloud_name}/raw/upload`, fields: { ...p, api_key: cfg.api_key, signature: cloudinary.utils.api_sign_request(p, cfg.api_secret) } });
    }
    case "unit_doc_add": {
      const unit = await c.units.findOne({ _id: String(body.unit || ""), ws });
      if (!unit) return json({ error: "nf" }, 404);
      const cfg = cloudinary.config();
      const pid = String(body.public_id || ""), ver = String(body.version || "");
      // the upload result is signed by Cloudinary: this proves the file was uploaded with our signature, into this unit's folder
      const okSig = !!cfg.api_secret && /^\d{1,14}$/.test(ver) && String(body.signature || "") === cloudinary.utils.api_sign_request({ public_id: pid, version: ver }, cfg.api_secret);
      if (!okSig || !docInFolder(pid, ws, unit._id)) return json({ error: "This upload could not be verified. Please try again." }, 400);
      const name = cleanDocName(body.name);
      if (!name) return json({ error: "This file type is not allowed. Use PDF, Word, Excel, images or similar." }, 400);
      if ((unit.docs || []).some((d: any) => d.pid === pid)) return json({ ok: 1 });
      const doc = { id: rid(), pid, name, bytes: Math.max(0, Math.min(Number(body.bytes) || 0, 1e9)), by: U.name, t: Date.now() };
      const r2 = await c.units.updateOne({ _id: unit._id, ws, [`docs.${MAX_DOCS - 1}`]: { $exists: false } }, { $push: { docs: doc } } as any);
      if (!r2.matchedCount) return json({ error: `A unit can have up to ${MAX_DOCS} documents.` }, 400);
      return json({ id: doc.id });
    }
    case "unit_doc_url": {
      const unit = await c.units.findOne({ _id: String(body.unit || ""), ws });
      const doc = unit?.docs?.find((d: any) => d.id === String(body.doc || ""));
      if (!doc) return json({ error: "nf" }, 404);
      const cfg = cloudinary.config();
      if (!cfg.api_secret) return json({ error: "Documents are not set up yet." }, 503);
      const url = cloudinary.utils.private_download_url(doc.pid, "", { resource_type: "raw", type: "private", attachment: !!body.download, expires_at: Math.floor(Date.now() / 1000) + 5 * 60 });
      return json({ url });
    }
    case "unit_doc_delete": {
      const unit = await c.units.findOne({ _id: String(body.unit || ""), ws });
      const doc = unit?.docs?.find((d: any) => d.id === String(body.doc || ""));
      if (!doc) return json({ error: "nf" }, 404);
      if (!admin && doc.by !== U.name) return json({ error: "Only an admin or the person who added it can delete this document" }, 403);
      await c.units.updateOne({ _id: unit._id, ws }, { $pull: { docs: { id: doc.id } } } as any);
      try { await cloudinary.uploader.destroy(doc.pid, { resource_type: "raw", type: "private", invalidate: true }); } catch (e) { console.error("[crm] doc delete", e); }
      return json({ ok: 1 });
    }

    // ----- platform admin (you): manage every customer company -----
    case "sa_list": {
      if (!sa) return json({ error: "Not allowed" }, 403);
      const all = await c.ws.find({}).sort({ createdAt: -1 }).toArray();
      return json(await Promise.all(all.map(async (w: any) => ({ id: w._id, name: w.name, plan: w.plan, status: w.status, createdAt: w.createdAt, trialEnds: w.trialEnds, validUntil: w.validUntil || null, mode: modeOf(w), users: await c.users.countDocuments({ ws: w._id }), leads: await c.leads.countDocuments({ ws: w._id }) }))));
    }
    case "sa_update": {
      if (!sa) return json({ error: "Not allowed" }, 403);
      const set: any = {};
      if (body.plan) { if (!PLANS[body.plan]) return json({ error: "Unknown plan" }, 400); set.plan = body.plan; }
      if (body.status === "active" || body.status === "suspended") set.status = body.status;
      if (body.mode === "realestate" || body.mode === "general") set.mode = body.mode;
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

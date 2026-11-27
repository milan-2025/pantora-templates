import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { getPaymentProvider } from "@/lib/payments";
import { getReviews } from "@/lib/reviewsServer";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { WorkoutError, type WOp } from "@/lib/workout/core";
import {
  accessOf, addMember, buddyAction, buddyView, claimMoneyBack, confirmPhoto, createGroup, deletePhoto, emailOf, findProfile, getOrCreateProfile, getPlans, getSettings,
  getState, groupPost, groupPreview, groupView, inbox, joinGroup, leaveGroup, listPhotos, markWorkoutPaid, me, quote, removeMember, requestBuddy, saveState,
  familyPost, familyView, setGroupGoal, signVoice, startPledge, verifyPledge,
  passwordLogin, refreshedToken, sendReminders, setMyPassword, signPhoto, startLogin, subscribePush, verifyLogin, workoutHasPassword,
} from "@/lib/workout/server";

/**
 * Every API call of the workout app (/workout), one file so the routes stay together:
 * /api/workout/<path>. Signed-in calls send "Authorization: Bearer <token>".
 */

type Ctx = { params: Promise<{ path?: string[] }> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- request bodies are checked field by field in lib/workout/server
type Body = Record<string, any>;

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

async function readBody(req: Request): Promise<Body> {
  if (req.method === "GET") return {};
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") throw new WorkoutError("Invalid request");
  return b as Body;
}

function limit(req: Request, key: string, n: number, ms: number) {
  if (!rateLimit(`workout-${key}:${clientIp(req)}`, n, ms)) throw new WorkoutError("Too many requests. Please wait a minute.", 429);
}

async function handle(req: Request, ctx: Ctx) {
  const path = ((await ctx.params).path ?? []).join("/");
  const m = req.method;
  const url = new URL(req.url);
  const payload = await getPayloadClient();
  const b = await readBody(req);

  /* ----- open to everyone ----- */
  if (path === "auth/start" && m === "POST") {
    limit(req, "code", 8, 15 * 60_000);
    if (!rateLimit(`workout-code-email:${String(b.email).toLowerCase()}`, 4, 15 * 60_000)) throw new WorkoutError("We just sent a code to this email. Please check your inbox (and spam).", 429);
    const r = await startLogin(payload, b.email);
    return { ok: true, email: r.email, ...(r.devCode ? { devCode: r.devCode } : {}) };
  }
  if (path === "auth/verify" && m === "POST") {
    limit(req, "verify", 20, 15 * 60_000);
    const r = await verifyLogin(payload, b.email, b.code);
    const existed = await findProfile(payload, r.email);
    await getOrCreateProfile(payload, r.email, { ref: b.ref, source: b.source });
    // isNew lets the app report a sign-up (CompleteRegistration) to the Meta Pixel.
    return { ...r, isNew: !existed };
  }
  if (path === "auth/password" && m === "POST") {
    limit(req, "pw", 20, 15 * 60_000);
    if (!rateLimit(`workout-pw-email:${String(b.email).toLowerCase()}`, 10, 15 * 60_000)) throw new WorkoutError("Too many tries. Sign in with a code, or wait a few minutes.", 429);
    return passwordLogin(payload, b.email, b.password);
  }
  if (path === "plans" && m === "GET") {
    const [plans, s, reviews] = await Promise.all([getPlans(payload), getSettings(payload), getReviews(payload, "workout")]);
    return {
      reviews,
      plans: plans.filter((p) => p.active || p.isFree).map(({ id, planId, name, price, durationDays, seats, photosPerWeek, isFree, tagline, badge, features }) => ({ id, planId, name, price, durationDays, seats, photosPerWeek, isFree, tagline, badge, features })),
      freeDays: s.freeDays, offerText: s.offerText, whatsapp: s.whatsappNumber ? { number: s.whatsappNumber, message: s.whatsappMessage } : null,
      moneyBack: s.moneyBackOn ? { tiers: s.moneyBackTiers, rule: s.moneyBackRule } : null, friendOff: s.refOn ? s.refFriendOff : 0,
      milestones: s.milestones.filter((x) => x.active !== false).map((x) => ({ title: x.title, note: x.note, kind: x.kind, days: x.days })), groupMax: s.groupMax,
    };
  }
  if (path === "groups/preview" && m === "GET") return groupPreview(payload, url.searchParams.get("code"));
  if (path === "cron/reminders") {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new WorkoutError("Not allowed", 401);
    return sendReminders(payload);
  }

  /* ----- signed in ----- */
  const email = emailOf(req);
  if (!email) throw new WorkoutError("Please sign in again", 401);

  switch (`${m} ${path}`) {
    case "GET me": {
      const [out, hasPassword] = await Promise.all([me(payload, email), workoutHasPassword(payload, email)]);
      const token = refreshedToken(req, email);
      return { ...(out as object), hasPassword, ...(token ? { token } : {}) };
    }
    case "POST password": limit(req, "setpw", 10, 15 * 60_000); return setMyPassword(payload, email, b.password, b.remove === true);
    case "GET state": return getState(payload, email, Number(url.searchParams.get("since") ?? -1));
    case "PUT state": {
      limit(req, "save", 240, 60_000);
      if (!Array.isArray(b.ops)) throw new WorkoutError("Invalid changes");
      return saveState(payload, email, b.ops as WOp[]);
    }
    case "POST members": limit(req, "members", 20, 60_000); return { members: await addMember(payload, email, b.email, b.name) };
    case "DELETE members": return { members: await removeMember(payload, email, b.email) };
    case "POST groups": limit(req, "groups", 10, 60_000); return createGroup(payload, email, b);
    case "POST groups/join": limit(req, "join", 20, 60_000); return joinGroup(payload, email, b.code);
    case "POST groups/leave": return leaveGroup(payload, email, b.code);
    case "GET groups/view": return groupView(payload, email, url.searchParams.get("code"));
    case "POST groups/post": limit(req, "post", 40, 60 * 60_000); return groupPost(payload, email, b.code, b);
    case "POST groups/goal": limit(req, "goal", 20, 60 * 60_000); return setGroupGoal(payload, email, b.code, b);
    case "GET family": return familyView(payload, email);
    case "POST family/post": limit(req, "post", 40, 60 * 60_000); return familyPost(payload, email, b);
    case "POST voice/sign": limit(req, "voice", 30, 60 * 60_000); return signVoice(payload, email);
    case "POST pledge": limit(req, "pledge", 10, 60 * 60_000); return startPledge(payload, email, b);
    case "POST pledge/verify": limit(req, "verify-pay", 20, 60_000); return verifyPledge(payload, email, b);
    case "GET buddy": return buddyView(payload, email);
    case "POST buddy/request": limit(req, "buddy", 10, 60_000); return requestBuddy(payload, email);
    case "POST buddy/action": limit(req, "buddy-act", 40, 60 * 60_000); return buddyAction(payload, email, b);
    case "GET inbox": return { items: await inbox(payload, email, url.searchParams.get("since") ?? "") };
    case "POST push": return subscribePush(payload, email, b.sub ?? null, b.hour);
    case "GET photos": return listPhotos(payload, email);
    case "POST photos/sign": limit(req, "photo", 20, 60 * 60_000); return signPhoto(payload, email, b.day);
    case "POST photos/confirm": return confirmPhoto(payload, email, b.id);
    case "POST photos/delete": return deletePhoto(payload, email, b.id);
    case "POST moneyback": limit(req, "claim", 5, 60 * 60_000); return claimMoneyBack(payload, email, b.choice);
    case "POST checkout": {
      limit(req, "order", 15, 60_000);
      const q = await quote(payload, email, b.plan, b.coupon, b.ref);
      if (b.quoteOnly) return { total: q.total, discount: q.discount, name: q.plan.name, ref: Boolean(q.ref) };
      const profile = await getOrCreateProfile(payload, email);
      const order = await getPaymentProvider().createOrder({
        amount: q.total, currency: "INR", customer: { name: profile.name || email, email, phone: profile.phone || "", city: "" } as never,
        description: `Pandora Workout – ${q.plan.name} (1 year)`,
      });
      await payload.update({ collection: "workout-profiles", id: profile.id, data: { orderId: order.orderId, order: { plan: q.plan.id, amount: q.total, coupon: q.coupon, ref: q.ref, at: new Date().toISOString() } } as never, overrideAccess: true });
      return { orderId: order.orderId, provider: order.provider, clientData: order.clientData ?? null, total: q.total };
    }
    case "POST checkout/verify": {
      limit(req, "verify-pay", 20, 60_000);
      const profile = await getOrCreateProfile(payload, email);
      const orderId = String(profile.orderId ?? "").replace(/^done:/, "");
      if (!orderId) throw new WorkoutError("No payment to confirm");
      const result = await getPaymentProvider().verify({ orderId, payload: b });
      if (!result.ok) throw new WorkoutError("Payment could not be verified");
      await markWorkoutPaid(payload, orderId, result.paymentId);
      const a = await accessOf(payload, await getOrCreateProfile(payload, email));
      return { ok: true, plan: a.plan.name, expiresAt: a.expiresAt };
    }
  }
  throw new WorkoutError("Not found", 404);
}

const wrap = async (req: Request, ctx: Ctx) => {
  try {
    const out = await handle(req, ctx);
    return out instanceof Response ? out : json(out);
  } catch (e) {
    if (e instanceof WorkoutError) return json({ error: e.message, ...e.extra }, e.status);
    console.error("[workout-api]", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
};

export const GET = wrap;
export const POST = wrap;
export const PUT = wrap;
export const DELETE = wrap;

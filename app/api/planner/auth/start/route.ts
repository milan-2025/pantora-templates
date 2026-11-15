import { getPayloadClient } from "@/lib/cms/queries";
import { PlannerError } from "@/lib/planner/core";
import { body, route } from "@/lib/planner/http";
import { startLogin } from "@/lib/planner/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/** Emails a 6-digit sign-in code. */
export const POST = route(async (req) => {
  if (!rateLimit(`planner-code:${clientIp(req)}`, 8, 15 * 60_000)) throw new PlannerError("Too many codes requested. Please wait a few minutes.", 429);
  const { email } = await body(req);
  if (!rateLimit(`planner-code-email:${String(email).toLowerCase()}`, 4, 15 * 60_000)) throw new PlannerError("We just sent a code to this email. Please check your inbox (and spam).", 429);
  const r = await startLogin(await getPayloadClient(), email);
  return { ok: true, email: r.email, ...(r.devCode ? { devCode: r.devCode } : {}) };
});

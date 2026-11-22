import { getPayloadClient } from "@/lib/cms/queries";
import { PlannerError } from "@/lib/planner/core";
import { body, route } from "@/lib/planner/http";
import { passwordLogin } from "@/lib/planner/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/** Email + password sign-in (for people who set a password). Returns a session token like /auth/verify. */
export const POST = route(async (req) => {
  if (!rateLimit(`planner-pw:${clientIp(req)}`, 20, 15 * 60_000)) throw new PlannerError("Too many tries. Please wait a few minutes.", 429);
  const { email, password } = await body(req);
  if (!rateLimit(`planner-pw-email:${String(email).toLowerCase()}`, 10, 15 * 60_000)) throw new PlannerError("Too many tries. Sign in with a code, or wait a few minutes.", 429);
  return passwordLogin(await getPayloadClient(), email, password);
});

import { getPayloadClient } from "@/lib/cms/queries";
import { PlannerError } from "@/lib/planner/core";
import { body, route } from "@/lib/planner/http";
import { verifyLogin } from "@/lib/planner/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/** Checks the code and returns a session token (kept by the app, sent as "Authorization: Bearer …"). */
export const POST = route(async (req) => {
  if (!rateLimit(`planner-verify:${clientIp(req)}`, 20, 15 * 60_000)) throw new PlannerError("Too many tries. Please wait a few minutes.", 429);
  const { email, code } = await body(req);
  return verifyLogin(await getPayloadClient(), email, code);
});

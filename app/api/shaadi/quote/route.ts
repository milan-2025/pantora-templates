import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayloadClient } from "@/lib/cms/queries";
import { PLAN_IDS, quoteFor } from "@/lib/invites";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { promoCodeSchema } from "@/lib/schema";

const bodySchema = z.object({ plan: z.enum(PLAN_IDS), coupon: promoCodeSchema, from: z.enum(PLAN_IDS).optional() });

export async function POST(req: Request) {
  if (!rateLimit(`invite-quote:${clientIp(req)}`, 30, 60_000)) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const q = await quoteFor(await getPayloadClient(), parsed.data.plan, parsed.data.coupon, parsed.data.from);
  if ("error" in q && q.error) return NextResponse.json({ error: q.error }, { status: 400 });
  return NextResponse.json({ total: q.total, discount: q.discount });
}

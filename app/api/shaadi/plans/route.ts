import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { getPlanConfig } from "@/lib/invites";

/** Plans and prices for the invite maker (edited in /admin → Wedding invites → Invite plans & prices). */
export async function GET() {
  const cfg = await getPlanConfig(await getPayloadClient());
  return NextResponse.json(cfg, { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=120" } });
}

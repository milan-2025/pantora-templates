import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { authorize, hasUnsavedChanges, isLive } from "@/lib/invites";

/** The couple's own invite for editing (needs their private edit token). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const invite = await authorize(req, await getPayloadClient(), slug);
  if (!invite) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  return NextResponse.json({
    slug: invite.slug,
    state: invite.state,
    published: invite.published ?? null,
    publishedAt: invite.publishedAt ?? null,
    unsaved: hasUnsavedChanges(invite),
    paid: isLive(invite),
    plan: invite.plan ?? null,
    expires: invite.expiresAt ?? null,
    // Connected to the online wedding planner: it keeps guests and functions up to date.
    planner: invite.planner
      ? { linked: true, psa: invite.plannerSyncAt ?? null, note: invite.plannerSyncAt && (!invite.publishedAt || invite.plannerSyncAt > invite.publishedAt) ? invite.plannerNote ?? "" : "" }
      : { linked: false },
  });
}

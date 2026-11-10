import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { emailCouple } from "@/lib/inviteEmail";
import { getPlanConfig } from "@/lib/invites";

/**
 * Emails couples who saved their email but never paid (once each). Call it once a day, e.g. from a cron job:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<your-site>/api/shaadi/cron/reminders
 * Turn it on, set the delay and add a promo code in /admin → Wedding invites → Invite plans & prices.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not allowed" }, { status: 401 });

  const payload = await getPayloadClient();
  const { reminders } = await getPlanConfig(payload);
  if (!reminders.enabled) return NextResponse.json({ sent: 0, skipped: "reminders are switched off" });

  const cutoff = new Date(Date.now() - reminders.afterHours * 3_600_000).toISOString();
  const due = await payload.find({
    collection: "invites",
    where: {
      and: [
        { paymentStatus: { not_equals: "paid" } },
        { contactEmail: { exists: true } },
        { updatedAt: { less_than: cutoff } },
        { or: [{ reminderCount: { exists: false } }, { reminderCount: { equals: 0 } }] },
      ],
    },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  });

  let sent = 0;
  for (const invite of due.docs) {
    try {
      await emailCouple(payload, invite, { kind: "reminder" });
      await payload.update({ collection: "invites", id: invite.id, data: { reminderCount: 1, lastEmailedAt: new Date().toISOString() }, depth: 0, overrideAccess: true });
      sent++;
    } catch (e) {
      console.error("[invite-reminder]", invite.slug, e);
    }
  }
  return NextResponse.json({ sent, checked: due.docs.length });
}

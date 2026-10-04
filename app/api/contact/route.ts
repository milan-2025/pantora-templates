import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { contactSchema } from "@/lib/schema";
import { sendContactNotification } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/** Contact form: saves to the admin (Inbox → Contact messages) and emails the owner. */
export async function POST(req: Request) {
  if (!rateLimit(`contact:${clientIp(req)}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many messages. Please try again later or WhatsApp us." }, { status: 429 });
  }
  const parsed = contactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the form" }, { status: 400 });
  }
  const { website, ...msg } = parsed.data;
  // Honeypot filled in → almost certainly a bot. Pretend success.
  if (website) return NextResponse.json({ ok: true });

  try {
    const payload = await getPayloadClient();
    await payload.create({ collection: "contact-submissions", data: { ...msg, handled: false } });
    await sendContactNotification(msg);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contact]", e);
    return NextResponse.json({ error: "Couldn't send your message. Please WhatsApp us instead." }, { status: 500 });
  }
}

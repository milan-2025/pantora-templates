import { studioResponse } from "@/lib/shaadi/page";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Make a beautiful digital wedding invitation online: every function with its date, venue and map, RSVPs, photos and music. Share it on WhatsApp in minutes.";

/** The wedding invite maker (editor). It doubles as the invite maker's landing page, so search engines may index it. */
export function GET() {
  return studioResponse("Wedding Invite Maker: digital Indian wedding invitations with RSVP · Pandora Templates", "/shaadi", false, { description: DESCRIPTION }, { indexable: true });
}

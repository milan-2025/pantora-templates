import { studioResponse } from "@/lib/shaadi/page";

export const dynamic = "force-dynamic";

/** The wedding invite maker (editor) for a new invite. Its landing page is /shaadi, which search engines index instead. */
export function GET() {
  return studioResponse("Make your wedding invite · Pandora Templates", "/shaadi/create", false, {
    description: "Make a beautiful digital wedding invitation online and share it on WhatsApp in minutes.",
  });
}

import { studioResponse } from "@/lib/shaadi/page";

export const dynamic = "force-dynamic";

/** The wedding invite maker (editor). */
export function GET() {
  return studioResponse("Wedding invite maker · Pandora Templates", "/shaadi");
}

import { inviteResponse } from "@/lib/shaadi/invitePage";

export const dynamic = "force-dynamic";

/** /i/<link>/<guest>: the page greets that guest by name. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string; guest: string }> }) {
  const { slug } = await params;
  return inviteResponse(req, slug);
}

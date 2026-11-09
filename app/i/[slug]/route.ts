import { inviteResponse } from "@/lib/shaadi/invitePage";

export const dynamic = "force-dynamic";

/** /i/<link> */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return inviteResponse(req, slug);
}

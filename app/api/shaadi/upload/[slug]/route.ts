import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { authorize } from "@/lib/invites";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const ALLOWED = "jpg,jpeg,png,webp,gif,heic,mp4,mov,webm";

/**
 * Signs a direct browser-to-Cloudinary upload for a couple's photo or video, so big files never pass through
 * this server (Vercel limits request bodies to 4.5 MB). Files land in the invites/<link> folder.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!rateLimit(`invite-upload:${clientIp(req)}`, 60, 3_600_000)) return NextResponse.json({ error: "Too many uploads. Please try later." }, { status: 429 });
  const { slug } = await params;
  const invite = await authorize(req, await getPayloadClient(), slug);
  if (!invite) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const cfg = cloudinary.config();
  if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) return NextResponse.json({ error: "Uploads are not set up yet" }, { status: 503 });

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `invites/${invite.slug}`;
  const toSign = { allowed_formats: ALLOWED, folder, timestamp };
  const signature = cloudinary.utils.api_sign_request(toSign, cfg.api_secret);
  return NextResponse.json({
    url: `https://api.cloudinary.com/v1_1/${cfg.cloud_name}/auto/upload`,
    fields: { api_key: cfg.api_key, timestamp, folder, allowed_formats: ALLOWED, signature },
  });
}

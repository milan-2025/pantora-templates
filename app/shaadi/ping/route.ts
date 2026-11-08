import { NextResponse } from "next/server";

/** Lets the invite maker know it is running on the real site (so it saves and takes payments). */
export function GET() {
  return NextResponse.json({ ok: true });
}

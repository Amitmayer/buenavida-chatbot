import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSessionProfile } from "@/lib/session";
import { gmailAuthUrl, gmailConfigured } from "@/lib/email/gmail";

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile || profile.isGuest) {
    return NextResponse.redirect(new URL("/hoy", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
  }
  if (!gmailConfigured()) {
    return NextResponse.redirect(new URL("/correo?error=setup", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
  }
  const state = randomBytes(16).toString("hex");
  const dest = new URL(gmailAuthUrl(state));
  const res = NextResponse.redirect(dest);
  res.cookies.set("correo_oauth", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}

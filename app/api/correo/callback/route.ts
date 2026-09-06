import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/email/crypto";
import { exchangeCode, gmailUserEmail } from "@/lib/email/gmail";
import { captureError } from "@/lib/sentry";

function site() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function GET(request: Request) {
  const profile = await getSessionProfile();
  const url = new URL(request.url);
  if (!profile || profile.isGuest) {
    return NextResponse.redirect(new URL("/entrar", site()));
  }
  const err = url.searchParams.get("error");
  if (err) {
    return NextResponse.redirect(new URL("/correo?error=denied", site()));
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const cookie = jar.get("correo_oauth")?.value;
  if (!code || !state || !cookie || cookie !== state) {
    return NextResponse.redirect(new URL("/correo?error=state", site()));
  }
  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL("/correo?error=refresh", site()));
    }
    const email = await gmailUserEmail(tokens.access_token);
    const supabase = await createClient();
    const { error } = await supabase.from("email_accounts").upsert(
      {
        user_id: profile.id,
        provider: "gmail",
        email,
        refresh_token_enc: encryptSecret(tokens.refresh_token),
        access_token_enc: encryptSecret(tokens.access_token),
        access_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope ?? "gmail",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );
    if (error) {
      captureError(error, { where: "correo.callback.upsert" });
      return NextResponse.redirect(new URL("/correo?error=save", site()));
    }
  } catch (error) {
    captureError(error, { where: "correo.callback" });
    return NextResponse.redirect(new URL("/correo?error=token", site()));
  }
  const res = NextResponse.redirect(new URL("/correo?ok=1", site()));
  res.cookies.set("correo_oauth", "", { path: "/", maxAge: 0 });
  return res;
}

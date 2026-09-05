import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicUrl } from "@/lib/http/public-origin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? "/hoy";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/hoy";
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(publicUrl(next, request));
}

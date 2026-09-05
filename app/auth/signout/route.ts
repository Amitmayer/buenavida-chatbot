import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicUrl } from "@/lib/http/public-origin";

async function signOutAndRedirect(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(publicUrl("/entrar", request), 303);
}

export async function POST(request: Request) {
  return signOutAndRedirect(request);
}

export async function GET(request: Request) {
  return signOutAndRedirect(request);
}

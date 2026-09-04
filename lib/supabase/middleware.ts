import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/db/types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    if (request.nextUrl.pathname.startsWith("/api/health")) {
      return response;
    }
    const missing = request.nextUrl.clone();
    missing.pathname = "/entrar";
    return NextResponse.redirect(missing);
  }

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/entrar") || path.startsWith("/auth");
  const isPublic =
    isAuthRoute ||
    path.startsWith("/api/health") ||
    path.startsWith("/api/cron") ||
    path === "/manifest.webmanifest" ||
    path === "/sw.js";

  const hasSession = request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("-auth-token"));

  if (!hasSession) {
    if (!isPublic) {
      const next = request.nextUrl.clone();
      next.pathname = "/entrar";
      next.searchParams.set("next", path);
      return NextResponse.redirect(next);
    }
    return response;
  }

  const supabase = createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[], headers: Record<string, string>) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/entrar") {
    const url = request.nextUrl.clone();
    url.pathname = "/hoy";
    return NextResponse.redirect(url);
  }

  return response;
}

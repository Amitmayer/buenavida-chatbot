import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/db/types";
import { shouldRefreshSession, hasAuthSessionCookie } from "@/lib/supabase/session-freshness";

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

  const hasSession = hasAuthSessionCookie(request.cookies.getAll());

  if (!hasSession) {
    if (!isPublic) {
      const next = request.nextUrl.clone();
      next.pathname = "/entrar";
      next.searchParams.set("next", path);
      return NextResponse.redirect(next);
    }
    return response;
  }

  if (path === "/entrar") {
    const next = request.nextUrl.clone();
    next.pathname = "/hoy";
    return NextResponse.redirect(next);
  }

  if (!shouldRefreshSession(request.cookies.getAll())) {
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
    const login = request.nextUrl.clone();
    login.pathname = "/entrar";
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  return response;
}

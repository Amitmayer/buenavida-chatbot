import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/db/types";
import {
  authCookieNames,
  shouldRefreshSession,
  hasAuthSessionCookie,
} from "@/lib/supabase/session-freshness";

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  for (const name of authCookieNames(request.cookies.getAll())) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

function loginUrl(request: NextRequest, from?: string) {
  const login = request.nextUrl.clone();
  login.pathname = "/entrar";
  login.search = "";
  if (from && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/entrar")) {
    login.searchParams.set("next", from);
  }
  return login;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/entrar") || path.startsWith("/auth");
  const isPublic =
    isAuthRoute ||
    path.startsWith("/api/health") ||
    path.startsWith("/api/cron") ||
    path === "/manifest.webmanifest" ||
    path === "/sw.js";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    if (isPublic) return response;
    return NextResponse.redirect(loginUrl(request, path));
  }

  const hasSession = hasAuthSessionCookie(request.cookies.getAll());

  if (!hasSession) {
    if (!isPublic) {
      return NextResponse.redirect(loginUrl(request, path));
    }
    return response;
  }

  const mustCheck = path === "/entrar" || shouldRefreshSession(request.cookies.getAll());
  if (!mustCheck) return response;

  const supabase = createServerClient<Database>(url, anonKey, {
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
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const out = isPublic ? NextResponse.next({ request }) : NextResponse.redirect(loginUrl(request, path));
    clearAuthCookies(request, out);
    return out;
  }

  if (path === "/entrar") {
    const dest = request.nextUrl.searchParams.get("next");
    const next = request.nextUrl.clone();
    next.search = "";
    next.pathname =
      dest && dest.startsWith("/") && !dest.startsWith("//") && !dest.startsWith("/entrar") ? dest : "/hoy";
    return NextResponse.redirect(next);
  }

  return response;
}

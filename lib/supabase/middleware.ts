import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/db/types";
import { shouldRefreshSession, hasAuthSessionCookie } from "@/lib/supabase/session-freshness";
import { publicUrl } from "@/lib/http/public-origin";

function redirectTo(request: NextRequest, path: string, nextPath?: string) {
  const dest = publicUrl(path, request);
  if (nextPath) dest.searchParams.set("next", nextPath);
  return NextResponse.redirect(dest);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    if (request.nextUrl.pathname.startsWith("/api/health")) {
      return response;
    }
    return redirectTo(request, "/entrar");
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
      return redirectTo(request, "/entrar", path);
    }
    return response;
  }

  if (path === "/entrar") {
    return redirectTo(request, "/hoy");
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
    return redirectTo(request, "/entrar", path);
  }

  return response;
}

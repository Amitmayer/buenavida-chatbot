import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";

declare global {
  interface Window {
    __BV_SUPABASE__?: { url: string; anon: string };
  }
}

function publicConfig(): { url: string; anon: string } | null {
  if (typeof window !== "undefined" && window.__BV_SUPABASE__?.url && window.__BV_SUPABASE__.anon) {
    return window.__BV_SUPABASE__;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) return { url, anon };
  return null;
}

export function createClient() {
  const config = publicConfig();
  if (!config) {
    throw new Error("missing supabase public config");
  }
  return createBrowserClient<Database>(config.url, config.anon);
}

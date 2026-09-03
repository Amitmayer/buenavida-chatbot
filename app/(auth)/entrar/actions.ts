"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/sentry";

function safeNext(raw: unknown): string {
  const value = String(raw ?? "");
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/entrar")) {
    return value;
  }
  return "/hoy";
}

export async function signInAction(
  _prev: { ok: false } | null,
  formData: FormData,
): Promise<{ ok: false } | null> {
  const parsed = z
    .object({
      email: z.string().email(),
      password: z.string().min(1),
      next: z.string().optional(),
    })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      next: formData.get("next") || undefined,
    });
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    if (!/invalid|credentials/i.test(error.message)) {
      captureError(error, { where: "signInAction" });
    }
    return { ok: false };
  }
  redirect(safeNext(parsed.data.next));
}

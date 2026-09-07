"use server";

import { redirect } from "next/navigation";
import { es } from "@/lib/i18n/es";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { captureError } from "@/lib/sentry";

export async function startConversationAction() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/entrar");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: profile.id, title: es.chat.title })
    .select("id")
    .single();
  if (error || !data) {
    captureError(error, { where: "startConversationAction" });
    redirect("/chat");
  }
  redirect(`/chat?c=${data.id}`);
}

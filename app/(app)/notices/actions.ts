"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { markReadAction } from "@/app/(app)/correo/actions";
import { captureError } from "@/lib/sentry";

export async function dismissNoticeAction(id: string) {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const };

  if (id.startsWith("chat:")) {
    const chatId = id.slice(5);
    const supabase = await createClient();
    const { error } = await supabase
      .from("chat_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("chat_id", chatId)
      .eq("user_id", profile.id);
    if (error) {
      captureError(error, { where: "dismissNoticeAction.chat" });
      return { ok: false as const };
    }
    revalidatePath("/", "layout");
    return { ok: true as const };
  }

  if (id.startsWith("mail:")) {
    await markReadAction(id.slice(5));
    revalidatePath("/", "layout");
    return { ok: true as const };
  }

  return { ok: false as const };
}

export async function dismissAllNoticesAction(ids: string[]) {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const };
  const supabase = await createClient();
  const now = new Date().toISOString();
  const chatIds = ids.filter((id) => id.startsWith("chat:")).map((id) => id.slice(5));
  const mailIds = ids.filter((id) => id.startsWith("mail:")).map((id) => id.slice(5));

  if (chatIds.length) {
    const { error } = await supabase
      .from("chat_members")
      .update({ last_read_at: now })
      .eq("user_id", profile.id)
      .in("chat_id", chatIds);
    if (error) captureError(error, { where: "dismissAllNoticesAction.chat" });
  }

  for (const emailId of mailIds) {
    await markReadAction(emailId);
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { captureError } from "@/lib/sentry";

export async function updateMembershipAction(formData: FormData): Promise<void> {
  const profile = await getSessionProfile();
  if (!profile?.isAdmin) return;
  const parsed = z
    .object({
      user_id: z.string().uuid(),
      team_id: z.string().uuid(),
      is_lead: z.coerce.boolean().optional(),
      remove: z.coerce.boolean().optional(),
    })
    .safeParse({
      user_id: formData.get("user_id"),
      team_id: formData.get("team_id"),
      is_lead: formData.get("is_lead"),
      remove: formData.get("remove"),
    });
  if (!parsed.success) return;
  const supabase = await createClient();
  if (parsed.data.remove) {
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("user_id", parsed.data.user_id)
      .eq("team_id", parsed.data.team_id);
    if (error) {
      captureError(error, { where: "updateMembershipAction.delete" });
      return;
    }
  } else {
    const { error } = await supabase.from("team_members").upsert({
      user_id: parsed.data.user_id,
      team_id: parsed.data.team_id,
      is_lead: Boolean(parsed.data.is_lead),
    });
    if (error) {
      captureError(error, { where: "updateMembershipAction.upsert" });
      return;
    }
  }
  revalidatePath("/equipo");
}

export async function updateProfileRoleAction(formData: FormData): Promise<void> {
  const profile = await getSessionProfile();
  if (!profile?.isAdmin) return;
  const parsed = z
    .object({
      user_id: z.string().uuid(),
      role: z.enum(["owner", "admin", "member", "guest"]),
      default_team: z.string().uuid().nullable().optional(),
    })
    .safeParse({
      user_id: formData.get("user_id"),
      role: formData.get("role"),
      default_team: formData.get("default_team") || null,
    });
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      role: parsed.data.role,
      default_team: parsed.data.default_team ?? null,
    })
    .eq("id", parsed.data.user_id);
  if (error) {
    captureError(error, { where: "updateProfileRoleAction" });
    return;
  }
  revalidatePath("/equipo");
}

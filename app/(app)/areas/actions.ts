"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { captureError } from "@/lib/sentry";

const createProjectSchema = z.object({
  teamId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
});

export async function createProjectAction(teamId: string, name: string) {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, detail: "forbidden" };
  const parsed = createProjectSchema.safeParse({ teamId, name });
  if (!parsed.success) return { ok: false as const, detail: "validation" };

  const member = profile.teams.some((team) => team.id === parsed.data.teamId);
  const team = profile.accessibleTeams.find((item) => item.id === parsed.data.teamId);
  if (!team) return { ok: false as const, detail: "forbidden" };
  if (team.is_private && !member) return { ok: false as const, detail: "forbidden" };
  if (!member && !profile.hasFullAccess) return { ok: false as const, detail: "forbidden" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      team_id: parsed.data.teamId,
      name: parsed.data.name,
      created_by: profile.id,
    })
    .select("id, name")
    .single();
  if (error || !data) {
    captureError(error, { where: "createProjectAction" });
    return { ok: false as const, detail: "server_error" };
  }

  revalidatePath("/areas", "layout");
  revalidatePath("/hoy");
  revalidatePath("/tareas");
  return { ok: true as const, project: data };
}

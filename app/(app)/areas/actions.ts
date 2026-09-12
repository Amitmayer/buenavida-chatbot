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

const updateProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  notes: z.string().max(4000).nullable().optional(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  memberIds: z.array(z.string().uuid()).optional(),
});

async function assertProjectAccess(projectId: string) {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, detail: "forbidden" as const, profile: null, project: null };
  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, team_id, name, notes, due_date, archived_at")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !project) {
    captureError(error, { where: "assertProjectAccess" });
    return { ok: false as const, detail: "not_found" as const, profile, project: null };
  }
  const member = profile.teams.some((team) => team.id === project.team_id);
  const team = profile.accessibleTeams.find((item) => item.id === project.team_id);
  if (!team) return { ok: false as const, detail: "forbidden" as const, profile, project: null };
  if (team.is_private && !member) {
    return { ok: false as const, detail: "forbidden" as const, profile, project: null };
  }
  if (!member && !profile.hasFullAccess) {
    return { ok: false as const, detail: "forbidden" as const, profile, project: null };
  }
  return { ok: true as const, profile, project, supabase };
}

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
    .select("id, name, notes, due_date")
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

export async function updateProjectAction(input: {
  projectId: string;
  name?: string;
  notes?: string | null;
  due_date?: string | null;
  memberIds?: string[];
}) {
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, detail: "validation" };
  const access = await assertProjectAccess(parsed.data.projectId);
  if (!access.ok || !access.supabase) return { ok: false as const, detail: access.detail };

  const patch: { name?: string; notes?: string | null; due_date?: string | null } = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
  if (parsed.data.due_date !== undefined) patch.due_date = parsed.data.due_date;

  if (Object.keys(patch).length) {
    const { error } = await access.supabase
      .from("projects")
      .update(patch)
      .eq("id", parsed.data.projectId);
    if (error) {
      captureError(error, { where: "updateProjectAction" });
      return { ok: false as const, detail: "server_error" };
    }
  }

  if (parsed.data.memberIds) {
    const { error: clearError } = await access.supabase
      .from("project_members")
      .delete()
      .eq("project_id", parsed.data.projectId);
    if (clearError) {
      captureError(clearError, { where: "updateProjectAction.clearMembers" });
      return { ok: false as const, detail: "server_error" };
    }
    if (parsed.data.memberIds.length) {
      const { error: insertError } = await access.supabase.from("project_members").insert(
        parsed.data.memberIds.map((userId) => ({
          project_id: parsed.data.projectId,
          user_id: userId,
        })),
      );
      if (insertError) {
        captureError(insertError, { where: "updateProjectAction.members" });
        return { ok: false as const, detail: "server_error" };
      }
    }
  }

  revalidatePath("/areas", "layout");
  return { ok: true as const };
}

export async function archiveProjectAction(projectId: string) {
  const id = z.string().uuid().safeParse(projectId);
  if (!id.success) return { ok: false as const, detail: "validation" };
  const access = await assertProjectAccess(id.data);
  if (!access.ok || !access.supabase) return { ok: false as const, detail: access.detail };
  const { error } = await access.supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id.data);
  if (error) {
    captureError(error, { where: "archiveProjectAction" });
    return { ok: false as const, detail: "server_error" };
  }
  revalidatePath("/areas", "layout");
  return { ok: true as const };
}

export async function deleteProjectAction(projectId: string) {
  const id = z.string().uuid().safeParse(projectId);
  if (!id.success) return { ok: false as const, detail: "validation" };
  const access = await assertProjectAccess(id.data);
  if (!access.ok || !access.supabase) return { ok: false as const, detail: access.detail };
  const { error } = await access.supabase.from("projects").delete().eq("id", id.data);
  if (error) {
    captureError(error, { where: "deleteProjectAction" });
    return { ok: false as const, detail: "server_error" };
  }
  revalidatePath("/areas", "layout");
  revalidatePath("/tareas");
  return { ok: true as const };
}

export async function loadProjectSettingsAction(projectId: string) {
  const id = z.string().uuid().safeParse(projectId);
  if (!id.success) return { ok: false as const, detail: "validation" };
  const access = await assertProjectAccess(id.data);
  if (!access.ok || !access.supabase || !access.project) {
    return { ok: false as const, detail: access.detail };
  }
  const [{ data: members }, { data: files }] = await Promise.all([
    access.supabase.from("project_members").select("user_id").eq("project_id", id.data),
    access.supabase
      .from("project_files")
      .select("id, filename, mime_type, size_bytes, created_at")
      .eq("project_id", id.data)
      .order("created_at", { ascending: false }),
  ]);
  return {
    ok: true as const,
    project: access.project,
    memberIds: (members ?? []).map((row) => row.user_id),
    files: files ?? [],
  };
}

export async function deleteProjectFileAction(fileId: string) {
  const id = z.string().uuid().safeParse(fileId);
  if (!id.success) return { ok: false as const, detail: "validation" };
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, detail: "forbidden" };
  const supabase = await createClient();
  const { data: file, error } = await supabase
    .from("project_files")
    .select("id, project_id, storage_path")
    .eq("id", id.data)
    .maybeSingle();
  if (error || !file) {
    captureError(error, { where: "deleteProjectFileAction.load" });
    return { ok: false as const, detail: "not_found" };
  }
  const access = await assertProjectAccess(file.project_id);
  if (!access.ok || !access.supabase) return { ok: false as const, detail: access.detail };

  const bucket = process.env.STORAGE_BUCKET_TASKS ?? "task-files";
  const removed = await access.supabase.storage.from(bucket).remove([file.storage_path]);
  if (removed.error) {
    captureError(removed.error, { where: "deleteProjectFileAction.storage" });
  }
  const { error: deleteError } = await access.supabase
    .from("project_files")
    .delete()
    .eq("id", file.id);
  if (deleteError) {
    captureError(deleteError, { where: "deleteProjectFileAction.row" });
    return { ok: false as const, detail: "server_error" };
  }
  revalidatePath("/areas", "layout");
  return { ok: true as const };
}

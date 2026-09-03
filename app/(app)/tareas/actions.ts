"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createTaskSchema, getSessionProfile, taskPatchSchema } from "@/lib/session";
import { captureError } from "@/lib/sentry";
import { sanitizeTitle } from "@/lib/agent/titles";
import { z } from "zod";

export async function createTaskAction(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, detail: "forbidden" };
  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    notes: formData.get("notes") || undefined,
    team_id: formData.get("team_id"),
    area: formData.get("area") || undefined,
    assignee_id: formData.get("assignee_id") || undefined,
    due_date: formData.get("due_date") || undefined,
    priority: formData.get("priority") || "medium",
    visibility: formData.get("visibility") || "team",
  });
  if (!parsed.success) return { ok: false as const, detail: "validation" };
  const supabase = await createClient();
  const title = sanitizeTitle(parsed.data.title).title;
  const { error } = await supabase.rpc("create_task_with_event", {
    p_title: title,
    p_notes: parsed.data.notes ?? null,
    p_team_id: parsed.data.team_id,
    p_area: parsed.data.area ?? null,
    p_owner_id: parsed.data.owner_id ?? profile.id,
    p_assignee_id: parsed.data.assignee_id ?? null,
    p_due_date: parsed.data.due_date ?? null,
    p_priority: parsed.data.priority ?? "medium",
    p_visibility: parsed.data.visibility ?? "team",
    p_source: "ui",
  });
  if (error) {
    captureError(error, { where: "createTaskAction" });
    return { ok: false as const, detail: "server_error" };
  }
  revalidatePath("/hoy");
  revalidatePath("/tareas");
  return { ok: true as const };
}

export async function updateTaskAction(taskId: string, formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, detail: "forbidden" };
  const parsed = taskPatchSchema.safeParse({
    title: formData.get("title") || undefined,
    notes: formData.get("notes"),
    team_id: formData.get("team_id") || undefined,
    area: formData.get("area") || undefined,
    assignee_id: formData.get("assignee_id") || undefined,
    due_date: formData.get("due_date") || undefined,
    priority: formData.get("priority") || undefined,
    status: formData.get("status") || undefined,
    visibility: formData.get("visibility") || undefined,
  });
  if (!parsed.success) return { ok: false as const, detail: "validation" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_task_with_event", {
    p_task_id: taskId,
    p_patch: parsed.data,
    p_source: "ui",
  });
  if (error) {
    captureError(error, { where: "updateTaskAction" });
    return { ok: false as const, detail: "server_error" };
  }
  revalidatePath("/hoy");
  revalidatePath("/tareas");
  revalidatePath(`/tareas/${taskId}`);
  return { ok: true as const };
}

export async function completeTaskAction(taskId: string) {
  const id = z.string().uuid().parse(taskId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_task_with_event", {
    p_task_id: id,
    p_patch: { status: "done" },
    p_source: "ui",
  });
  if (error) {
    captureError(error, { where: "completeTaskAction" });
    return { ok: false as const, detail: "server_error" };
  }
  revalidatePath("/hoy");
  revalidatePath("/tareas");
  revalidatePath(`/tareas/${id}`);
  return { ok: true as const };
}

export async function cancelTaskAction(taskId: string) {
  const id = z.string().uuid().parse(taskId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_task_with_event", {
    p_task_id: id,
    p_patch: { status: "cancelled" },
    p_source: "ui",
  });
  if (error) {
    captureError(error, { where: "cancelTaskAction" });
    return { ok: false as const, detail: "server_error" };
  }
  revalidatePath("/hoy");
  revalidatePath("/tareas");
  return { ok: true as const };
}

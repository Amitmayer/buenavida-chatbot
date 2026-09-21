"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createTaskSchema, getSessionProfile, taskPatchSchema } from "@/lib/session";
import { captureError } from "@/lib/sentry";
import { sanitizeTitle } from "@/lib/agent/titles";
import { parseAssigneeIds } from "@/lib/tasks/assignees";
import { z } from "zod";

export async function createTaskAction(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, detail: "forbidden" };
  const assigneeIds = parseAssigneeIds(formData);
  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    notes: formData.get("notes") || undefined,
    team_id: formData.get("team_id"),
    area: formData.get("area") || undefined,
    project_id: formData.get("project_id") || undefined,
    assignee_ids: assigneeIds.length ? assigneeIds : undefined,
    assignee_id: assigneeIds[0],
    due_date: formData.get("due_date") || undefined,
    priority: formData.get("priority") || "medium",
    visibility: formData.get("visibility") || "team",
  });
  if (!parsed.success) return { ok: false as const, detail: "validation" };
  const supabase = await createClient();
  const title = sanitizeTitle(parsed.data.title).title;
  const ids = parsed.data.assignee_ids ?? (parsed.data.assignee_id ? [parsed.data.assignee_id] : []);
  const { data, error } = await supabase.rpc("create_task_with_event", {
    p_title: title,
    p_notes: parsed.data.notes ?? null,
    p_team_id: parsed.data.team_id,
    p_area: parsed.data.area ?? null,
    p_owner_id: parsed.data.owner_id ?? profile.id,
    p_assignee_id: ids[0] ?? null,
    p_due_date: parsed.data.due_date ?? null,
    p_priority: parsed.data.priority ?? "medium",
    p_visibility: parsed.data.visibility ?? "team",
    p_source: "ui",
    p_project_id: parsed.data.project_id ?? null,
    p_assignee_ids: ids,
  });
  if (error || !data) {
    captureError(error, { where: "createTaskAction" });
    return { ok: false as const, detail: "server_error" };
  }
  revalidatePath("/hoy");
  revalidatePath("/tareas");
  revalidatePath("/areas", "layout");
  return { ok: true as const, id: data.id };
}

export async function updateTaskAction(taskId: string, formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, detail: "forbidden" };
  const assigneeIds = parseAssigneeIds(formData);
  const hasAssigneeField = formData.get("assignee_ids_set") === "1";
  const parsed = taskPatchSchema.safeParse({
    title: formData.get("title") || undefined,
    notes: formData.get("notes"),
    team_id: formData.get("team_id") || undefined,
    area: formData.get("area") || undefined,
    project_id: formData.get("project_id") || undefined,
    assignee_ids: hasAssigneeField ? assigneeIds : undefined,
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

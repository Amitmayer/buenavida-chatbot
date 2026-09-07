import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, Task, TaskPriority, TaskStatus } from "@/lib/db/types";
import { err, ok, type ToolResult } from "@/lib/agent/result";
import { wrapListing, sanitizeTitle } from "@/lib/agent/titles";
import { parseDueDate, todayYmd, addDaysYmd } from "@/lib/agent/dates";
import { captureError } from "@/lib/sentry";
import { postToGeneral } from "@/lib/announcements";
import { draftReplyText } from "@/lib/email/sync";

export type UserContext = {
  userId: string;
  defaultTeamId: string | null;
  teamSlugs: { id: string; slug: string; name: string }[];
  isGuest: boolean;
  isOwner: boolean;
};

type Client = SupabaseClient<Database>;

const listSchema = z.object({
  filter: z.enum(["mine", "team", "overdue", "week"]),
  team_slug: z.string().optional(),
  area: z.string().optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
});

const findSchema = z.object({ query: z.string().min(1).max(200) });

const createSchema = z.object({
  title: z.string().min(1).max(200),
  due_date: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignee_name: z.string().optional(),
  team_slug: z.string().optional(),
  area: z.string().optional(),
  notes: z.string().optional(),
  announce: z.boolean().optional(),
});

const updateSchema = z.object({
  task_id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  notes: z.string().optional(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
  area: z.string().optional(),
  visibility: z.enum(["team", "restricted"]).optional(),
});

const idSchema = z.object({ task_id: z.string().uuid() });

const assignSchema = z.object({
  task_id: z.string().uuid(),
  assignee_name: z.string().min(1),
});

const announceSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  task_id: z.string().uuid().optional(),
});

export const toolDefinitions = [
  {
    name: "list_tasks",
    description: "Lista tareas visibles para la persona que pregunta.",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["mine", "team", "overdue", "week"] },
        team_slug: { type: "string" },
        area: { type: "string" },
        status: { type: "string", enum: ["open", "in_progress", "done", "cancelled"] },
      },
      required: ["filter"],
    },
  },
  {
    name: "find_task",
    description: "Busca tareas por texto. Devuelve candidatos; nunca actúa sobre un único match difuso.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "create_task",
    description: "Crea una tarea. No inventes team_id ni user_id.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        due_date: { type: "string", description: "YYYY-MM-DD o frase en español" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        assignee_name: { type: "string" },
        team_slug: { type: "string" },
        area: { type: "string" },
        notes: { type: "string" },
        announce: {
          type: "boolean",
          description: "Si es true, publica la tarea en Anuncios para toda la empresa.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Actualiza campos de una tarea ya vista en esta conversación.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        title: { type: "string" },
        notes: { type: "string" },
        due_date: { type: "string" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        status: { type: "string", enum: ["open", "in_progress", "done", "cancelled"] },
        area: { type: "string" },
        visibility: { type: "string", enum: ["team", "restricted"] },
      },
      required: ["task_id"],
    },
  },
  {
    name: "complete_task",
    description: "Marca una tarea como hecha. El task_id debe haber aparecido antes en esta conversación.",
    input_schema: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
    },
  },
  {
    name: "assign_task",
    description: "Asigna una tarea por nombre. Si el nombre es ambiguo, no adivines.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        assignee_name: { type: "string" },
      },
      required: ["task_id", "assignee_name"],
    },
  },
  {
    name: "list_emails",
    description: "Lista correos recientes de la persona. Solo su bandeja.",
    input_schema: {
      type: "object",
      properties: {
        unread_only: { type: "boolean" },
      },
    },
  },
  {
    name: "draft_reply",
    description: "Redacta un borrador para un correo ya visto en esta conversación. No lo envía.",
    input_schema: {
      type: "object",
      properties: { email_id: { type: "string" } },
      required: ["email_id"],
    },
  },
  {
    name: "announce",
    description:
      "Publica un anuncio para toda la empresa. Úsalo para novedades importantes o para adjuntar una tarea que todos deben ver. No lo uses para trabajo rutinario de un solo equipo.",
    input_schema: {
      type: "object",
      properties: {
        body: { type: "string", description: "Texto del anuncio, en español, corto." },
        task_id: { type: "string", description: "Tarea ya vista en esta conversación, opcional." },
      },
      required: ["body"],
    },
  },
] as const;

async function resolveTeam(
  ctx: UserContext,
  slug?: string,
): Promise<ToolResult<{ id: string; slug: string }>> {
  if (!slug) {
    if (!ctx.defaultTeamId) {
      return err("validation", "No hay un equipo principal configurado.");
    }
    const found = ctx.teamSlugs.find((t) => t.id === ctx.defaultTeamId);
    return ok({ id: ctx.defaultTeamId, slug: found?.slug ?? "" });
  }
  const team = ctx.teamSlugs.find((t) => t.slug === slug.toLowerCase());
  if (!team) {
    return err("forbidden", `No perteneces al equipo ${slug}.`);
  }
  return ok({ id: team.id, slug: team.slug });
}

async function resolveAssignee(
  supabase: Client,
  name: string,
): Promise<ToolResult<{ id: string; full_name: string }>> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .ilike("full_name", `%${name}%`);
  if (error) {
    captureError(error, { where: "resolveAssignee" });
    return err("server_error", "No se pudo buscar a la persona.");
  }
  const rows = data ?? [];
  if (rows.length === 0) {
    return err("ambiguous", `No encontré a nadie que se llame ${name}.`, []);
  }
  const exact = rows.filter(
    (r) => r.full_name.toLowerCase() === name.toLowerCase(),
  );
  const matches = exact.length === 1 ? exact : rows;
  if (matches.length !== 1) {
    return err(
      "ambiguous",
      "Hay varias personas con ese nombre.",
      matches.map((r) => ({ id: r.id, label: r.full_name })),
    );
  }
  return ok({ id: matches[0].id, full_name: matches[0].full_name });
}

async function knownTaskIds(
  supabase: Client,
  conversationId: string,
): Promise<Set<string>> {
  const { data: messages, error: messageError } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId);
  if (messageError) {
    captureError(messageError, { where: "knownTaskIds.messages" });
    return new Set();
  }
  const messageIds = (messages ?? []).map((row) => row.id);
  if (messageIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("tool_calls")
    .select("task_id, result")
    .in("message_id", messageIds)
    .eq("status", "ok");
  if (error) {
    captureError(error, { where: "knownTaskIds" });
    return new Set();
  }
  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.task_id) ids.add(row.task_id);
    const result = row.result as { ok?: boolean; data?: unknown } | null;
    if (!result?.ok || !result.data) continue;
    const payload = result.data;
    if (Array.isArray(payload)) {
      for (const item of payload) {
        if (item && typeof item === "object" && "id" in item && typeof item.id === "string") {
          ids.add(item.id);
        }
      }
    } else if (typeof payload === "object" && payload && "id" in payload && typeof payload.id === "string") {
      ids.add(payload.id);
    } else if (
      typeof payload === "object" &&
      payload &&
      "tasks" in payload &&
      Array.isArray((payload as { tasks: unknown }).tasks)
    ) {
      for (const item of (payload as { tasks: { id?: string }[] }).tasks) {
        if (item?.id) ids.add(item.id);
      }
    }
  }
  return ids;
}

async function requireKnownTask(
  supabase: Client,
  conversationId: string,
  taskId: string,
): Promise<ToolResult<{ id: string }>> {
  const known = await knownTaskIds(supabase, conversationId);
  if (!known.has(taskId)) {
    return err(
      "validation",
      "Esa tarea no apareció antes en esta conversación. Búscala primero.",
    );
  }
  return ok({ id: taskId });
}

function summarize(task: Task) {
  return {
    id: task.id,
    title: task.title,
    due_date: task.due_date,
    priority: task.priority,
    status: task.status,
    team_id: task.team_id,
    area: task.area,
    assignee_id: task.assignee_id,
    owner_id: task.owner_id,
  };
}

async function listTasks(
  supabase: Client,
  ctx: UserContext,
  input: unknown,
): Promise<ToolResult<{ listing: string; tasks: ReturnType<typeof summarize>[] }>> {
  const parsed = listSchema.safeParse(input);
  if (!parsed.success) return err("validation", "Filtro no válido.");
  const { filter, team_slug, area, status } = parsed.data;
  let query = supabase.from("tasks").select("*");
  const today = todayYmd();
  if (status) query = query.eq("status", status);
  else query = query.in("status", ["open", "in_progress"]);
  if (area) query = query.eq("area", area);
  if (team_slug) {
    const team = await resolveTeam(ctx, team_slug);
    if (!team.ok) return team;
    query = query.eq("team_id", team.data.id);
  }
  if (filter === "mine") query = query.eq("assignee_id", ctx.userId);
  if (filter === "overdue") query = query.lt("due_date", today).neq("status", "done");
  if (filter === "week") {
    query = query.gte("due_date", today).lte("due_date", addDaysYmd(today, 7));
  }
  if (filter === "team" && !team_slug) {
    const team = await resolveTeam(ctx);
    if (!team.ok) return team;
    query = query.eq("team_id", team.data.id);
  }
  const { data, error } = await query.order("due_date", { ascending: true }).limit(50);
  if (error) {
    captureError(error, { where: "list_tasks" });
    return err("server_error", "No se pudieron listar las tareas.");
  }
  const tasks = (data ?? []).map(summarize);
  return ok({ listing: wrapListing(tasks), tasks });
}

async function findTask(
  supabase: Client,
  input: unknown,
): Promise<ToolResult<{ listing: string; tasks: ReturnType<typeof summarize>[] }>> {
  const parsed = findSchema.safeParse(input);
  if (!parsed.success) return err("validation", "Falta el texto de búsqueda.");
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .ilike("title", `%${parsed.data.query}%`)
    .limit(8);
  if (error) {
    captureError(error, { where: "find_task" });
    return err("server_error", "No se pudo buscar.");
  }
  const tasks = (data ?? []).map(summarize);
  return ok({ listing: wrapListing(tasks), tasks });
}

async function createTask(
  supabase: Client,
  ctx: UserContext,
  input: unknown,
): Promise<ToolResult<ReturnType<typeof summarize>>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return err("validation", "Faltan datos para crear la tarea.");
  const team = await resolveTeam(ctx, parsed.data.team_slug);
  if (!team.ok) return team;
  const cleaned = sanitizeTitle(parsed.data.title);
  const due =
    parsed.data.due_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.data.due_date)
      ? parsed.data.due_date
      : parseDueDate(`${parsed.data.title} ${parsed.data.due_date ?? ""}`);
  let assigneeId: string | null = null;
  if (parsed.data.assignee_name) {
    const person = await resolveAssignee(supabase, parsed.data.assignee_name);
    if (!person.ok) return person;
    assigneeId = person.data.id;
  }
  const priority = (parsed.data.priority ?? cleaned.priorityHint ?? "medium") as TaskPriority;
  const { data, error } = await supabase.rpc("create_task_with_event", {
    p_title: cleaned.title,
    p_notes: parsed.data.notes ?? null,
    p_team_id: team.data.id,
    p_area: parsed.data.area ?? null,
    p_owner_id: ctx.userId,
    p_assignee_id: assigneeId,
    p_due_date: due,
    p_priority: priority,
    p_visibility: "team",
    p_source: "chat",
  });
  if (error) {
    captureError(error, { where: "create_task" });
    return err("server_error", "No se pudo guardar la tarea.");
  }
  const created = summarize(data);
  if (parsed.data.announce && !ctx.isGuest) {
    const posted = await postToGeneral(supabase, {
      userId: ctx.userId,
      body: created.title,
      taskId: created.id,
      viaAssistant: true,
    });
    if (!posted.ok) {
      captureError(new Error("announce after create_task failed"), { where: "create_task.announce" });
    }
  }
  return ok(created);
}

async function updateTask(
  supabase: Client,
  conversationId: string,
  input: unknown,
): Promise<ToolResult<ReturnType<typeof summarize>>> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return err("validation", "Datos de actualización no válidos.");
  const known = await requireKnownTask(supabase, conversationId, parsed.data.task_id);
  if (!known.ok) return known;
  const patch: { [key: string]: Json | undefined } = {};
  if (parsed.data.title) patch.title = sanitizeTitle(parsed.data.title).title;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
  if (parsed.data.due_date !== undefined) {
    patch.due_date =
      parsed.data.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(parsed.data.due_date)
        ? parseDueDate(parsed.data.due_date)
        : parsed.data.due_date;
  }
  if (parsed.data.priority) patch.priority = parsed.data.priority;
  if (parsed.data.status) patch.status = parsed.data.status as TaskStatus;
  if (parsed.data.area !== undefined) patch.area = parsed.data.area;
  if (parsed.data.visibility) patch.visibility = parsed.data.visibility;
  const { data, error } = await supabase.rpc("update_task_with_event", {
    p_task_id: parsed.data.task_id,
    p_patch: patch,
    p_source: "chat",
  });
  if (error) {
    captureError(error, { where: "update_task" });
    return err("server_error", "No se pudo guardar el cambio.");
  }
  return ok(summarize(data));
}

async function completeTask(
  supabase: Client,
  conversationId: string,
  input: unknown,
): Promise<ToolResult<ReturnType<typeof summarize>>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("validation", "Falta el id de la tarea.");
  const known = await requireKnownTask(supabase, conversationId, parsed.data.task_id);
  if (!known.ok) return known;
  const { data, error } = await supabase.rpc("update_task_with_event", {
    p_task_id: parsed.data.task_id,
    p_patch: { status: "done" },
    p_source: "chat",
  });
  if (error) {
    captureError(error, { where: "complete_task" });
    return err("server_error", "No se pudo completar la tarea.");
  }
  return ok(summarize(data));
}

async function assignTask(
  supabase: Client,
  conversationId: string,
  input: unknown,
): Promise<ToolResult<ReturnType<typeof summarize>>> {
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return err("validation", "Falta la persona o la tarea.");
  const known = await requireKnownTask(supabase, conversationId, parsed.data.task_id);
  if (!known.ok) return known;
  const person = await resolveAssignee(supabase, parsed.data.assignee_name);
  if (!person.ok) return person;
  const { data, error } = await supabase.rpc("update_task_with_event", {
    p_task_id: parsed.data.task_id,
    p_patch: { assignee_id: person.data.id },
    p_source: "chat",
  });
  if (error) {
    captureError(error, { where: "assign_task" });
    return err("server_error", "No se pudo asignar la tarea.");
  }
  return ok(summarize(data));
}

async function announce(
  supabase: Client,
  ctx: UserContext,
  conversationId: string,
  input: unknown,
): Promise<ToolResult<{ id: string; title: string; task_id: string | null }>> {
  if (ctx.isGuest) {
    return err("forbidden", "Esta cuenta no publica en Anuncios.");
  }
  const parsed = announceSchema.safeParse(input);
  if (!parsed.success) return err("validation", "Falta el texto del anuncio.");
  const taskId = parsed.data.task_id ?? null;
  if (taskId) {
    const known = await requireKnownTask(supabase, conversationId, taskId);
    if (!known.ok) return known;
  }
  const posted = await postToGeneral(supabase, {
    userId: ctx.userId,
    body: parsed.data.body,
    taskId,
    viaAssistant: true,
  });
  if (!posted.ok) {
    return err("server_error", "No se pudo publicar el anuncio.");
  }
  return ok({ id: posted.id, title: parsed.data.body, task_id: taskId });
}

async function listEmails(
  supabase: Client,
  ctx: UserContext,
  input: unknown,
): Promise<ToolResult<{ emails: { id: string; subject: string; from: string; summary: string | null }[] }>> {
  if (ctx.isGuest) return err("forbidden", "Esta cuenta no tiene correo.");
  const unreadOnly = z.object({ unread_only: z.boolean().optional() }).safeParse(input);
  let query = supabase
    .from("emails")
    .select("id, subject, from_address, summary, snippet, unread")
    .eq("user_id", ctx.userId)
    .order("occurred_at", { ascending: false })
    .limit(20);
  if (unreadOnly.success && unreadOnly.data.unread_only) query = query.eq("unread", true);
  const { data, error } = await query;
  if (error) {
    captureError(error, { where: "list_emails" });
    return err("server_error", "No se pudieron listar los correos.");
  }
  return ok({
    emails: (data ?? []).map((row) => ({
      id: row.id,
      subject: row.subject,
      from: row.from_address,
      summary: row.summary ?? row.snippet,
    })),
  });
}

async function draftReply(
  supabase: Client,
  conversationId: string,
  ctx: UserContext,
  input: unknown,
): Promise<ToolResult<{ id: string; title: string }>> {
  if (ctx.isGuest) return err("forbidden", "Esta cuenta no tiene correo.");
  const parsed = z.object({ email_id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return err("validation", "Falta el correo.");
  const known = await requireKnownTask(supabase, conversationId, parsed.data.email_id);
  if (!known.ok) return known;
  const { data: row } = await supabase
    .from("emails")
    .select("*")
    .eq("id", parsed.data.email_id)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!row) return err("not_found", "No encontré ese correo.");
  const draft = await draftReplyText({
    from: row.from_address,
    subject: row.subject,
    body: row.body_text || row.snippet,
  });
  if (!draft) return err("server_error", "No se pudo redactar.");
  await supabase.from("emails").update({ draft_reply: draft }).eq("id", row.id);
  return ok({ id: row.id, title: draft.slice(0, 120) });
}

export async function executeTool(args: {
  supabase: Client;
  ctx: UserContext;
  conversationId: string;
  name: string;
  input: unknown;
}): Promise<ToolResult<unknown>> {
  const { supabase, ctx, conversationId, name, input } = args;
  switch (name) {
    case "list_tasks":
      return listTasks(supabase, ctx, input);
    case "find_task":
      return findTask(supabase, input);
    case "create_task":
      return createTask(supabase, ctx, input);
    case "update_task":
      return updateTask(supabase, conversationId, input);
    case "complete_task":
      return completeTask(supabase, conversationId, input);
    case "assign_task":
      return assignTask(supabase, conversationId, input);
    case "announce":
      return announce(supabase, ctx, conversationId, input);
    case "list_emails":
      return listEmails(supabase, ctx, input);
    case "draft_reply":
      return draftReply(supabase, conversationId, ctx, input);
    default:
      return err("validation", `Herramienta desconocida: ${name}`);
  }
}

import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Task, Team } from "@/lib/db/types";
import { captureError } from "@/lib/sentry";

export const taskPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  notes: z.string().nullable().optional(),
  team_id: z.string().uuid().optional(),
  area: z.string().nullable().optional(),
  owner_id: z.string().uuid().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
  visibility: z.enum(["team", "restricted"]).optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().optional(),
  team_id: z.string().uuid(),
  area: z.string().optional(),
  owner_id: z.string().uuid().optional(),
  assignee_id: z.string().uuid().optional(),
  due_date: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  visibility: z.enum(["team", "restricted"]).optional(),
});

export type SessionProfile = Profile & {
  teams: Team[];
  isGuest: boolean;
  isOwner: boolean;
  isAdmin: boolean;
};

export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile, error }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("team_members").select("team_id, teams(*)").eq("user_id", user.id),
  ]);
  if (error || !profile) {
    captureError(error, { where: "getSessionProfile" });
    return null;
  }
  const teams = (memberships ?? [])
    .map((row) => {
      const nested = row.teams as unknown;
      if (Array.isArray(nested)) return nested[0] as Team | undefined;
      return nested as Team | undefined;
    })
    .filter((t): t is Team => Boolean(t));
  return {
    ...profile,
    teams,
    isGuest: profile.role === "guest",
    isOwner: profile.role === "owner",
    isAdmin: profile.role === "admin" || profile.role === "owner",
  };
});

export type TaskRow = Task & {
  owner: Pick<Profile, "id" | "full_name"> | null;
  assignee: Pick<Profile, "id" | "full_name"> | null;
  team: Pick<Team, "id" | "slug" | "name"> | null;
};

export async function listVisibleTasks(opts: {
  teamId?: string;
  area?: string;
  assigneeId?: string;
  status?: string;
  due?: "overdue" | "today" | "week" | "all";
  today: string;
  weekEnd: string;
  ownerScopeTeamIds?: string[];
  openOnly?: boolean;
}): Promise<TaskRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("*, owner:profiles!owner_id(id, full_name), assignee:profiles!assignee_id(id, full_name), team:teams(id, slug, name)")
    .order("due_date", { ascending: true, nullsFirst: false });
  if (opts.teamId) query = query.eq("team_id", opts.teamId);
  if (opts.area) query = query.eq("area", opts.area);
  if (opts.assigneeId) query = query.eq("assignee_id", opts.assigneeId);
  if (opts.status) query = query.eq("status", opts.status);
  else if (opts.openOnly) query = query.in("status", ["open", "in_progress"]);
  if (opts.due === "overdue") query = query.lt("due_date", opts.today).in("status", ["open", "in_progress"]);
  if (opts.due === "today") query = query.eq("due_date", opts.today);
  if (opts.due === "week") query = query.gte("due_date", opts.today).lte("due_date", opts.weekEnd);
  if (opts.ownerScopeTeamIds) query = query.in("team_id", opts.ownerScopeTeamIds);
  const { data, error } = await query.limit(400);
  if (error) {
    captureError(error, { where: "listVisibleTasks" });
    throw error;
  }
  return (data ?? []) as unknown as TaskRow[];
}

export async function ensureConversation(userId: string, title: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const inserted = await supabase
    .from("conversations")
    .insert({ user_id: userId, title })
    .select("id")
    .single();
  return inserted.data?.id ?? null;
}

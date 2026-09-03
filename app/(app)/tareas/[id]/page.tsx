import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { TaskDetail } from "@/components/tasks/task-detail";
import { captureError } from "@/lib/sentry";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getSessionProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from("tasks")
    .select("*, owner:profiles!owner_id(id, full_name), assignee:profiles!assignee_id(id, full_name), team:teams(id, slug, name, areas)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    captureError(error, { where: "TaskDetailPage" });
  }
  if (!task) notFound();
  const [{ data: events }, { data: attachments }, { data: people }, { data: teams }] =
    await Promise.all([
      supabase
        .from("task_events")
        .select("*, actor:profiles!actor_id(full_name)")
        .eq("task_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("attachments").select("*").eq("task_id", id),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase.from("teams").select("*"),
    ]);

  return (
    <TaskDetail
      task={task}
      events={events ?? []}
      attachments={attachments ?? []}
      people={people ?? []}
      teams={teams ?? []}
    />
  );
}

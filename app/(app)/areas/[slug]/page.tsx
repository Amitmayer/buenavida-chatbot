import { notFound } from "next/navigation";
import { es } from "@/lib/i18n/es";
import { addDaysYmd, todayYmd } from "@/lib/agent/dates";
import { getSessionProfile, listVisibleTasks } from "@/lib/session";
import { loadTeamChat } from "@/lib/mensajes";
import { TaskRow } from "@/components/tasks/task-row";
import { ThreadView } from "@/components/mensajes/thread-view";
import { AreaWorkspace } from "@/components/areas/area-workspace";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/server";

export default async function AreaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getSessionProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data: team } = await supabase.from("teams").select("*").eq("slug", slug).maybeSingle();
  if (!team) notFound();
  const member = profile.teams.some((item) => item.id === team.id);
  if (!member && !profile.isOwner) notFound();

  const today = todayYmd();
  const tasks = await listVisibleTasks({
    teamId: team.id,
    today,
    weekEnd: addDaysYmd(today, 7),
    openOnly: true,
  });
  const thread = profile.isGuest ? null : await loadTeamChat(team.id, profile.id);

  return (
    <AreaWorkspace
      tasks={
        <div className="px-4 py-5 md:px-7">
          {tasks.length === 0 ? (
            <EmptyState title={es.tasks.empty} hint={es.tasks.emptyHint} />
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-line bg-sheet">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} href={`/tareas/${task.id}`} />
              ))}
            </div>
          )}
        </div>
      }
      chat={
        thread ? (
          <>
            <div className="hidden border-b border-line px-4 py-3 md:block">
              <p className="text-[13px] font-semibold text-ink">{es.areas.chat}</p>
              <p className="mt-0.5 text-[11px] text-ink/50">{es.areas.emptyChat}</p>
            </div>
            <ThreadView
              chatId={thread.chat.id}
              userId={profile.id}
              members={thread.members}
              initial={thread.messages}
              emptyLabel={es.areas.emptyChat}
            />
          </>
        ) : (
          <p className="px-4 py-6 text-[13px] text-ink/55">{es.areas.noChat}</p>
        )
      }
    />
  );
}

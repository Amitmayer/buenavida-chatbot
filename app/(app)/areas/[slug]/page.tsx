import { notFound } from "next/navigation";
import { es } from "@/lib/i18n/es";
import { addDaysYmd, todayYmd } from "@/lib/agent/dates";
import { getSessionProfile, listVisibleTasks } from "@/lib/session";
import { loadTeamChat } from "@/lib/mensajes";
import { ThreadView } from "@/components/mensajes/thread-view";
import { AreaWorkspace } from "@/components/areas/area-workspace";
import { AreaBoard } from "@/components/areas/area-board";
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
  if (!member && !profile.hasFullAccess) notFound();

  const today = todayYmd();
  const [tasks, thread, people] = await Promise.all([
    listVisibleTasks({
      teamId: team.id,
      today,
      weekEnd: addDaysYmd(today, 7),
      openOnly: true,
    }),
    profile.isGuest ? Promise.resolve(null) : loadTeamChat(team.id, profile.id),
    supabase
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("team_id", team.id),
  ]);

  return (
    <AreaWorkspace
      tasks={<AreaBoard tasks={tasks} peopleCount={people.count ?? 0} />}
      chat={
        thread ? (
          <>
            <div className="hidden border-b-2 border-ink/12 px-6 py-6 md:block">
              <p className="text-[22px] font-bold text-ink md:text-[26px]">{es.areas.chatTitle}</p>
              <p className="mt-1 text-[16px] text-ink/70 md:text-[18px]">
                {es.areas.chatHint.replace("{name}", team.name)}
              </p>
            </div>
            <ThreadView
              chatId={thread.chat.id}
              userId={profile.id}
              members={thread.members}
              initial={thread.messages}
              emptyLabel={es.areas.emptyChat}
              layout="area"
            />
          </>
        ) : (
          <p className="px-6 py-6 text-[16px] text-ink/55">{es.areas.noChat}</p>
        )
      }
    />
  );
}

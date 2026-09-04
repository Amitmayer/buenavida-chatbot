import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { es } from "@/lib/i18n/es";
import { getSessionProfile } from "@/lib/session";
import { loadThread } from "@/lib/mensajes";
import { ThreadView } from "@/components/mensajes/thread-view";
import { initials } from "@/lib/utils";

export default async function MensajeThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getSessionProfile();
  if (!profile) return null;
  const thread = await loadThread(id, profile.id);
  if (!thread) notFound();
  if (thread.chat.kind === "channel" && thread.chat.slug && thread.chat.slug !== "general") {
    redirect(`/canales/${thread.chat.slug}`);
  }
  const others = thread.members.filter((m) => m.user_id !== profile.id);
  const announcements = thread.chat.kind === "channel" && thread.chat.slug === "general";
  const square = thread.chat.kind !== "dm";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2.5 border-b border-ink/10 bg-paper px-4 py-3">
        <Link href="/mensajes" className="shrink-0 text-[11px] font-medium text-ink/50 md:hidden">
          {es.mensajes.back}
        </Link>
        <span
          className={
            square
              ? "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-[#DDD8C6] text-[11px] font-semibold text-[#3C5540]"
              : "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#DDD8C6] text-[11px] font-semibold text-[#3C5540]"
          }
        >
          {announcements ? "AN" : initials(thread.title)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[14px] font-semibold text-ink">{thread.title}</h1>
          <p className="truncate text-[11px] text-ink/50">
            {announcements
              ? es.canales.announcementHint
              : others.map((m) => m.full_name.split(" ")[0]).join(", ")}
          </p>
        </div>
      </div>
      <ThreadView
        key={thread.chat.id}
        chatId={thread.chat.id}
        userId={profile.id}
        members={thread.members}
        initial={thread.messages}
        emptyLabel={announcements ? es.canales.announcementEmpty : undefined}
        layout={announcements ? "announcements" : "thread"}
        tasks={thread.tasks}
        composerPlaceholder={announcements ? es.canales.announcementComposer : undefined}
      />
    </div>
  );
}

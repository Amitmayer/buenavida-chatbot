import Link from "next/link";
import { notFound } from "next/navigation";
import { es } from "@/lib/i18n/es";
import { getSessionProfile } from "@/lib/session";
import { loadThread } from "@/lib/mensajes";
import { loadChannel } from "@/lib/canales";
import { ThreadView } from "@/components/mensajes/thread-view";
import { MensajesShell } from "@/components/mensajes/mensajes-shell";
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

  const announcements = thread.chat.kind === "channel" && thread.chat.slug === "general";
  const channel = announcements ? await loadChannel("general", profile.id) : null;
  const others = thread.members.filter((m) => m.user_id !== profile.id);
  const square = thread.chat.kind !== "dm";
  const title = announcements ? es.canales.announcements : thread.title;

  return (
    <MensajesShell activeId={thread.chat.id}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2.5 border-b border-ink/10 bg-paper px-4 py-3 md:px-6">
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
            {announcements ? title.slice(0, 2).toUpperCase() : initials(thread.title)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[14px] font-semibold text-ink">{title}</h1>
            {announcements ? (
              <p className="truncate text-[11px] text-ink/50">{es.canales.announcementHint}</p>
            ) : others.length > 0 ? (
              <p className="truncate text-[11px] text-ink/50">
                {others.map((m) => m.full_name.split(" ")[0]).join(", ")}
              </p>
            ) : null}
          </div>
        </div>
        <ThreadView
          chatId={thread.chat.id}
          userId={profile.id}
          members={channel?.members ?? thread.members}
          initial={channel?.messages ?? thread.messages}
          emptyLabel={announcements ? es.canales.announcementEmpty : es.mensajes.emptyThread}
          layout={announcements ? "announcements" : "thread"}
          tasks={channel?.tasks ?? []}
          composerPlaceholder={announcements ? es.canales.announcementComposer : undefined}
        />
      </div>
    </MensajesShell>
  );
}

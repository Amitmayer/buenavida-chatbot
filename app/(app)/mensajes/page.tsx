import { es } from "@/lib/i18n/es";
import { getSessionProfile } from "@/lib/session";
import { loadChannel } from "@/lib/canales";
import { ThreadView } from "@/components/mensajes/thread-view";

export default async function MensajesPage() {
  const profile = await getSessionProfile();
  if (!profile) return null;

  const thread = await loadChannel("general", profile.id);
  if (!thread) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-paper p-10">
        <div className="max-w-[520px] rounded-[22px] border-2 border-ink/10 bg-sheet px-10 py-10 text-center">
          <p className="text-[28px] font-bold text-ink">{es.mensajes.pick}</p>
          <p className="mt-3 text-[18px] leading-relaxed text-ink/70">{es.mensajes.pickHint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="border-b border-ink/10 px-4 py-3">
        <h1 className="truncate text-[16px] font-semibold text-ink">{es.canales.announcements}</h1>
        <p className="truncate text-[11px] text-ink/50">{es.canales.announcementHint}</p>
      </div>
      <ThreadView
        chatId={thread.chat.id}
        userId={profile.id}
        members={thread.members}
        initial={thread.messages}
        emptyLabel={es.canales.announcementEmpty}
        layout="announcements"
        tasks={thread.tasks}
        composerPlaceholder={es.canales.announcementComposer}
      />
    </div>
  );
}

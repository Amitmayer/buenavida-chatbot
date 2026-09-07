import { getSessionProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { listInbox } from "@/lib/mensajes";
import { EmptyState } from "@/components/empty-state";
import { NewMessageForms } from "@/components/mensajes/new-message-forms";
import { InboxList } from "@/components/mensajes/inbox-list";
import { es } from "@/lib/i18n/es";

export default async function MensajesPage() {
  const profile = await getSessionProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const [{ data: people }, inbox] = await Promise.all([
    supabase.from("profiles").select("id, full_name").neq("id", profile.id).order("full_name"),
    listInbox(profile.id, { isGuest: profile.isGuest }),
  ]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-paper">
      <div className="min-w-0 flex-1 overflow-auto bg-wash md:max-w-[470px] md:border-r-2 md:border-ink/15">
        <div className="flex items-center gap-1.5 px-4 py-5">
          {profile.isGuest ? null : <NewMessageForms people={people ?? []} />}
        </div>
        {profile.isGuest ? (
          <p className="px-4 text-[14px] text-ink/70">{es.mensajes.guestHint}</p>
        ) : null}
        {inbox.length === 0 ? (
          <div className="px-4">
            <EmptyState title={es.mensajes.empty} />
          </div>
        ) : (
          <InboxList rows={inbox} />
        )}
      </div>
      <div className="hidden min-w-0 flex-1 items-center justify-center bg-paper p-10 md:flex">
        <div className="max-w-[520px] rounded-[22px] border-2 border-ink/10 bg-sheet px-10 py-10 text-center">
          <p className="text-[28px] font-bold text-ink">{es.mensajes.pick}</p>
          <p className="mt-3 text-[18px] leading-relaxed text-ink/70">{es.mensajes.pickHint}</p>
        </div>
      </div>
    </div>
  );
}

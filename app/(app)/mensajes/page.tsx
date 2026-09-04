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
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="min-w-0 flex-1 overflow-auto bg-sheet md:max-w-[320px] md:border-r md:border-line">
        <div className="flex items-center gap-1.5 px-3.5 py-3.5">
          {profile.isGuest ? null : <NewMessageForms people={people ?? []} />}
        </div>
        {profile.isGuest ? (
          <p className="px-3.5 text-[12.5px] text-mute">{es.mensajes.guestHint}</p>
        ) : null}
        {inbox.length === 0 ? (
          <div className="px-3.5">
            <EmptyState title={es.mensajes.empty} />
          </div>
        ) : (
          <InboxList rows={inbox} />
        )}
      </div>
      <div className="hidden min-w-0 flex-1 items-center justify-center md:flex">
        <p className="text-[13px] text-ink/45">{es.mensajes.pick}</p>
      </div>
    </div>
  );
}

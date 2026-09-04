import type { ReactNode } from "react";
import { getSessionProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { listInbox } from "@/lib/mensajes";
import { EmptyState } from "@/components/empty-state";
import { NewMessageForms } from "@/components/mensajes/new-message-forms";
import { InboxList } from "@/components/mensajes/inbox-list";
import { MensajesFrame } from "@/components/mensajes/mensajes-frame";
import { es } from "@/lib/i18n/es";

export default async function MensajesLayout({ children }: { children: ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const [{ data: people }, inbox] = await Promise.all([
    supabase.from("profiles").select("id, full_name").neq("id", profile.id).order("full_name"),
    listInbox(profile.id, { isGuest: profile.isGuest }),
  ]);

  return (
    <MensajesFrame
      sidebar={
        <>
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
        </>
      }
    >
      {children}
    </MensajesFrame>
  );
}

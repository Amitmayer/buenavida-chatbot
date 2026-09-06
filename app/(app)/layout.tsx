import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ensureConversation, getSessionProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { countFolders } from "@/lib/email/mailbox";
import { es } from "@/lib/i18n/es";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/entrar");
  const conversationId = await ensureConversation(profile.id, es.chat.title);
  const roleLabel =
    profile.teams.find((team) => team.id === profile.default_team)?.name ?? profile.title ?? "";

  let mailCounts = null;
  if (!profile.isGuest) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("emails")
      .select("unread, inbound, archived, is_draft, gmail_id")
      .eq("user_id", profile.id);
    mailCounts = countFolders(data ?? []);
  }

  return (
    <AppShell
      name={profile.full_name}
      roleLabel={roleLabel}
      teams={profile.accessibleTeams}
      showEquipo={profile.isAdmin}
      showArchivos
      showCorreo={!profile.isGuest}
      conversationId={conversationId}
      mailCounts={mailCounts}
    >
      {children}
    </AppShell>
  );
}

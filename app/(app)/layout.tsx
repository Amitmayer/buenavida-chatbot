import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ensureConversation, getSessionProfile } from "@/lib/session";
import { AppShell } from "@/components/nav/app-shell";
import { es } from "@/lib/i18n/es";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/entrar");
  const conversationId = await ensureConversation(profile.id, es.chat.title);
  const roleLabel =
    profile.teams.find((team) => team.id === profile.default_team)?.name ?? profile.title ?? "";
  return (
    <AppShell
      name={profile.full_name}
      roleLabel={roleLabel}
      teams={profile.teams}
      showEquipo={profile.isAdmin}
      showArchivos
      conversationId={conversationId}
    >
      {children}
    </AppShell>
  );
}

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ensureConversation, getSessionProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { countFolders } from "@/lib/email/mailbox";
import { CORREO_ENABLED } from "@/lib/constants";
import { listInbox, unreadChatTotal } from "@/lib/mensajes";
import { noticesFromInbox, noticesFromMail } from "@/lib/notify/unseen";
import { I18nProvider } from "@/components/i18n/provider";
import { getLocale, getMessages } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [profile, locale, es] = await Promise.all([
    getSessionProfile(),
    getLocale(),
    getMessages(),
  ]);
  if (!profile) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return (
        <I18nProvider locale={locale}>
          <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper px-6">
            <p className="text-[16px] font-medium text-ink">{es.crash.title}</p>
            <a href="/hoy" className="rounded-[13px] bg-ink px-5 py-3 text-[16px] font-semibold text-cream">
              {es.crash.retry}
            </a>
          </main>
        </I18nProvider>
      );
    }
    redirect("/entrar");
  }
  const conversationId = await ensureConversation(profile.id, es.chat.title);
  const roleLabel =
    profile.teams.find((team) => team.id === profile.default_team)?.name ?? profile.title ?? "";

  const supabase = await createClient();
  const showCorreo = CORREO_ENABLED && !profile.isGuest;
  const [inbox, mailResult] = await Promise.all([
    listInbox(profile.id, { isGuest: profile.isGuest }),
    showCorreo
      ? supabase
          .from("emails")
          .select(
            "id, unread, inbound, archived, is_draft, gmail_id, from_address, subject, snippet, occurred_at",
          )
          .eq("user_id", profile.id)
          .order("occurred_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const mailRows = mailResult.data ?? [];
  const mailCounts = showCorreo ? countFolders(mailRows) : null;
  const notices = [
    ...noticesFromInbox(inbox),
    ...(showCorreo ? noticesFromMail(mailRows) : []),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <I18nProvider locale={locale}>
    <AppShell
      name={profile.full_name}
      roleLabel={roleLabel}
      teams={profile.accessibleTeams}
      showEquipo={profile.isAdmin}
      showArchivos
      showCorreo={showCorreo}
      conversationId={conversationId}
      mailCounts={mailCounts}
      chatUnread={unreadChatTotal(inbox)}
      notices={notices}
      userId={profile.id}
    >
      {children}
    </AppShell>
    </I18nProvider>
  );
}

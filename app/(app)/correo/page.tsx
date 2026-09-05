import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { publicAccount } from "@/lib/email/accounts";
import { gmailConfigured } from "@/lib/email/gmail";
import { ConnectPanel } from "@/components/correo/connect-panel";
import { InboxList } from "@/components/correo/inbox-list";
import { MailboxToolbar } from "@/components/correo/mailbox-toolbar";
import { EmptyState } from "@/components/empty-state";
import { es } from "@/lib/i18n/es";

export default async function CorreoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) return null;
  if (profile.isGuest) redirect("/hoy");
  const params = await searchParams;
  const supabase = await createClient();
  const account = await publicAccount(supabase, profile.id);
  if (!account) {
    return <ConnectPanel configured={gmailConfigured()} error={params.error} />;
  }
  const { data: rows } = await supabase
    .from("emails")
    .select("*")
    .eq("user_id", profile.id)
    .order("occurred_at", { ascending: false })
    .limit(80);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="min-w-0 flex-1 overflow-auto bg-sheet md:max-w-[320px] md:border-r md:border-line">
        <MailboxToolbar address={account.email} />
        {(rows ?? []).length === 0 ? (
          <div className="px-3.5">
            <EmptyState title={es.correo.empty} hint={es.correo.emptyHint} />
          </div>
        ) : (
          <InboxList rows={rows ?? []} />
        )}
      </div>
      <div className="hidden min-w-0 flex-1 items-center justify-center md:flex">
        <p className="text-[13px] text-ink/45">{es.correo.pick}</p>
      </div>
    </div>
  );
}

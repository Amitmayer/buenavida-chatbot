import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { publicAccount } from "@/lib/email/accounts";
import { gmailConfigured } from "@/lib/email/gmail";
import { ConnectPanel } from "@/components/correo/connect-panel";
import { MailWorkspace } from "@/components/correo/mail-workspace";
import { countFolders, filterMails, parseFilter, parseFolder } from "@/lib/email/mailbox";
import type { Email } from "@/lib/db/types";

export default async function CorreoPage({
  searchParams,
}: {
  searchParams: Promise<{ buzon?: string; filtro?: string; q?: string; error?: string; ok?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) return null;
  if (profile.isGuest) redirect("/hoy");

  const params = await searchParams;
  const supabase = await createClient();
  const account = await publicAccount(supabase, profile.id);
  const folder = parseFolder(params.buzon);
  const filter = parseFilter(params.filtro);
  const query = params.q ?? "";

  const { data: emails } = await supabase
    .from("emails")
    .select("*")
    .eq("user_id", profile.id)
    .order("occurred_at", { ascending: false })
    .limit(200);

  const all = (emails ?? []) as Email[];

  return (
    <MailWorkspace
      name={profile.full_name}
      address={account?.email ?? ""}
      canModify={account?.canModify ?? false}
      teams={profile.accessibleTeams}
      rows={account ? filterMails(all, { folder, filter, query }) : []}
      selected={null}
      counts={account ? countFolders(all) : countFolders([])}
      folder={folder}
      filter={filter}
      query={query}
      autoSync={Boolean(account && params.ok === "1")}
      connect={
        account ? undefined : (
          <ConnectPanel configured={gmailConfigured()} error={params.error} />
        )
      }
    />
  );
}

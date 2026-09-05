import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { publicAccount } from "@/lib/email/accounts";
import { InboxList } from "@/components/correo/inbox-list";
import { MailboxToolbar } from "@/components/correo/mailbox-toolbar";
import { MailActions } from "@/components/correo/mail-actions";
import { es } from "@/lib/i18n/es";
import { crDateLabel, crInstantYmd, crTimeLabel } from "@/lib/agent/dates";

export default async function CorreoThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getSessionProfile();
  if (!profile) return null;
  if (profile.isGuest) redirect("/hoy");
  const supabase = await createClient();
  const account = await publicAccount(supabase, profile.id);
  if (!account) redirect("/correo");
  const [{ data: mail }, { data: rows }] = await Promise.all([
    supabase.from("emails").select("*").eq("id", id).eq("user_id", profile.id).maybeSingle(),
    supabase
      .from("emails")
      .select("*")
      .eq("user_id", profile.id)
      .order("occurred_at", { ascending: false })
      .limit(80),
  ]);
  if (!mail) notFound();

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="hidden min-w-0 w-[320px] shrink-0 overflow-auto border-r border-line bg-sheet md:block">
        <MailboxToolbar address={account.email} />
        <InboxList rows={rows ?? []} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className="border-b border-line px-4 py-3 md:px-6">
          <Link href="/correo" className="mb-1 inline-block text-[11px] font-medium text-ink/50 md:hidden">
            {es.correo.back}
          </Link>
          <h1 className="text-[16px] font-semibold leading-snug text-ink">{mail.subject || "—"}</h1>
          <p className="mt-1 text-[12px] text-ink/55">{mail.from_address}</p>
          <p className="mt-0.5 font-mono text-[10.5px] text-ink/40">
            {crDateLabel(crInstantYmd(mail.occurred_at))} · {crTimeLabel(mail.occurred_at)}
          </p>
        </div>
        {mail.summary ? (
          <div className="border-b border-line bg-wash px-4 py-3 md:px-6">
            <p className="font-mono text-[10px] tracking-[0.12em] text-ink/45">
              {es.correo.summary.toUpperCase()}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink">{mail.summary}</p>
          </div>
        ) : null}
        <div className="flex-1 px-4 py-4 md:px-6">
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
            {mail.body_text || mail.snippet}
          </p>
        </div>
        <MailActions mail={mail} />
      </div>
    </div>
  );
}

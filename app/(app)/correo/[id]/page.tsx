import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { accessTokenFor, publicAccount } from "@/lib/email/accounts";
import { hydrateMailHtml } from "@/lib/email/hydrate";
import { wrapMailDocument } from "@/lib/email/html";
import { MailWorkspace } from "@/components/correo/mail-workspace";
import { countFolders, filterMails, parseFilter, parseFolder } from "@/lib/email/mailbox";
import type { Email } from "@/lib/db/types";

export default async function CorreoThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ buzon?: string; filtro?: string; q?: string }>;
}) {
  const { id } = await params;
  const queryParams = await searchParams;
  const profile = await getSessionProfile();
  if (!profile) return null;
  if (profile.isGuest) redirect("/hoy");

  const supabase = await createClient();
  const account = await publicAccount(supabase, profile.id);
  if (!account) redirect("/correo");

  const folder = parseFolder(queryParams.buzon);
  const filter = parseFilter(queryParams.filtro);
  const query = queryParams.q ?? "";

  const [{ data: selected }, { data: emails }] = await Promise.all([
    supabase.from("emails").select("*").eq("id", id).eq("user_id", profile.id).maybeSingle(),
    supabase
      .from("emails")
      .select("*")
      .eq("user_id", profile.id)
      .order("occurred_at", { ascending: false })
      .limit(200),
  ]);

  if (!selected) notFound();

  const all = (emails ?? []) as Email[];
  const selectedMail = selected as Email;
  const ready = await accessTokenFor(supabase, profile.id);
  const html = ready
    ? await hydrateMailHtml(supabase, { accessToken: ready.accessToken, mail: selectedMail })
    : selectedMail.body_html
      ? wrapMailDocument(selectedMail.body_html)
      : "";

  return (
    <MailWorkspace
      address={account.email}
      rows={filterMails(all, { folder, filter, query })}
      selected={selectedMail}
      counts={countFolders(all)}
      folder={folder}
      filter={filter}
      query={query}
      html={html}
    />
  );
}

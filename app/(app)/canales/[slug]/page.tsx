import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { es } from "@/lib/i18n/es";
import { getSessionProfile } from "@/lib/session";
import { loadChannel } from "@/lib/canales";
import { ChannelFilesRail } from "@/components/canales/channel-files-rail";
import { ChannelUploader } from "@/components/files/channel-uploader";
import { ThreadView } from "@/components/mensajes/thread-view";
import { createClient } from "@/lib/supabase/server";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/constants";

export default async function CanalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getSessionProfile();
  if (!profile) return null;
  const thread = await loadChannel(slug, profile.id);
  if (!thread) notFound();
  if (slug === "general") {
    redirect(`/mensajes/${thread.chat.id}`);
  }
  const supabase = await createClient();
  const bucket = process.env.STORAGE_BUCKET_CHANNELS ?? "channel-files";
  const files = await Promise.all(
    thread.files.map(async (file) => {
      const signed = await supabase.storage
        .from(bucket)
        .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);
      return {
        id: file.id,
        filename: file.filename,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        url: signed.data?.signedUrl ?? null,
      };
    }),
  );
  const names = thread.members
    .filter((member) => member.user_id !== profile.id)
    .map((member) => member.full_name.split(" ")[0])
    .join(", ");

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="border-b border-ink/10 px-4 py-3">
          <Link href="/canales" className="mb-1 inline-block text-[11px] font-medium text-ink/50 md:hidden">
            {es.mensajes.back}
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-[16px] font-semibold text-ink">#{thread.title}</h1>
              <p className="truncate text-[11px] text-ink/50">
                {es.canales.members}: {names || thread.members.length}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 xl:hidden">
              <ChannelUploader chatIdSlug={slug} compact />
              <Link href={`/archivos?carpeta=${slug}`} className="text-[11px] font-semibold text-pine">
                {es.canales.openFiles}
              </Link>
            </div>
          </div>
          {thread.purpose ? (
            <p className="mt-1 text-[11px] leading-relaxed text-ink/45">{thread.purpose}</p>
          ) : null}
        </div>
        <ThreadView
          key={thread.chat.id}
          chatId={thread.chat.id}
          userId={profile.id}
          members={thread.members}
          initial={thread.messages}
          emptyLabel={es.canales.emptyThread}
          tasks={thread.tasks}
        />
      </div>
      <ChannelFilesRail slug={slug} files={files} />
    </div>
  );
}

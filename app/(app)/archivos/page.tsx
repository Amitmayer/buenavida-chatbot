import { es } from "@/lib/i18n/es";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import { FileBrowser, type LibraryFile, type LibraryFolder } from "@/components/files/file-browser";
import { listChannels } from "@/lib/canales";

export default async function ArchivosPage({
  searchParams,
}: {
  searchParams: Promise<{ carpeta?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) return null;
  const { carpeta } = await searchParams;
  const supabase = await createClient();
  const channels = await listChannels(profile.id);
  const folders: LibraryFolder[] = [
    ...(profile.isGuest ? [] : [{ id: "marca", label: es.files.marca, kind: "marca" as const }]),
    ...channels.map((channel) => ({
      id: channel.slug,
      label: channel.title,
      kind: "channel" as const,
    })),
  ];

  const files: LibraryFile[] = [];
  if (!profile.isGuest) {
    const { data: brand } = await supabase
      .from("brand_files")
      .select("*")
      .order("created_at", { ascending: false });
    const bucket = process.env.STORAGE_BUCKET_BRAND ?? "marca";
    for (const file of brand ?? []) {
      const signed = await supabase.storage
        .from(bucket)
        .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);
      files.push({
        id: file.id,
        filename: file.filename,
        folder: "marca",
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        url: signed.data?.signedUrl ?? null,
      });
    }
  }

  const channelIds = channels.map((channel) => channel.chat.id);
  if (channelIds.length > 0) {
    const { data: channelFiles } = await supabase
      .from("channel_files")
      .select("*")
      .in("chat_id", channelIds)
      .order("created_at", { ascending: false });
    const bucket = process.env.STORAGE_BUCKET_CHANNELS ?? "channel-files";
    const slugByChat = Object.fromEntries(channels.map((channel) => [channel.chat.id, channel.slug]));
    for (const file of channelFiles ?? []) {
      const signed = await supabase.storage
        .from(bucket)
        .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);
      files.push({
        id: file.id,
        filename: file.filename,
        folder: slugByChat[file.chat_id] ?? file.chat_id,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        url: signed.data?.signedUrl ?? null,
      });
    }
  }

  const initialFolder =
    carpeta && folders.some((folder) => folder.id === carpeta)
      ? carpeta
      : folders[0]?.id;

  if (folders.length === 0) {
    return <p className="px-4 py-6 text-sm text-mute">{es.files.guestHidden}</p>;
  }

  return (
    <FileBrowser
      key={initialFolder}
      files={files}
      folders={folders}
      canUploadMarca={profile.isAdmin}
      initialFolder={initialFolder}
    />
  );
}

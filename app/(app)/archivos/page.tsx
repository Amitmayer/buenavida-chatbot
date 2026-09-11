import { es } from "@/lib/i18n/es";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import { FileBrowser, type LibraryFile, type LibraryFolder } from "@/components/files/file-browser";
import { listChannels } from "@/lib/canales";

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ArchivosPage({
  searchParams,
}: {
  searchParams: Promise<{ carpeta?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) return null;
  const { carpeta } = await searchParams;
  const supabase = await createClient();
  const channels = await listChannels(profile.id, { hasFullAccess: profile.hasFullAccess });
  const taskTeams = profile.accessibleTeams;
  const folders: LibraryFolder[] = [
    ...(profile.isGuest ? [] : [{ id: "marca", label: es.files.marca, kind: "marca" as const }]),
    ...(taskTeams.length > 0
      ? [
          { id: "tareas", label: es.files.tasksAll, kind: "tasks" as const },
          ...taskTeams.map((team) => ({
            id: `tareas:${team.slug}`,
            label: team.name,
            kind: "tasks" as const,
          })),
        ]
      : []),
    ...channels.map((channel) => ({
      id: channel.slug,
      label: channel.title,
      kind: "channel" as const,
    })),
  ];

  const channelIds = channels.map((channel) => channel.chat.id);
  const slugByChat = Object.fromEntries(channels.map((channel) => [channel.chat.id, channel.slug]));
  const brandBucket = process.env.STORAGE_BUCKET_BRAND ?? "marca";
  const channelBucket = process.env.STORAGE_BUCKET_CHANNELS ?? "channel-files";
  const taskBucket = process.env.STORAGE_BUCKET_TASKS ?? "task-files";

  const [{ data: brand }, { data: channelFiles }, { data: taskFiles }] = await Promise.all([
    profile.isGuest
      ? Promise.resolve({ data: [] as { id: string; filename: string; storage_path: string; mime_type: string; size_bytes: number }[] })
      : supabase.from("brand_files").select("*").order("created_at", { ascending: false }),
    channelIds.length > 0
      ? supabase.from("channel_files").select("*").in("chat_id", channelIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; filename: string; storage_path: string; mime_type: string; size_bytes: number; chat_id: string }[] }),
    supabase
      .from("attachments")
      .select("id, filename, mime_type, size_bytes, storage_path, task:tasks(id, title, team:teams(slug, name))")
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  const files: LibraryFile[] = (
    await Promise.all([
      ...(brand ?? []).map(async (file) => {
        const signed = await supabase.storage
          .from(brandBucket)
          .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);
        return {
          id: file.id,
          filename: file.filename,
          folder: "marca",
          mime_type: file.mime_type,
          size_bytes: file.size_bytes,
          url: signed.data?.signedUrl ?? null,
        } satisfies LibraryFile;
      }),
      ...(channelFiles ?? []).map(async (file) => {
        const signed = await supabase.storage
          .from(channelBucket)
          .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);
        return {
          id: file.id,
          filename: file.filename,
          folder: slugByChat[file.chat_id] ?? file.chat_id,
          mime_type: file.mime_type,
          size_bytes: file.size_bytes,
          url: signed.data?.signedUrl ?? null,
        } satisfies LibraryFile;
      }),
      ...(taskFiles ?? []).map(async (file) => {
        const task = first(file.task);
        const team = first(task?.team);
        if (!task || !team) return null;
        const signed = await supabase.storage
          .from(taskBucket)
          .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);
        return {
          id: file.id,
          filename: file.filename,
          folder: `tareas:${team.slug}`,
          mime_type: file.mime_type,
          size_bytes: file.size_bytes,
          url: signed.data?.signedUrl ?? null,
          taskHref: `/tareas/${task.id}`,
          taskTitle: task.title,
        } satisfies LibraryFile;
      }),
    ])
  ).filter((file): file is LibraryFile => file !== null);

  const initialFolder =
    carpeta && folders.some((folder) => folder.id === carpeta)
      ? carpeta
      : folders.find((folder) => folder.id === "tareas")?.id ?? folders[0]?.id;

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

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { channelStoragePath, validateUpload } from "@/lib/storage";
import { captureError } from "@/lib/sentry";

const uploadFields = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  slug: z.string().min(1).max(80).optional(),
  chatId: z.string().uuid().optional(),
});

const schema = uploadFields.refine((value) => Boolean(value.slug || value.chatId), {
  message: "channel",
});

const putSchema = uploadFields.extend({ path: z.string().min(1) }).refine(
  (value) => Boolean(value.slug || value.chatId),
  { message: "channel" },
);

async function loadChannel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: { slug?: string; chatId?: string },
) {
  let query = supabase.from("chats").select("id, kind, slug").eq("kind", "channel");
  query = input.chatId ? query.eq("id", input.chatId) : query.eq("slug", input.slug ?? "");
  const { data } = await query.maybeSingle();
  return data;
}

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
  const allowed = validateUpload(parsed.data);
  if (!allowed.ok) return Response.json({ error: allowed.detail }, { status: 400 });

  const supabase = await createClient();
  const chat = await loadChannel(supabase, parsed.data);
  if (!chat) return Response.json({ error: "forbidden" }, { status: 403 });

  const path = channelStoragePath(chat.id, allowed.data.filename);
  const bucket = process.env.STORAGE_BUCKET_CHANNELS ?? "channel-files";
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    captureError(error, { where: "channel.upload-url" });
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  return Response.json({ signedUrl: data.signedUrl, path, chatId: chat.id });
}

export async function PUT(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });

  const supabase = await createClient();
  const chat = await loadChannel(supabase, parsed.data);
  if (!chat) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!parsed.data.path.startsWith(`${chat.id}/`)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("channel_files").insert({
    chat_id: chat.id,
    storage_path: parsed.data.path,
    filename: parsed.data.filename,
    mime_type: parsed.data.mimeType,
    size_bytes: parsed.data.sizeBytes,
    uploaded_by: profile.id,
  });
  if (error) {
    captureError(error, { where: "channel_files.insert" });
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  return Response.json({ ok: true });
}

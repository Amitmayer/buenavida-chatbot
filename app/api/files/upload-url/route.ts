import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { taskStoragePath, validateUpload } from "@/lib/storage";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import { captureError } from "@/lib/sentry";

const uploadSchema = z.object({
  taskId: z.string().uuid(),
  filename: z.string().min(1).max(180),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

const confirmSchema = uploadSchema.extend({
  path: z.string().min(1),
});

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = uploadSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
  const allowed = validateUpload(parsed.data);
  if (!allowed.ok) return Response.json({ error: allowed.detail }, { status: 400 });

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, team_id")
    .eq("id", parsed.data.taskId)
    .maybeSingle();
  if (!task) return Response.json({ error: "not_found" }, { status: 404 });

  const path = taskStoragePath(task.team_id, task.id, allowed.data.filename);
  const bucket = process.env.STORAGE_BUCKET_TASKS ?? "task-files";
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    captureError(error, { where: "upload-url" });
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  return Response.json({ signedUrl: data.signedUrl, path, token: data.token });
}

export async function PUT(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = confirmSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("attachments").insert({
    task_id: parsed.data.taskId,
    storage_path: parsed.data.path,
    filename: parsed.data.filename,
    mime_type: parsed.data.mimeType,
    size_bytes: parsed.data.sizeBytes,
    uploaded_by: profile.id,
  });
  if (error) {
    captureError(error, { where: "attachments.insert" });
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  return Response.json({ ok: true, ttl: SIGNED_URL_TTL_SECONDS });
}

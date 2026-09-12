import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { projectStoragePath, validateUpload } from "@/lib/storage";
import { captureError } from "@/lib/sentry";

const uploadSchema = z.object({
  projectId: z.string().uuid(),
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
  const allowed = validateUpload({
    filename: parsed.data.filename,
    mimeType: parsed.data.mimeType,
    sizeBytes: parsed.data.sizeBytes,
  });
  if (!allowed.ok) return Response.json({ error: allowed.detail }, { status: 400 });

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, team_id")
    .eq("id", parsed.data.projectId)
    .is("archived_at", null)
    .maybeSingle();
  if (!project) return Response.json({ error: "forbidden" }, { status: 403 });

  const path = projectStoragePath(project.id, allowed.data.filename);
  const bucket = process.env.STORAGE_BUCKET_TASKS ?? "task-files";
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    captureError(error, { where: "project-files.upload-url" });
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  return Response.json({ signedUrl: data.signedUrl, path });
}

export async function PUT(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = confirmSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", parsed.data.projectId)
    .maybeSingle();
  if (!project) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!parsed.data.path.startsWith(`projects/${project.id}/`)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: fileRow, error } = await supabase
    .from("project_files")
    .insert({
      project_id: project.id,
      storage_path: parsed.data.path,
      filename: parsed.data.filename,
      mime_type: parsed.data.mimeType,
      size_bytes: parsed.data.sizeBytes,
      uploaded_by: profile.id,
    })
    .select("id, filename, mime_type, size_bytes, created_at")
    .single();
  if (error || !fileRow) {
    captureError(error, { where: "project_files.insert" });
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  return Response.json({ ok: true, file: fileRow });
}

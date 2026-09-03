import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { validateUpload } from "@/lib/storage";
import { captureError } from "@/lib/sentry";

const schema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  folder: z.string().min(1).max(80),
});

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
  const allowed = validateUpload(parsed.data);
  if (!allowed.ok) return Response.json({ error: allowed.detail }, { status: 400 });
  const supabase = await createClient();
  const path = `${parsed.data.folder}/${crypto.randomUUID()}-${allowed.data.filename}`;
  const bucket = process.env.STORAGE_BUCKET_BRAND ?? "marca";
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    captureError(error, { where: "marca.upload-url" });
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  return Response.json({ signedUrl: data.signedUrl, path });
}

export async function PUT(request: Request) {
  const profile = await getSessionProfile();
  if (!profile?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.extend({ path: z.string() }).safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("brand_files").insert({
    storage_path: parsed.data.path,
    filename: parsed.data.filename,
    mime_type: parsed.data.mimeType,
    size_bytes: parsed.data.sizeBytes,
    folder: parsed.data.folder,
    uploaded_by: profile.id,
  });
  if (error) {
    captureError(error, { where: "brand_files.insert" });
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  return Response.json({ ok: true });
}

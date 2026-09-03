import { createClient } from "@/lib/supabase/server";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import { captureError } from "@/lib/sentry";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: file, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    captureError(error, { where: "files.download" });
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  if (!file) return Response.json({ error: "forbidden" }, { status: 403 });
  const bucket = process.env.STORAGE_BUCKET_TASKS ?? "task-files";
  const signed = await supabase.storage
    .from(bucket)
    .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);
  if (signed.error || !signed.data) {
    captureError(signed.error, { where: "files.signedUrl" });
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  return Response.json({ url: signed.data.signedUrl });
}

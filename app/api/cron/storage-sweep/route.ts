import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { captureError } from "@/lib/sentry";

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = serviceClient();
  const bucket = process.env.STORAGE_BUCKET_TASKS ?? "task-files";
  const { data: objects, error } = await admin.storage.from(bucket).list("", {
    limit: 1000,
  });
  if (error) {
    captureError(error, { where: "storage-sweep.list" });
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  const { data: rows } = await admin.from("attachments").select("storage_path");
  const known = new Set((rows ?? []).map((r) => r.storage_path));
  const removed: string[] = [];
  for (const object of objects ?? []) {
    if (object.name && !known.has(object.name)) {
      await admin.storage.from(bucket).remove([object.name]);
      removed.push(object.name);
    }
  }
  return Response.json({ ok: true, removed: removed.length });
}

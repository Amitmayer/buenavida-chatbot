import { runDigest } from "@/lib/digest/run";
import { captureError } from "@/lib/sentry";

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const result = await runDigest();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    captureError(error, { where: "cron.digest" });
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}

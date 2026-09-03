import { ALLOWED_MIME, MAX_UPLOAD_BYTES, REJECTED_MIME, SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import { err, ok, type ToolResult } from "@/lib/agent/result";

export function validateUpload(args: {
  mimeType: string;
  sizeBytes: number;
  filename: string;
}): ToolResult<{ mimeType: string; sizeBytes: number; filename: string }> {
  const mime = args.mimeType.toLowerCase();
  if (REJECTED_MIME.includes(mime as (typeof REJECTED_MIME)[number]) || mime.includes("svg")) {
    return err("validation", "No se permiten archivos SVG.");
  }
  const allowed =
    ALLOWED_MIME.includes(mime as (typeof ALLOWED_MIME)[number]) ||
    (mime.startsWith("image/") && !mime.includes("svg"));
  if (!allowed) {
    return err("validation", "Este tipo de archivo no está permitido.");
  }
  if (args.sizeBytes > MAX_UPLOAD_BYTES) {
    return err("validation", "El archivo pesa más de 25 MB.");
  }
  if (args.sizeBytes <= 0) {
    return err("validation", "El archivo está vacío.");
  }
  return ok({
    mimeType: mime,
    sizeBytes: args.sizeBytes,
    filename: args.filename.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, "_"),
  });
}

export function taskStoragePath(teamId: string, taskId: string, filename: string): string {
  const id = crypto.randomUUID();
  return `${teamId}/${taskId}/${id}-${filename}`;
}

export function channelStoragePath(chatId: string, filename: string): string {
  const id = crypto.randomUUID();
  return `${chatId}/${id}-${filename}`;
}

export { SIGNED_URL_TTL_SECONDS };

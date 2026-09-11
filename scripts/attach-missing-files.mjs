#!/usr/bin/env node
/**
 * Attach a real file to every task that does not already have one.
 * Loads .env.local and uses the service role against local or hosted Supabase.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env.local");
if (existsSync(ENV_PATH)) {
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const jpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5OjcBCgoKDQwNGg8PGjclHyU3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3N//AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALN9n//Z",
  "base64",
);

function pdfFor(title) {
  const text = title.replace(/[()\\]/g, " ").slice(0, 80);
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  return Buffer.from(
    `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${stream.length}>>stream
${stream}
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
trailer<</Size 6/Root 1 0 R>>
startxref
400
%%EOF
`,
  );
}

function slugName(title) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 70);
}

function kindFor(title, index) {
  const lower = title.toLowerCase();
  if (/foto|imagen|etiqueta|empaque|mockup|reel|carrusel/.test(lower)) {
    return index % 2 === 0
      ? { ext: "png", mime: "image/png" }
      : { ext: "jpg", mime: "image/jpeg" };
  }
  if (/inventario|lista|csv|precios|forecast|humedad|trazabilidad|conciliacion/.test(lower)) {
    return { ext: "csv", mime: "text/csv" };
  }
  const cycle = index % 4;
  if (cycle === 1) return { ext: "csv", mime: "text/csv" };
  if (cycle === 2) return { ext: "png", mime: "image/png" };
  if (cycle === 3) return { ext: "jpg", mime: "image/jpeg" };
  return { ext: "pdf", mime: "application/pdf" };
}

function bytesFor(mime, filename, title) {
  if (mime === "image/png") return png;
  if (mime === "image/jpeg") return jpeg;
  if (mime === "text/csv") {
    return Buffer.from(`archivo,tarea,nota\n${filename},${title},Buena Vida OS\n`, "utf8");
  }
  return pdfFor(title);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const bucket = process.env.STORAGE_BUCKET_TASKS ?? "task-files";

const [{ data: tasks, error: tasksError }, { data: existing, error: attError }] = await Promise.all([
  supabase.from("tasks").select("id, title, team_id, owner_id, created_by").order("created_at"),
  supabase.from("attachments").select("task_id"),
]);
if (tasksError) {
  console.error(tasksError.message);
  process.exit(1);
}
if (attError) {
  console.error(attError.message);
  process.exit(1);
}

const have = new Set((existing ?? []).map((row) => row.task_id));
const missing = (tasks ?? []).filter((task) => !have.has(task.id));
console.log(`Tasks: ${tasks?.length ?? 0}. With files: ${have.size}. Attaching to ${missing.length}.`);

let ok = 0;
for (const [index, task] of missing.entries()) {
  const kind = kindFor(task.title, index);
  const filename = `${slugName(task.title)}.${kind.ext}`;
  const fileId = randomUUID();
  const path = `${task.team_id}/${task.id}/${fileId}-${filename}`;
  const body = bytesFor(kind.mime, filename, task.title);

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: kind.mime,
    upsert: true,
  });
  if (upErr) {
    console.error("upload", path, upErr.message);
    process.exit(1);
  }

  const { error: insErr } = await supabase.from("attachments").insert({
    task_id: task.id,
    storage_path: path,
    filename,
    mime_type: kind.mime,
    size_bytes: body.length,
    uploaded_by: task.owner_id ?? task.created_by,
  });
  if (insErr) {
    console.error("insert", task.title, insErr.message);
    process.exit(1);
  }
  ok += 1;
}

console.log(`Attached files to ${ok} tasks.`);

#!/usr/bin/env node
/**
 * Upload tiny valid files to task-files for every attachments row.
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";

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
const pdf = Buffer.from(
  `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj
4 0 obj<</Length 44>>stream
BT /F1 12 Tf 72 720 Td (Buena Vida OS) Tj ET
endstream
endobj
xref
0 5
trailer<</Size 5/Root 1 0 R>>
startxref
240
%%EOF
`,
);

function bodyFor(mime, filename) {
  if (mime === "image/png") return png;
  if (mime === "image/jpeg") return jpeg;
  if (mime === "text/csv") {
    return Buffer.from(`archivo,nota\n${filename},semilla Buena Vida OS\n`, "utf8");
  }
  return pdf;
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const bucket = process.env.STORAGE_BUCKET_TASKS ?? "task-files";

const { data: files, error } = await supabase.from("attachments").select("storage_path, filename, mime_type");
if (error) {
  console.error(error.message);
  process.exit(1);
}

let ok = 0;
for (const file of files ?? []) {
  const bytes = bodyFor(file.mime_type, file.filename);
  const { error: upErr } = await supabase.storage.from(bucket).upload(file.storage_path, bytes, {
    contentType: file.mime_type,
    upsert: true,
  });
  if (upErr) {
    console.error(file.storage_path, upErr.message);
    process.exit(1);
  }
  ok += 1;
}
console.log(`Uploaded ${ok} attachment files to ${bucket}`);

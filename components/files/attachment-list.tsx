"use client";

import { useEffect, useState } from "react";
import { es } from "@/lib/i18n/es";
import { crDateLabel, crInstantYmd } from "@/lib/agent/dates";
import { formatBytes } from "@/lib/utils";
import { FileOpenActions } from "@/components/files/file-preview";
import { captureError } from "@/lib/sentry";
import type { Attachment } from "@/lib/db/types";

export function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <ul>
      {attachments.map((file) => (
        <AttachmentRow key={file.id} file={file} />
      ))}
    </ul>
  );
}

function AttachmentRow({ file }: { file: Attachment }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch(`/api/files/${file.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { url?: string } | null) => {
        if (active && body?.url) setUrl(body.url);
      })
      .catch((error) => {
        captureError(error, { where: "files.attachmentUrl" });
      });
    return () => {
      active = false;
    };
  }, [file.id]);

  const ext = file.filename.split(".").pop()?.toUpperCase() ?? "FILE";
  const meta = `${formatBytes(file.size_bytes)} · ${crDateLabel(crInstantYmd(file.created_at))}`;
  const thumb = file.mime_type.startsWith("image/") && url;

  return (
    <li className="flex items-center gap-2.5 border-b border-ink/[0.07] py-2 last:border-0">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url ?? ""} alt="" className="h-11 w-11 shrink-0 rounded-[8px] object-cover" />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-end justify-center rounded-[8px] border border-ink/10 bg-sheet pb-1 font-mono text-[8px] text-ink/55">
          {ext}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{file.filename}</span>
        <span className="mt-0.5 block font-mono text-[10.5px] text-ink/45">{meta}</span>
      </span>
      {url ? <FileOpenActions url={url} filename={file.filename} mimeType={file.mime_type} /> : null}
    </li>
  );
}

"use client";

import Link from "next/link";
import { es } from "@/lib/i18n/es";
import { ChannelUploader } from "@/components/files/channel-uploader";
import { FileOpenActions } from "@/components/files/file-preview";
import { formatBytes } from "@/lib/utils";

export type ChannelFileCard = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  url: string | null;
};

export function ChannelFilesRail({
  slug,
  files,
}: {
  slug: string;
  files: ChannelFileCard[];
}) {
  return (
    <aside className="hidden w-[260px] shrink-0 overflow-auto border-l border-ink/10 bg-sheet px-5 py-6 xl:block">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink">{es.canales.files}</p>
        <ChannelUploader chatIdSlug={slug} compact />
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-ink/50">{es.files.channelHint}</p>
      {files.length === 0 ? (
        <p className="text-[12px] text-mute">{es.files.channelEmpty}</p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.id}>
              <p className="truncate text-[12.5px] font-medium text-ink">{file.filename}</p>
              <p className="font-mono text-[10px] text-ink/45">
                {(file.mime_type.split("/")[1] ?? "file").toUpperCase()} · {formatBytes(file.size_bytes)}
              </p>
              {file.url ? (
                <div className="mt-1">
                  <FileOpenActions url={file.url} filename={file.filename} mimeType={file.mime_type} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`/archivos?carpeta=${slug}`}
        prefetch={false}
        className="mt-4 inline-block text-[11px] font-semibold text-pine"
      >
        {es.canales.openFiles}
      </Link>
    </aside>
  );
}

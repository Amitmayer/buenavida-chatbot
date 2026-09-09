"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { es } from "@/lib/i18n/es";
import { EmptyState } from "@/components/empty-state";
import { BrandUploader } from "@/components/files/brand-uploader";
import { ChannelUploader } from "@/components/files/channel-uploader";
import { FileOpenActions, FilePreview } from "@/components/files/file-preview";
import { canPreviewFile } from "@/lib/files/preview";
import { formatBytes } from "@/lib/utils";

export type LibraryFolder = {
  id: string;
  label: string;
  kind: "marca" | "channel";
};

export type LibraryFile = {
  id: string;
  filename: string;
  folder: string;
  mime_type: string;
  size_bytes: number;
  url: string | null;
};

export function FileBrowser({
  files,
  folders,
  canUploadMarca,
  initialFolder,
}: {
  files: LibraryFile[];
  folders: LibraryFolder[];
  canUploadMarca: boolean;
  initialFolder?: string;
}) {
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState(initialFolder ?? folders[0]?.id ?? "");
  const [searchOpen, setSearchOpen] = useState(false);
  const fileSearch = useRef<HTMLInputElement>(null);
  const selected = folders.find((item) => item.id === folder) ?? folders[0];
  const visible = files.filter((file) => {
    const q = query.trim().toLowerCase();
    const matchQ = !q || file.filename.toLowerCase().includes(q);
    const matchF = !selected || file.folder === selected.id;
    return matchQ && matchF;
  });
  const emptyTitle =
    selected?.kind === "channel" ? es.files.channelEmpty : es.files.empty;
  const canUpload = selected?.kind === "marca" ? canUploadMarca : selected?.kind === "channel";

  useEffect(() => {
    if (searchOpen) fileSearch.current?.focus();
  }, [searchOpen]);

  const groupedFolders = useMemo(() => {
    const marca = folders.filter((item) => item.kind === "marca");
    const channels = folders.filter((item) => item.kind === "channel");
    return { marca, channels };
  }, [folders]);

  function count(id: string) {
    return files.filter((file) => file.folder === id).length;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="hidden w-[212px] shrink-0 border-r border-ink/10 px-3.5 py-[18px] md:block">
        <p className="px-2 pb-2.5 font-mono text-[9.5px] tracking-[0.14em] text-ink/45">
          {es.files.folders.toUpperCase()}
        </p>
        {groupedFolders.marca.map((item) => (
          <FolderButton
            key={item.id}
            name={item.label}
            count={count(item.id)}
            on={folder === item.id}
            onClick={() => setFolder(item.id)}
          />
        ))}
        {groupedFolders.channels.length > 0 ? (
          <p className="mt-4 px-2 pb-2.5 font-mono text-[9.5px] tracking-[0.14em] text-ink/45">
            {es.nav.canales.toUpperCase()}
          </p>
        ) : null}
        {groupedFolders.channels.map((item) => (
          <FolderButton
            key={item.id}
            name={`#${item.label}`}
            count={count(item.id)}
            on={folder === item.id}
            onClick={() => setFolder(item.id)}
          />
        ))}
      </aside>
      <div className="min-w-0 flex-1 overflow-auto">
        <div className="flex items-center gap-2 px-4 pt-3.5 pb-2 md:gap-3 md:px-7 md:py-5">
          <button
            type="button"
            aria-label={es.files.search}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((on) => !on)}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-ink/15 bg-sheet text-ink md:hidden"
          >
            <span className="font-mono text-[13px]" aria-hidden>
              ⌕
            </span>
          </button>
          <input
            ref={fileSearch}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => {
              if (!query.trim()) setSearchOpen(false);
            }}
            placeholder={es.files.search}
            className={
              searchOpen
                ? "h-[34px] min-w-0 flex-1 rounded-[9px] border border-ink/15 bg-sheet px-3 text-[12.5px] placeholder:text-ink/45 md:block md:w-[220px] md:flex-none"
                : "hidden h-[34px] rounded-[9px] border border-ink/15 bg-sheet px-3 text-[12.5px] placeholder:text-ink/45 md:block md:w-[220px]"
            }
          />
          {searchOpen ? null : <span className="min-w-0 flex-1 md:hidden" />}
          <span className="hidden flex-1 md:block" />
          {canUpload ? (
            selected?.kind === "marca" ? (
              <BrandUploader compact />
            ) : (
              <ChannelUploader chatIdSlug={selected?.id} compact />
            )
          ) : null}
        </div>
        <div className="flex gap-1.5 overflow-auto px-4 pb-3 md:hidden">
          {folders.map((item) => (
            <Chip key={item.id} on={folder === item.id} onClick={() => setFolder(item.id)}>
              {item.kind === "channel" ? `#${item.label}` : item.label}
            </Chip>
          ))}
        </div>
        {selected?.kind === "channel" ? (
          <p className="px-4 pb-2 text-[12px] text-ink/50 md:px-7">{es.files.channelHint}</p>
        ) : null}
        {visible.length === 0 ? (
          <div className="px-4 py-6 md:px-7">
            <EmptyState title={emptyTitle} />
          </div>
        ) : (
          <section className="grid grid-cols-2 gap-3 px-4 pb-10 sm:grid-cols-3 md:grid-cols-[repeat(auto-fill,minmax(214px,1fr))] md:gap-4 md:px-7">
            {visible.map((file) => (
              <FileCard key={file.id} file={file} />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function FileCard({ file }: { file: LibraryFile }) {
  const [open, setOpen] = useState(false);
  const previewable = Boolean(file.url && canPreviewFile(file.mime_type));

  return (
    <article className="overflow-hidden rounded-[14px] border border-ink/10 bg-sheet hover:border-ink/25">
      {previewable ? (
        <button type="button" onClick={() => setOpen(true)} className="block w-full" aria-label={es.files.preview}>
          <FileThumb file={file} />
        </button>
      ) : (
        <FileThumb file={file} />
      )}
      <div className="px-3.5 py-3">
        <p className="text-[12.5px] font-medium leading-snug text-ink">{file.filename}</p>
        <p className="mt-1.5 font-mono text-[10px] text-ink/45">{formatBytes(file.size_bytes)}</p>
        {file.url ? (
          <div className="mt-2">
            <FileOpenActions url={file.url} filename={file.filename} mimeType={file.mime_type} />
          </div>
        ) : null}
      </div>
      {open && file.url ? (
        <FilePreview
          filename={file.filename}
          mimeType={file.mime_type}
          src={file.url}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </article>
  );
}

function FileThumb({ file }: { file: LibraryFile }) {
  if (file.url && file.mime_type.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={file.url} alt={file.filename} className="h-[104px] w-full object-cover" />
    );
  }
  return (
    <div className="flex h-[104px] items-center justify-center bg-[repeating-linear-gradient(135deg,#EDEBDF_0_8px,#E5E2D3_8px_16px)]">
      <span className="font-mono text-[10px] tracking-[0.1em] text-ink/40">
        {(file.mime_type.split("/")[1] ?? "FILE").toUpperCase()}
      </span>
    </div>
  );
}

function FolderButton({
  name,
  count,
  on,
  onClick,
}: {
  name: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] ${
        on ? "bg-wash font-medium text-ink" : "text-ink hover:bg-wash"
      }`}
    >
      <span className="font-mono text-[11px] text-gold">▤</span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="font-mono text-[10px] text-ink/40">{count}</span>
    </button>
  );
}

function Chip({
  children,
  on,
  onClick,
}: {
  children: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        on
          ? "shrink-0 rounded-full bg-pine px-2.5 py-1.5 text-[11.5px] font-medium text-cream"
          : "shrink-0 rounded-full border border-ink/15 px-2.5 py-1.5 text-[11.5px] text-ink"
      }
    >
      {children}
    </button>
  );
}

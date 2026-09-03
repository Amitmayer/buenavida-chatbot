"use client";

import { useMemo, useState } from "react";
import { es } from "@/lib/i18n/es";
import { EmptyState } from "@/components/empty-state";
import { BrandUploader } from "@/components/files/brand-uploader";
import { ChannelUploader } from "@/components/files/channel-uploader";
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
        <div className="flex flex-wrap items-center gap-3 px-4 py-5 md:px-7">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={es.files.search}
            className="h-[34px] w-full rounded-[9px] border border-ink/15 bg-sheet px-3 text-[12.5px] placeholder:text-ink/45 md:w-[220px]"
          />
          <span className="hidden flex-1 md:block" />
          {canUpload ? (
            selected?.kind === "marca" ? (
              <BrandUploader compact />
            ) : (
              <ChannelUploader chatIdSlug={selected?.id} />
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
              <article
                key={file.id}
                className="overflow-hidden rounded-[14px] border border-ink/10 bg-sheet hover:border-ink/25"
              >
                {file.url && file.mime_type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.url} alt={file.filename} className="h-[104px] w-full object-cover" />
                ) : (
                  <div className="flex h-[104px] items-center justify-center bg-[repeating-linear-gradient(135deg,#EDEBDF_0_8px,#E5E2D3_8px_16px)]">
                    <span className="font-mono text-[10px] tracking-[0.1em] text-ink/40">
                      {(file.mime_type.split("/")[1] ?? "FILE").toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="px-3.5 py-3">
                  {file.url ? (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-[12.5px] font-medium leading-snug text-ink"
                    >
                      {file.filename}
                    </a>
                  ) : (
                    <p className="text-[12.5px] font-medium leading-snug text-ink">{file.filename}</p>
                  )}
                  <p className="mt-1.5 font-mono text-[10px] text-ink/45">
                    {formatBytes(file.size_bytes)}
                  </p>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
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

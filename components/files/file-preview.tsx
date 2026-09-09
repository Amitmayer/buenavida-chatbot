"use client";

import { useEffect, useState } from "react";
import { es } from "@/lib/i18n/es";
import { Modal } from "@/components/ui/modal";
import { canPreviewFile } from "@/lib/files/preview";
import { captureError } from "@/lib/sentry";

export function FileOpenActions({
  url,
  filename,
  mimeType,
}: {
  url: string;
  filename: string;
  mimeType: string;
}) {
  const [open, setOpen] = useState(false);
  const previewable = canPreviewFile(mimeType);

  return (
    <span className="flex shrink-0 items-center gap-2.5">
      {previewable ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11px] font-medium text-pine"
        >
          {es.files.preview}
        </button>
      ) : null}
      <a
        href={url}
        download={filename}
        target="_blank"
        rel="noreferrer"
        className="text-[11px] font-medium text-pine"
      >
        {es.files.download}
      </a>
      {open ? (
        <FilePreview filename={filename} mimeType={mimeType} src={url} onClose={() => setOpen(false)} />
      ) : null}
    </span>
  );
}

export function FilePreview({
  filename,
  mimeType,
  src,
  onClose,
}: {
  filename: string;
  mimeType: string;
  src: string;
  onClose: () => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    void fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`preview ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const typed =
          blob.type && blob.type !== "application/octet-stream"
            ? blob
            : new Blob([blob], { type: mimeType });
        created = URL.createObjectURL(typed);
        if (cancelled) {
          URL.revokeObjectURL(created);
          return;
        }
        setObjectUrl(created);
      })
      .catch((error) => {
        captureError(error, { where: "files.preview" });
        if (cancelled) return;
        if (mimeType.startsWith("image/")) setObjectUrl(src);
        else setFailed(true);
      });

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [src, mimeType]);

  const image = mimeType.startsWith("image/");

  return (
    <Modal title={filename} onClose={onClose} size="xl">
      <div className="flex min-h-0 flex-1 flex-col">
        {objectUrl ? (
          <div className="mb-3 flex shrink-0 justify-end">
            <a href={objectUrl} download={filename} className="text-[13px] font-medium text-pine">
              {es.files.download}
            </a>
          </div>
        ) : null}
        {failed ? (
          <p className="text-[13px] text-ink/55">{es.files.previewFailed}</p>
        ) : !objectUrl ? (
          <p className="text-[13px] text-ink/45">{es.nav.loading}</p>
        ) : image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={objectUrl}
            alt={filename}
            className="mx-auto max-h-[70dvh] w-auto max-w-full object-contain"
          />
        ) : (
          <iframe
            src={objectUrl}
            title={filename}
            className="min-h-[70dvh] w-full flex-1 rounded-[8px] border border-line bg-white"
          />
        )}
      </div>
    </Modal>
  );
}

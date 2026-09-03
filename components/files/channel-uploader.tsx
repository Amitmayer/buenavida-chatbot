"use client";

import { useState } from "react";
import { es } from "@/lib/i18n/es";

export function ChannelUploader({
  chatIdSlug,
  chatId,
  compact,
}: {
  chatIdSlug?: string;
  chatId?: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");

  async function upload(file: File) {
    setStatus("uploading");
    const res = await fetch("/api/files/channel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: chatIdSlug,
        chatId,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      }),
    });
    if (!res.ok) {
      setStatus("error");
      return;
    }
    const { signedUrl, path } = (await res.json()) as { signedUrl: string; path: string };
    const put = await fetch(signedUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!put.ok) {
      setStatus("error");
      return;
    }
    const confirm = await fetch("/api/files/channel", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: chatIdSlug,
        chatId,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        path,
      }),
    });
    if (!confirm.ok) {
      setStatus("error");
      return;
    }
    setStatus("idle");
    window.location.reload();
  }

  const label = status === "uploading" ? es.files.uploading : es.files.upload;

  return (
    <label className="cursor-pointer">
      {compact ? (
        <span className="text-[11px] font-semibold text-pine">{label}</span>
      ) : (
        <span className="inline-block rounded-[9px] bg-pine px-3.5 py-2 text-[12px] font-medium text-cream">
          {label}
        </span>
      )}
      <input
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </label>
  );
}

"use client";

import { useState } from "react";
import { es } from "@/lib/i18n/es";

export function Dropzone({ taskId }: { taskId: string }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error" | "tooLarge">("idle");

  async function upload(file: File) {
    if (file.size > 26_214_400) {
      setStatus("tooLarge");
      return;
    }
    setStatus("uploading");
    const res = await fetch("/api/files/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
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
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!put.ok) {
      setStatus("error");
      return;
    }
    await fetch("/api/files/upload-url", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        path,
      }),
    });
    setStatus("idle");
    window.location.reload();
  }

  const label =
    status === "uploading"
      ? es.files.uploading
      : status === "tooLarge"
        ? es.files.tooLarge
        : status === "error"
          ? es.files.uploadFailed
          : es.tasks.addFile;

  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-2.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-dashed border-ink/20 text-[16px] font-semibold text-ink/40">
        +
      </span>
      <span className="text-[12.5px] font-medium leading-snug text-ink/60">{label}</span>
      <input
        type="file"
        accept="image/*,application/pdf,.xlsx,.xls,.doc,.docx,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </label>
  );
}

"use client";

import { useState } from "react";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";

export function BrandUploader({ compact }: { compact?: boolean }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");

  async function upload(file: File) {
    setStatus("uploading");
    const res = await fetch("/api/files/marca", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        folder: "general",
      }),
    });
    if (!res.ok) {
      setStatus("error");
      return;
    }
    const { signedUrl, path } = (await res.json()) as { signedUrl: string; path: string };
    const put = await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    if (!put.ok) {
      setStatus("error");
      return;
    }
    await fetch("/api/files/marca", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        folder: "general",
        path,
      }),
    });
    setStatus("idle");
    window.location.reload();
  }

  const label = status === "uploading" ? es.files.uploading : compact ? es.files.upload : es.files.drop;

  return (
    <label className="cursor-pointer">
      {compact ? (
        <>
          <span className="text-[11px] font-semibold text-pine md:hidden">{label}</span>
          <span className="hidden rounded-[9px] bg-pine px-3.5 py-2 text-[12px] font-medium text-cream md:inline-block">
            {label}
          </span>
        </>
      ) : (
        <Button type="button" variant="secondary">
          {label}
        </Button>
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

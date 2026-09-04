"use client";

import { es } from "@/lib/i18n/es";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="es">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#F4F0E4] px-6 text-[#1A1A1A]">
        <p className="text-[16px] font-medium">{es.crash.title}</p>
        <button
          type="button"
          className="rounded-md bg-[#12281C] px-4 py-2 text-[14px] text-[#F4F0E4]"
          onClick={() => reset()}
        >
          {es.crash.retry}
        </button>
      </body>
    </html>
  );
}

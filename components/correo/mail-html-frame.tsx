"use client";

import { es } from "@/lib/i18n/es";

export function MailHtmlFrame({ html }: { html: string }) {
  return (
    <iframe
      title={es.correo.body}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      srcDoc={html}
      className="h-[70vh] min-h-[240px] w-full border-0 bg-sheet"
    />
  );
}

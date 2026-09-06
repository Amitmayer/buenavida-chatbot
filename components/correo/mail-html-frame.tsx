"use client";

import { useCallback, useState } from "react";
import { es } from "@/lib/i18n/es";

export function MailHtmlFrame({ html }: { html: string }) {
  const [height, setHeight] = useState(240);

  const fit = useCallback((frame: HTMLIFrameElement | null) => {
    if (!frame) return;
    const doc = frame.contentDocument;
    if (!doc) return;
    const next = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0, 160);
    setHeight(next);
  }, []);

  return (
    <iframe
      title={es.correo.body}
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      srcDoc={html}
      onLoad={(event) => fit(event.currentTarget)}
      ref={fit}
      style={{ height }}
      className="w-full border-0 bg-sheet"
    />
  );
}

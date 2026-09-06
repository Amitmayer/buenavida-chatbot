"use client";

import { useCallback, useState } from "react";
import { es } from "@/lib/i18n/es";

export function MailHtmlFrame({ html }: { html: string }) {
  const [height, setHeight] = useState(320);

  const fit = useCallback((frame: HTMLIFrameElement | null) => {
    if (!frame) return;
    const measure = () => {
      const doc = frame.contentDocument;
      const root = doc?.documentElement;
      const body = doc?.body;
      const next = Math.max(root?.scrollHeight ?? 0, body?.scrollHeight ?? 0, 160);
      if (next > 160) setHeight(next);
    };
    measure();
    requestAnimationFrame(measure);
  }, []);

  return (
    <iframe
      title={es.correo.body}
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      srcDoc={html}
      onLoad={(event) => fit(event.currentTarget)}
      style={{ height }}
      className="w-full min-h-[160px] border-0 bg-sheet"
    />
  );
}

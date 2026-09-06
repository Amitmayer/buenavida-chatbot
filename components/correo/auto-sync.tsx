"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { syncMailAction } from "@/app/(app)/correo/actions";
import { es } from "@/lib/i18n/es";

const WATCH_MS = 30_000;

export function AutoSync({ run, live = false }: { run: boolean; live?: boolean }) {
  const started = useRef(false);
  const busyWatch = useRef(false);
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!run || started.current) return;
    started.current = true;
    setBusy(true);
    void (async () => {
      await syncMailAction();
      setBusy(false);
      const next = new URLSearchParams(params.toString());
      if (next.has("ok")) {
        next.delete("ok");
        const qs = next.toString();
        router.replace(qs ? `${path}?${qs}` : path);
        return;
      }
      router.refresh();
    })();
  }, [run, path, params, router]);

  useEffect(() => {
    if (!live) return;

    async function pull() {
      if (document.visibilityState !== "visible" || busyWatch.current) return;
      busyWatch.current = true;
      try {
        const result = await syncMailAction({ watch: true });
        if (result.ok && result.inserted > 0) router.refresh();
      } finally {
        busyWatch.current = false;
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") void pull();
    }

    const timer = window.setInterval(() => void pull(), WATCH_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [live, router]);

  if (!busy) return null;
  return (
    <p className="border-b border-ink/[0.06] px-4 py-2 text-[11px] text-ink/50">{es.correo.syncing}</p>
  );
}

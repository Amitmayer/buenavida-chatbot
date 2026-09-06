"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

const KEY = "bv-mail-list-scroll";

export function MailListScroll({
  children,
  resetKey,
}: {
  children: ReactNode;
  resetKey: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prev = sessionStorage.getItem(`${KEY}-k`);
    if (prev === resetKey) {
      el.scrollTop = Number(sessionStorage.getItem(KEY) ?? 0);
    } else {
      sessionStorage.setItem(`${KEY}-k`, resetKey);
      sessionStorage.setItem(KEY, "0");
      el.scrollTop = 0;
    }
    function onScroll() {
      const pane = ref.current;
      if (!pane) return;
      sessionStorage.setItem(KEY, String(pane.scrollTop));
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [resetKey]);

  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-auto">
      {children}
    </div>
  );
}

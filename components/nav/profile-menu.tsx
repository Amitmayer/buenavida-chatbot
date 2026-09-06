"use client";

import { useEffect, useRef, useState } from "react";
import { es } from "@/lib/i18n/es";
import { initials } from "@/lib/utils";
import { PushOptIn } from "@/components/pwa/push-opt-in";

export function ProfileMenu({ name, roleLabel }: { name: string; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-3 rounded-[14px] bg-cream/[0.08] px-3.5 py-3.5 text-left hover:bg-cream/[0.12]"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-gold font-mono text-[17px] font-semibold text-pine">
          {initials(name)}
        </span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[16px] font-medium text-cream">{shortFirst(name)}</div>
          <div className="truncate font-mono text-[13px] text-cream/70">{roleLabel}</div>
        </div>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-[calc(100%+8px)] left-0 right-0 overflow-hidden rounded-[10px] border border-cream/10 bg-[#1B3A28] py-1.5 shadow-lg"
        >
          <div className="px-3 py-1.5">
            <PushOptIn />
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-3 py-1.5 text-left text-[12.5px] text-cream/80 hover:bg-cream/10 hover:text-cream"
            >
              {es.nav.salir}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function shortFirst(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length <= 1) return name;
  return `${parts[0]} ${parts[parts.length - 1]?.slice(0, 1)}.`;
}

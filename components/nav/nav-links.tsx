"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<string, string> = {
  "/hoy": "◗",
  "/canales": "#",
  "/mensajes": "◫",
  "/chat": "✳",
  "/tareas": "☰",
  "/archivos": "▤",
  "/equipo": "⌂",
};

export function NavLinks({
  items,
  variant,
}: {
  items: readonly { href: string; label: string }[];
  variant: "side" | "tab";
}) {
  const path = usePathname();
  function active(href: string) {
    return path === href || path.startsWith(`${href}/`);
  }

  if (variant === "side") {
    return (
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const on = active(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch={false}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-[9px] px-2.5 py-[9px] text-[13.5px]",
                  on ? "text-cream" : "text-cream/78 hover:bg-cream/[0.07] hover:text-cream",
                )}
              >
                {on ? (
                  <span className="absolute inset-0 rounded-[9px] bg-cream/[0.11] shadow-[inset_2px_0_0_#C79350]" />
                ) : null}
                <span
                  className={cn(
                    "relative w-4 text-center font-mono text-[11px]",
                    on ? "text-gold" : "text-cream/45",
                  )}
                >
                  {ICONS[item.href] ?? "·"}
                </span>
                <span className="relative">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="flex">
      {items.map((item) => {
        const on = active(item.href);
        return (
          <li key={item.href} className="min-w-0 flex-1">
            <Link
              href={item.href}
              prefetch={false}
              className={cn(
                "block border-t-2 px-1 pb-1.5 pt-2.5 text-center text-[11px]",
                on
                  ? "border-gold font-semibold text-pine"
                  : "border-transparent font-medium text-ink/55",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

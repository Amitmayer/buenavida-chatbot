"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebarUi } from "@/components/nav/sidebar-ui";
import { cn } from "@/lib/utils";

export function NavLinks({
  items,
  variant,
  badges,
}: {
  items: readonly { href: string; label: string }[];
  variant: "side" | "tab";
  badges?: Record<string, number>;
}) {
  const path = usePathname();
  const { show, hide } = useSidebarUi();
  function active(href: string) {
    return path === href || path.startsWith(`${href}/`);
  }

  if (variant === "side") {
    return (
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const on = active(item.href);
          const badge = badges?.[item.href] ?? 0;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => {
                  if (item.href === "/hoy") show();
                  else hide();
                }}
                className={cn(
                  "flex h-11 items-center gap-3.5 rounded-[12px] px-3.5",
                  on ? "bg-cream text-pine" : "text-cream/90 hover:bg-cream/[0.09]",
                )}
              >
                <span
                  className={cn(
                    "h-4 w-4 shrink-0 rounded-[4px] border-[2.5px]",
                    item.href === "/chat" ? "rounded-[9px]" : "rounded-[4px]",
                    on ? "border-pine" : "border-cream/60",
                  )}
                />
                <span className={cn("flex-1 text-[16px] md:text-[18px]", on ? "font-semibold" : "font-normal")}>
                  {item.label}
                </span>
                {badge > 0 ? (
                  <span className="flex min-w-7 items-center justify-center rounded-[9px] bg-overdue px-2 font-mono text-[13px] text-white">
                    {badge}
                  </span>
                ) : null}
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
              className={cn(
                "relative block border-t-2 px-1 pb-1.5 pt-2.5 text-center text-[11px]",
                on
                  ? "border-gold font-semibold text-ink"
                  : "border-transparent font-medium text-ink/55",
              )}
            >
              {item.label}
              {(badges?.[item.href] ?? 0) > 0 ? (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-overdue" />
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

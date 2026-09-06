"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

export const modalCloseClassName =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-ink/45 hover:bg-wash hover:text-ink";

export function ModalCloseIcon() {
  return <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />;
}

export function ModalClose({ onClose, className }: { onClose: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={es.tasks.close}
      className={cn(modalCloseClassName, className)}
    >
      <ModalCloseIcon />
    </button>
  );
}

export function Modal({
  title,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "xl";
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        aria-hidden
        className="absolute inset-0 bg-pine/40 backdrop-blur-[8px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative w-full overflow-auto rounded-lg border border-line bg-sheet shadow-lg",
          size === "xl"
            ? "max-h-[92dvh] max-w-[800px] p-6 md:p-7"
            : "max-h-[90dvh] max-w-md p-5",
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            className={cn(
              "min-w-0 font-semibold text-ink",
              size === "xl" ? "text-[18px] md:text-[22px]" : "text-[15px]",
            )}
          >
            {title}
          </h2>
          <ModalClose onClose={onClose} />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

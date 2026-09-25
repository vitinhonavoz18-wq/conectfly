"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Drawer({
  open,
  onClose,
  title,
  side = "right",
  widthClass = "w-full max-w-md",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "right" | "left" | "bottom";
  widthClass?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={cn("fixed inset-0 z-70", open ? "visible" : "invisible pointer-events-none")}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/70 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute flex flex-col border-ink-700 bg-ink-900 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          side === "right" && cn("inset-y-0 right-0 border-l", widthClass, open ? "translate-x-0" : "translate-x-full"),
          side === "left" && cn("inset-y-0 left-0 border-r", widthClass, open ? "translate-x-0" : "-translate-x-full"),
          side === "bottom" &&
            cn("inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl border-t", open ? "translate-y-0" : "translate-y-full"),
        )}
      >
        <header className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-smoke-300 transition-colors hover:bg-white/5 hover:text-neon-400"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>

        {footer ? <div className="border-t border-ink-700 bg-ink-850 px-5 py-4">{footer}</div> : null}
      </aside>
    </div>
  );
}

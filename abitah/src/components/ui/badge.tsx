import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neon" | "dark" | "outline" | "danger" | "muted";

const tones: Record<Tone, string> = {
  neon: "bg-neon-500 text-[#031006]",
  dark: "border border-white/12 bg-ink-950/85 text-smoke-100 backdrop-blur-sm",
  outline: "border border-neon-500/45 text-neon-400",
  danger: "bg-red-500 text-white",
  muted: "bg-ink-700 text-smoke-300",
};

export function Badge({
  tone = "neon",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.12em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

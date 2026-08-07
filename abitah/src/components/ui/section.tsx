import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  tone = "black",
  className,
  children,
  id,
}: {
  tone?: "black" | "graphite" | "gradient";
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "py-16 sm:py-20 lg:py-26",
        tone === "black" && "bg-ink-950",
        tone === "graphite" && "bg-ink-900",
        tone === "gradient" && "bg-gradient-to-b from-ink-950 via-ink-900 to-ink-950",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={cn(
        "mb-10 flex flex-col gap-5 sm:mb-14 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "sm:flex-col sm:items-center sm:text-center",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "flex flex-col items-center")}>
        {eyebrow ? (
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-neon-500">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="section-rule font-display text-3xl font-bold uppercase leading-[0.98] tracking-wide text-smoke-100 sm:text-4xl lg:text-[2.9rem]">
          {title}
        </h2>
        {description ? (
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-smoke-400">{description}</p>
        ) : null}
      </div>

      {action ? (
        <Link
          href={action.href}
          className="group inline-flex shrink-0 items-center gap-2 border-b border-white/12 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-smoke-200 transition-colors hover:border-neon-500 hover:text-neon-400"
        >
          {action.label}
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      ) : null}
    </div>
  );
}

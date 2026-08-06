import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
        "py-14 sm:py-18 lg:py-22",
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
        "mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "sm:flex-col sm:items-center sm:text-center",
        className,
      )}
    >
      <div className={cn(align === "center" && "flex flex-col items-center")}>
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-neon-500">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="section-rule text-2xl font-extrabold uppercase leading-tight text-white sm:text-3xl lg:text-[2.1rem]">
          {title}
        </h2>
        {description ? (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-smoke-300">{description}</p>
        ) : null}
      </div>

      {action ? (
        <Link
          href={action.href}
          className="group inline-flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-smoke-200 transition-colors hover:text-neon-400"
        >
          {action.label}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      ) : null}
    </div>
  );
}

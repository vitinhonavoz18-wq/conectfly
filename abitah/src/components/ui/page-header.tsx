import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs = [],
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-white/7 bg-ink-900">
      <div className="container-page py-10 lg:py-14">
        {breadcrumbs.length ? (
          <nav aria-label="Trilha de navegação" className="mb-5">
            <ol className="flex flex-wrap items-center gap-1 text-[11px] text-smoke-400">
              <li>
                <Link href="/" className="hover:text-neon-400">
                  Início
                </Link>
              </li>
              {breadcrumbs.map((crumb) => (
                <li key={crumb.label} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" aria-hidden />
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-neon-400">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-smoke-200">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        {eyebrow ? (
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-neon-500">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="font-display text-4xl font-bold uppercase leading-[0.98] tracking-wide text-smoke-100 sm:text-5xl lg:text-[3.6rem]">
          {title}
        </h1>

        {description ? (
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-smoke-400">{description}</p>
        ) : null}

        {children}
      </div>
    </header>
  );
}

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function buildHref(base: string, params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  if (page > 1) search.set("pagina", String(page));
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export function Pagination({
  base = "/loja",
  params,
  page,
  totalPages,
}: {
  base?: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (item) => item === 1 || item === totalPages || Math.abs(item - page) <= 1,
  );

  return (
    <nav aria-label="Paginação" className="mt-10 flex items-center justify-center gap-1.5">
      <Link
        href={buildHref(base, params, Math.max(1, page - 1))}
        aria-label="Página anterior"
        aria-disabled={page === 1}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg border border-ink-600 text-smoke-300 transition-colors hover:border-neon-500 hover:text-neon-400",
          page === 1 && "pointer-events-none opacity-40",
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>

      {pages.map((item, index) => (
        <span key={item} className="flex items-center gap-1.5">
          {index > 0 && item - pages[index - 1] > 1 ? (
            <span className="px-1 text-smoke-400">…</span>
          ) : null}
          <Link
            href={buildHref(base, params, item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              "flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-bold transition-colors",
              item === page
                ? "border-neon-500 bg-neon-500 text-ink-950"
                : "border-ink-600 text-smoke-300 hover:border-neon-500 hover:text-neon-400",
            )}
          >
            {item}
          </Link>
        </span>
      ))}

      <Link
        href={buildHref(base, params, Math.min(totalPages, page + 1))}
        aria-label="Próxima página"
        aria-disabled={page === totalPages}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg border border-ink-600 text-smoke-300 transition-colors hover:border-neon-500 hover:text-neon-400",
          page === totalPages && "pointer-events-none opacity-40",
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </nav>
  );
}

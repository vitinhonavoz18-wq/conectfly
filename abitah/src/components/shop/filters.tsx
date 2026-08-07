"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox, Label } from "@/components/ui/field";
import { cn, formatCurrency } from "@/lib/utils";
import type { Category, ProductSort } from "@/types/catalog";

export type Facets = {
  sizes: string[];
  colors: { name: string; hex: string }[];
  minPrice: number;
  maxPrice: number;
};

const sortOptions: { value: ProductSort; label: string }[] = [
  { value: "relevancia", label: "Mais relevantes" },
  { value: "novidades", label: "Novidades" },
  { value: "mais-vendidos", label: "Mais vendidos" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
];

function useFilterParams() {
  const router = useRouter();
  const params = useSearchParams();

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      });
      next.delete("pagina");
      const query = next.toString();
      router.push(query ? `/loja?${query}` : "/loja", { scroll: false });
    },
    [params, router],
  );

  const toggleInList = useCallback(
    (key: string, value: string) => {
      const current = (params.get(key) ?? "").split(",").filter(Boolean);
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      setParam({ [key]: next.join(",") });
    },
    [params, setParam],
  );

  return { params, setParam, toggleInList, router };
}

function FiltersBody({ categories, facets }: { categories: Category[]; facets: Facets }) {
  const { params, setParam, toggleInList } = useFilterParams();

  const activeCategory = params.get("categoria") ?? "";
  const activeGroup = params.get("grupo") ?? "";
  const activeSizes = (params.get("tamanho") ?? "").split(",").filter(Boolean);
  const activeColors = (params.get("cor") ?? "").split(",").filter(Boolean);
  const activeMax = Number(params.get("max") ?? facets.maxPrice);
  const onlyAvailable = params.get("disponivel") === "1";

  const priceRanges = useMemo(() => {
    const step = Math.max(50, Math.ceil(facets.maxPrice / 4 / 10) * 10);
    return [step, step * 2, step * 3, facets.maxPrice];
  }, [facets.maxPrice]);

  return (
    <div className="space-y-7">
      <section>
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white">Linha</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "", label: "Todas" },
            { value: "roupas", label: "Roupas" },
            { value: "acessorios", label: "Acessórios" },
          ].map((option) => (
            <button
              key={option.value || "todas"}
              type="button"
              onClick={() => setParam({ grupo: option.value || null, categoria: null })}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                activeGroup === option.value
                  ? "border-neon-500 bg-neon-500/10 text-neon-400"
                  : "border-ink-600 text-smoke-300 hover:border-smoke-400",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
          Categoria
        </h3>
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              onClick={() => setParam({ categoria: null })}
              className={cn(
                "w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                !activeCategory ? "bg-white/5 text-neon-400" : "text-smoke-300 hover:text-white",
              )}
            >
              Todas as categorias
            </button>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => setParam({ categoria: category.slug, grupo: null })}
                className={cn(
                  "w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  activeCategory === category.slug
                    ? "bg-white/5 text-neon-400"
                    : "text-smoke-300 hover:text-white",
                )}
              >
                {category.name}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
          Tamanho
        </h3>
        <div className="flex flex-wrap gap-2">
          {facets.sizes.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => toggleInList("tamanho", size)}
              aria-pressed={activeSizes.includes(size)}
              className={cn(
                "min-w-12 rounded-lg border px-3 py-2 text-xs font-bold uppercase transition-colors",
                activeSizes.includes(size)
                  ? "border-neon-500 bg-neon-500 text-ink-950"
                  : "border-ink-600 text-smoke-300 hover:border-neon-500 hover:text-neon-400",
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white">Cor</h3>
        <ul className="space-y-2">
          {facets.colors.map((color) => (
            <li key={color.name}>
              <button
                type="button"
                onClick={() => toggleInList("cor", color.name)}
                aria-pressed={activeColors.includes(color.name)}
                className="flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 text-left text-sm text-smoke-300 transition-colors hover:text-white"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
                    activeColors.includes(color.name) ? "border-neon-500" : "border-ink-600",
                  )}
                >
                  <span
                    className="h-4 w-4 rounded-full ring-1 ring-white/10"
                    style={{ backgroundColor: color.hex }}
                  />
                </span>
                {color.name}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
          Faixa de preço
        </h3>
        <div className="space-y-2">
          {priceRanges.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setParam({ max: value === facets.maxPrice ? null : String(value) })}
              className={cn(
                "block w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                activeMax === value ? "bg-white/5 text-neon-400" : "text-smoke-300 hover:text-white",
              )}
            >
              Até {formatCurrency(value)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2.5">
          <Checkbox
            id="filtro-disponivel"
            checked={onlyAvailable}
            onChange={(event) => setParam({ disponivel: event.target.checked ? "1" : null })}
          />
          <Label htmlFor="filtro-disponivel" className="mb-0 normal-case tracking-normal">
            Somente disponíveis
          </Label>
        </div>
      </section>
    </div>
  );
}

export function ShopToolbar({
  categories,
  facets,
  total,
}: {
  categories: Category[];
  facets: Facets;
  total: number;
}) {
  const { params, setParam, router } = useFilterParams();
  const [open, setOpen] = useState(false);
  const sort = (params.get("ordenar") as ProductSort) ?? "relevancia";

  const activeChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];
    const search = params.get("busca");
    if (search) chips.push({ label: `Busca: ${search}`, onRemove: () => setParam({ busca: null }) });

    const categorySlug = params.get("categoria");
    if (categorySlug) {
      const name = categories.find((c) => c.slug === categorySlug)?.name ?? categorySlug;
      chips.push({ label: name, onRemove: () => setParam({ categoria: null }) });
    }

    const group = params.get("grupo");
    if (group)
      chips.push({
        label: group === "roupas" ? "Roupas" : "Acessórios",
        onRemove: () => setParam({ grupo: null }),
      });

    (params.get("tamanho") ?? "")
      .split(",")
      .filter(Boolean)
      .forEach((size) =>
        chips.push({
          label: `Tam. ${size}`,
          onRemove: () => {
            const next = (params.get("tamanho") ?? "")
              .split(",")
              .filter((item) => item && item !== size);
            setParam({ tamanho: next.join(",") });
          },
        }),
      );

    (params.get("cor") ?? "")
      .split(",")
      .filter(Boolean)
      .forEach((color) =>
        chips.push({
          label: color,
          onRemove: () => {
            const next = (params.get("cor") ?? "")
              .split(",")
              .filter((item) => item && item !== color);
            setParam({ cor: next.join(",") });
          },
        }),
      );

    const max = params.get("max");
    if (max)
      chips.push({
        label: `Até ${formatCurrency(Number(max))}`,
        onRemove: () => setParam({ max: null }),
      });

    if (params.get("disponivel") === "1")
      chips.push({ label: "Disponíveis", onRemove: () => setParam({ disponivel: null }) });

    return chips;
  }, [params, categories, setParam]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 pb-4">
        <p className="text-xs text-smoke-400">
          <strong className="text-white">{total}</strong> {total === 1 ? "produto" : "produtos"}
          {activeChips.length ? " com os filtros aplicados" : ""}
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="lg:hidden"
            aria-label="Abrir filtros"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filtros
            {activeChips.length ? (
              <span className="ml-1 rounded-full bg-neon-500 px-1.5 text-[10px] text-ink-950">
                {activeChips.length}
              </span>
            ) : null}
          </Button>

          <label htmlFor="ordenar" className="sr-only">
            Ordenar por
          </label>
          <select
            id="ordenar"
            value={sort}
            onChange={(event) => setParam({ ordenar: event.target.value })}
            className="h-9 rounded-lg border border-ink-600 bg-ink-900 px-3 text-xs font-semibold text-smoke-200 focus:border-neon-500 focus:outline-none"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeChips.length ? (
        <ul className="flex flex-wrap gap-2 pt-4">
          {activeChips.map((chip, index) => (
            <li key={`${chip.label}-${index}`}>
              <button
                type="button"
                onClick={chip.onRemove}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-850 px-3 py-1.5 text-[11px] font-semibold text-smoke-200 transition-colors hover:border-neon-500 hover:text-neon-400"
              >
                {chip.label}
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => router.push("/loja", { scroll: false })}
              className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neon-400 hover:underline"
            >
              Limpar tudo
            </button>
          </li>
        </ul>
      ) : null}

      <Drawer open={open} onClose={() => setOpen(false)} title="Filtros" side="left">
        <FiltersBody categories={categories} facets={facets} />
        <Button fullWidth size="lg" className="mt-8" onClick={() => setOpen(false)}>
          Ver {total} {total === 1 ? "produto" : "produtos"}
        </Button>
      </Drawer>
    </>
  );
}

export function ShopSidebar({ categories, facets }: { categories: Category[]; facets: Facets }) {
  return (
    <aside aria-label="Filtros" className="hidden lg:block">
      <div className="sticky top-24 rounded-card border border-ink-700 bg-ink-900 p-5">
        <FiltersBody categories={categories} facets={facets} />
      </div>
    </aside>
  );
}

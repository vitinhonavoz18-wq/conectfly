import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ProductGrid } from "@/components/product/product-grid";
import { Pagination } from "@/components/shop/pagination";
import { ShopSidebar, ShopToolbar } from "@/components/shop/filters";
import { getCategories, getFacets, listProducts } from "@/services/catalog";
import type { ProductGroup, ProductSort } from "@/types/catalog";

export const metadata: Metadata = {
  title: "Loja",
  description:
    "Catálogo completo ABITAH: camisetas, regatas, shorts, leggings, moletons, bonés, garrafas, mochilas e acessórios esportivos.",
  alternates: { canonical: "/loja" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;

  const busca = first(raw.busca);
  const categoria = first(raw.categoria);
  const grupo = first(raw.grupo) as ProductGroup | undefined;
  const tamanho = first(raw.tamanho);
  const cor = first(raw.cor);
  const min = first(raw.min);
  const max = first(raw.max);
  const disponivel = first(raw.disponivel);
  const ordenar = (first(raw.ordenar) as ProductSort | undefined) ?? "relevancia";
  const pagina = Number(first(raw.pagina) ?? 1);

  const [categories, facets, result] = await Promise.all([
    getCategories(),
    getFacets(),
    listProducts({
      search: busca,
      categorySlug: categoria,
      group: grupo,
      sizes: tamanho?.split(",").filter(Boolean),
      colors: cor?.split(",").filter(Boolean),
      minPrice: min ? Number(min) : undefined,
      maxPrice: max ? Number(max) : undefined,
      onlyAvailable: disponivel === "1",
      sort: ordenar,
      page: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
      perPage: 12,
    }),
  ]);

  const activeCategory = categories.find((category) => category.slug === categoria);
  const title = activeCategory
    ? activeCategory.name
    : grupo === "roupas"
      ? "Roupas"
      : grupo === "acessorios"
        ? "Acessórios"
        : busca
          ? `Resultados para “${busca}”`
          : "Loja completa";

  return (
    <>
      <PageHeader
        eyebrow="Coleção oficial"
        title={title}
        description={
          activeCategory?.description ??
          "Filtre por categoria, tamanho, cor, preço e disponibilidade para encontrar a peça certa para o seu treino."
        }
        breadcrumbs={[{ label: "Loja", href: "/loja" }, ...(activeCategory ? [{ label: activeCategory.name }] : [])]}
      />

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[268px_1fr] lg:py-14">
        <Suspense fallback={<div className="hidden lg:block" />}>
          <ShopSidebar categories={categories} facets={facets} />
        </Suspense>

        <div>
          <Suspense fallback={<div className="h-12" />}>
            <ShopToolbar categories={categories} facets={facets} total={result.total} />
          </Suspense>

          <div className="pt-6">
            <ProductGrid
              products={result.items}
              columnsClass="grid-cols-2 xl:grid-cols-3"
              priorityCount={3}
              emptyMessage="Nenhum produto encontrado. Tente remover alguns filtros ou refazer a busca."
            />
          </div>

          <Pagination
            params={{
              busca,
              categoria,
              grupo,
              tamanho,
              cor,
              min,
              max,
              disponivel,
              ordenar: ordenar === "relevancia" ? undefined : ordenar,
            }}
            page={result.page}
            totalPages={result.totalPages}
          />
        </div>
      </div>
    </>
  );
}

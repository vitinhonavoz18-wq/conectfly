import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ProductGrid } from "@/components/product/product-grid";
import { Pagination } from "@/components/shop/pagination";
import { listProducts } from "@/services/catalog";

export const metadata: Metadata = {
  title: "Lançamentos",
  description:
    "Confira os últimos lançamentos da coleção oficial ABITAH: novas camisetas, regatas, shorts, leggings e acessórios.",
  alternates: { canonical: "/lancamentos" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LaunchesPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const paginaParam = Array.isArray(raw.pagina) ? raw.pagina[0] : raw.pagina;
  const page = Math.max(1, Number(paginaParam ?? 1) || 1);

  const result = await listProducts({ onlyNew: true, sort: "novidades", page, perPage: 12 });

  return (
    <>
      <PageHeader
        eyebrow="Recém-chegados"
        title="Últimos lançamentos"
        description="As peças mais novas do desenvolvimento ABITAH — testadas dentro da academia antes de chegar até você."
        breadcrumbs={[{ label: "Lançamentos" }]}
      />

      <div className="container-page py-10 lg:py-14">
        <p className="mb-6 text-xs text-smoke-400">
          <strong className="text-white">{result.total}</strong>{" "}
          {result.total === 1 ? "lançamento" : "lançamentos"} disponíveis
        </p>

        <ProductGrid
          products={result.items}
          priorityCount={4}
          emptyMessage="Nenhum lançamento cadastrado no momento. Volte em breve."
        />

        <Pagination
          base="/lancamentos"
          params={{}}
          page={result.page}
          totalPages={result.totalPages}
        />
      </div>
    </>
  );
}

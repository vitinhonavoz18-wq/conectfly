import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { SiteMenuItemCard } from "./SiteMenuItemCard";
import { buscarNoCardapio, MINIMO_PARA_BUSCAR } from "@/lib/site/buscaNoCardapio";
import { classesDaGrade, type ConfigDeLayout } from "@/lib/site/menuLayout";
import type { MenuCategoryRow, MenuItemRow, RestaurantRow } from "@/lib/site/types";

/**
 * A busca do cardápio.
 *
 * Só aparece nos layouts que pedem por ela. Numa pizzaria de doze sabores uma
 * barra de busca só ocupa espaço; numa farmácia ela é a porta de entrada —
 * ninguém rola a tela procurando "Dipirona 500mg" no meio de oitocentos
 * itens.
 *
 * Enquanto ninguém digita nada, ela não esconde o cardápio: o resto da página
 * continua embaixo, do jeito que estava.
 */
export function MenuBusca({
  categorias,
  restaurant,
  layout,
  adicionaisCategory,
}: {
  categorias: (MenuCategoryRow & { items: MenuItemRow[] })[];
  restaurant: RestaurantRow;
  layout: ConfigDeLayout;
  adicionaisCategory?: MenuCategoryRow & { items: MenuItemRow[] };
}) {
  const [termo, setTermo] = useState("");
  const resultados = useMemo(() => buscarNoCardapio(categorias, termo), [categorias, termo]);
  const buscando = termo.trim().length >= MINIMO_PARA_BUSCAR;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-4" aria-label="Buscar no cardápio">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[hsl(var(--site-muted-fg))]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar produto…"
          aria-label="Buscar produto no cardápio"
          // h-14: alvo grande o bastante para o polegar no celular. Campo de
          // busca pequeno é campo de busca que ninguém usa.
          className="h-14 w-full rounded-2xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] pl-12 pr-12 text-base text-[hsl(var(--site-fg))] outline-none transition-colors placeholder:text-[hsl(var(--site-muted-fg))] focus:border-[hsl(var(--site-primary))]"
        />
        {termo && (
          <button
            type="button"
            onClick={() => setTermo("")}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-[hsl(var(--site-muted-fg))] transition-colors hover:text-[hsl(var(--site-fg))]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {buscando && (
        <div className="mt-4">
          <p className="mb-3 text-sm text-[hsl(var(--site-muted-fg))]" role="status">
            {resultados.length === 0
              ? `Nada encontrado para "${termo}".`
              : `${resultados.length} ${resultados.length === 1 ? "resultado" : "resultados"} para "${termo}"`}
          </p>

          {resultados.length > 0 && (
            <div className={`grid gap-3 ${classesDaGrade(layout)}`}>
              {resultados.map(({ item, categoria }) => (
                <div key={item.id}>
                  <p className="mb-1 truncate text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--site-muted-fg))]">
                    {categoria.name}
                  </p>
                  <SiteMenuItemCard
                    item={item}
                    restaurant={restaurant}
                    adicionaisCategory={adicionaisCategory}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

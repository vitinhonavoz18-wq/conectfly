import { Flame } from "lucide-react";
import { SiteMenuItemCard } from "./SiteMenuItemCard";
import { destaquesDoCardapio } from "@/lib/site/buscaNoCardapio";
import { classesDaGrade, type ConfigDeLayout } from "@/lib/site/menuLayout";
import type { MenuCategoryRow, MenuItemRow, RestaurantRow } from "@/lib/site/types";

/**
 * Os produtos que a loja escolheu destacar.
 *
 * NÃO é um ranking de vendas. O cardápio não guarda quantas vezes cada item
 * foi pedido, então "os 5 mais vendidos" seria número inventado. O que existe
 * de verdade é a marcação de destaque que o dono faz no painel — e é isso que
 * este bloco mostra, com esse nome.
 *
 * Some por inteiro quando não há nada marcado. Um bloco "Destaques" com seis
 * produtos escolhidos ao acaso é pior do que bloco nenhum.
 */
export function MenuDestaques({
  categorias,
  restaurant,
  layout,
  adicionaisCategory,
  titulo = "Destaques da casa",
}: {
  categorias: (MenuCategoryRow & { items: MenuItemRow[] })[];
  restaurant: RestaurantRow;
  layout: ConfigDeLayout;
  adicionaisCategory?: MenuCategoryRow & { items: MenuItemRow[] };
  titulo?: string;
}) {
  const itens = destaquesDoCardapio(categorias);
  if (itens.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-5" aria-labelledby="destaques-titulo">
      <h2
        id="destaques-titulo"
        className="mb-3 flex items-center gap-2 text-lg font-black uppercase tracking-tight sm:text-xl"
      >
        <Flame className="h-5 w-5 text-[hsl(var(--site-primary))]" aria-hidden="true" />
        {titulo}
      </h2>
      <div className={`grid gap-3 ${classesDaGrade(layout)}`}>
        {itens.map((item) => (
          <SiteMenuItemCard
            key={item.id}
            item={item}
            restaurant={restaurant}
            adicionaisCategory={adicionaisCategory}
          />
        ))}
      </div>
    </section>
  );
}

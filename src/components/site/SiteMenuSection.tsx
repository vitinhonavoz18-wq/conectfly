import { useMemo, useState } from "react";
import { ImageIcon, ArrowLeft } from "lucide-react";
import type { MenuCategoryRow, MenuItemRow, RestaurantRow, BeverageRow, BeverageCatalogRow } from "@/lib/site/types";
import { SiteMenuItemCard } from "./SiteMenuItemCard";
import { SitePizzaBuilder } from "./SitePizzaBuilder";
import { SiteBeverageSection } from "./SiteBeverageSection";
import { dividirTitulo, resolverTextos } from "@/lib/site/menuTexts";
import {
  MODO_PADRAO_GLOBAL,
  normalizarModoDeNavegacao,
  type ModoDeNavegacao,
} from "@/lib/site/menuBehavior";


interface Props {
  categories: (MenuCategoryRow & { items: MenuItemRow[] })[];
  restaurant: RestaurantRow;
  /**
   * O modo já resolvido por quem chama (`resolverModoDeNavegacao`). Chega
   * pronto de propósito: quem monta a página é que sabe o layout do segmento,
   * e um componente de vitrine não deve estar decidindo regra de negócio.
   */
  entryMode?: ModoDeNavegacao;
  adicionaisCategory?: MenuCategoryRow & { items: MenuItemRow[] };
  beverages?: BeverageRow[];
  beverageCatalogs?: BeverageCatalogRow[];
}

/**
 * O cardápio, em UM dos três modos de navegação.
 *
 * A REGRA MAIS IMPORTANTE DESTE ARQUIVO
 *
 * Os três modos são exclusivos: só o modo ativo é montado. Nada de montar os
 * três e esconder dois com CSS — seria como imprimir três cardápios diferentes
 * e entregar os três ao cliente pedindo que ignore dois.
 *
 * - `cards`      → cards grandes de categoria; produto só depois do clique.
 * - `navigation` → grade de categorias; escolhe uma e troca pela barra.
 * - `direct`     → tudo numa rolagem só, categoria após categoria.
 */
export function SiteMenuSection({ categories, restaurant, entryMode = MODO_PADRAO_GLOBAL, adicionaisCategory, beverages, beverageCatalogs }: Props) {
  // Os textos institucionais do cardápio. Vêm das configurações desta loja;
  // se ela nunca personalizou, `resolverTextos` devolve exatamente as frases
  // que já estavam no ar — nenhum cardápio existente muda sozinho.
  const textos = useMemo(
    () => resolverTextos(restaurant.site_settings),
    [restaurant.site_settings],
  );
  const tituloDoCardapio = useMemo(() => dividirTitulo(textos.menu_title), [textos.menu_title]);

  const [active, setActive] = useState<string | null>(null);
  const [activeBevCatalog, setActiveBevCatalog] = useState<string | null>(null);
  const BEV_ID = "__beverages__";
  const BEV_UNCAT = "__bev_uncategorized__";

  // Valor desconhecido no banco não pode derrubar o cardápio de ninguém: cai
  // no padrão em vez de quebrar. É o porteiro aceitar "não sei" como "entra
  // pela porta de sempre", em vez de travar a fila.
  const modo = normalizarModoDeNavegacao(entryMode) ?? MODO_PADRAO_GLOBAL;

  const hasBeverages = !!(beverages && beverages.length > 0);
  if (categories.length === 0 && !hasBeverages) return null;

  const current = active ? categories.find((c) => c.id === active) ?? null : null;

  const isBeverageCategory = (c: MenuCategoryRow) => {
    return c.type === "BEVERAGE" || c.name.toLowerCase().includes("bebida") || c.name.toLowerCase().includes("beverage");
  };

  const visibleCategories = categories.filter(c => {
    const isBeverage = isBeverageCategory(c);
    if (isBeverage) {
        // Lógica de filtragem de bebidas delegada ao Template
    }
    return c.show_on_public_site !== false;
  });

  const clickableCategories = visibleCategories.filter(c => c.show_as_clickable_category !== false);
  const directCategories = visibleCategories.filter(c => c.show_directly_in_menu !== false);

  // O interruptor "Mostrar seção de categorias no início" liga e desliga só
  // este cabeçalho — o título e a frase de apresentação. Ele NÃO troca o modo
  // de navegação: apagar a placa da entrada não muda o caminho dentro da loja.
  const mostrarCabecalho =
    restaurant.site_settings?.show_categories_section !== false && clickableCategories.length > 0;

  const cabecalho = mostrarCabecalho ? (
    <div className="text-center mb-10 sm:mb-16">
      <span className="inline-block px-4 py-1.5 rounded-full bg-[hsl(var(--site-primary)/0.15)] text-[hsl(var(--site-primary))] text-[9px] sm:text-[10px] font-black tracking-[0.3em] uppercase mb-4 border border-[hsl(var(--site-primary)/0.25)]">
        {textos.menu_badge}
      </span>
      <h2 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase mb-4 text-[hsl(var(--site-fg))] drop-shadow-sm">
        {tituloDoCardapio.inicio}
        <span className="text-[hsl(var(--site-primary))]">{tituloDoCardapio.destaque}</span>
      </h2>
      <div className="h-1 w-20 bg-[hsl(var(--site-primary))] mx-auto mb-6 rounded-full opacity-80" />
      <p className="text-[hsl(var(--site-muted-fg))] mt-2 max-w-xl mx-auto italic text-sm sm:text-base leading-relaxed opacity-90 px-4">
        {current ? `Explorando a seleção premium de ${current.name}` : textos.menu_description}
      </p>
    </div>
  ) : null;

  // A seção de bebidas, do jeito que aparece dentro de uma categoria aberta.
  const secaoDeBebidas = (titulo: string) => (
    <div className="space-y-6 sm:space-y-10 mt-16 pt-12 border-t border-[hsl(var(--site-border))]">
      <div className="flex items-center gap-4 sm:gap-6 px-2">
        <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-[hsl(var(--site-border))] to-[hsl(var(--site-primary)/0.3)]" />
        <h3 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-[hsl(var(--site-fg))] shrink-0">
          {titulo}
        </h3>
        <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-[hsl(var(--site-border))] to-[hsl(var(--site-primary)/0.3)]" />
      </div>
      <div className="bg-[hsl(var(--site-muted))] rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-8">
        <SiteBeverageSection beverages={beverages ?? []} catalogs={beverageCatalogs} restaurant={restaurant} />
      </div>
    </div>
  );

  // ============ MODO 3: Cards de Categoria ============
  if (modo === "cards") {
    const hasBev = hasBeverages;
    // No auto-open: always show cards first, even with a single category.
    if (!active) {
      return (
        <section id="cardapio" className="py-12 sm:py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10 sm:mb-14">
              <h2 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase mb-4 text-[hsl(var(--site-fg))]">
                Nosso <span className="text-[hsl(var(--site-primary))]">Cardápio</span>
              </h2>
              <p className="text-[hsl(var(--site-muted-fg))] max-w-xl mx-auto text-sm sm:text-base px-4">
                Escolha uma categoria para começar.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {clickableCategories.map((c) => {
                const count = c.is_pizza
                  ? c.items.length
                  : c.items.length;
                return (
                <button
                  key={c.id}
                  onClick={() => setActive(c.id)}
                  className="group relative aspect-[4/3] rounded-3xl overflow-hidden border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary))] transition-colors duration-200 shadow-xl text-left"
                >
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt={c.name}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--site-muted))] text-[hsl(var(--site-muted-fg))]">
                      <ImageIcon className="h-14 w-14 opacity-40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                    <h3 className="text-white font-black text-xl sm:text-2xl leading-tight drop-shadow uppercase tracking-tight">
                      {c.icon ? `${c.icon} ` : ""}
                      {c.name}
                    </h3>
                    <p className="text-white/80 text-xs sm:text-sm mt-1 font-medium">
                      {count} {count === 1 ? (c.is_pizza ? "sabor" : "produto") : (c.is_pizza ? "sabores" : "produtos")}
                    </p>
                    {c.description && (
                      <p className="text-white/70 text-[11px] sm:text-xs mt-1 line-clamp-2">{c.description}</p>
                    )}
                  </div>
                </button>
                );
              })}
              {hasBev && (
                <button
                  key={BEV_ID}
                  onClick={() => setActive(BEV_ID)}
                  className="group relative aspect-[4/3] rounded-3xl overflow-hidden border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary))] transition-colors duration-200 shadow-xl text-left"
                >
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[hsl(var(--site-primary)/0.2)] to-[hsl(var(--site-muted))]">
                    <span className="text-7xl opacity-60">🍺</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                    <h3 className="text-white font-black text-xl sm:text-2xl leading-tight drop-shadow uppercase tracking-tight">
                      🍺 Bebidas
                    </h3>
                    <p className="text-white/80 text-xs sm:text-sm mt-1 font-medium">
                      {beverages!.length} {beverages!.length === 1 ? "item" : "itens"}
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </section>
      );
    }

    // Selected card view (lazy-rendered: products only mount after a card click)
    const selectedCat = active === BEV_ID ? null : clickableCategories.find((c) => c.id === active) ?? null;
    const isBev = active === BEV_ID;

    return (
      <section id="cardapio" className="py-12 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => {
              if (isBev && activeBevCatalog) {
                setActiveBevCatalog(null);
              } else {
                setActive(null);
                setActiveBevCatalog(null);
              }
            }}
            className="mb-6 px-6 py-2.5 site-btn-secondary !rounded-2xl text-xs sm:text-sm font-bold"
          >
            ← Voltar
          </button>

          {/* Floating back button — always visible while browsing products */}
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => {
              if (isBev && activeBevCatalog) {
                setActiveBevCatalog(null);
              } else {
                setActive(null);
                setActiveBevCatalog(null);
              }
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="fixed left-4 bottom-24 sm:bottom-8 z-40 h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))] shadow-2xl border-4 border-white/10 flex items-center justify-center active:scale-90 hover:scale-105 transition-all animate-in fade-in slide-in-from-bottom-4"
          >
            <ArrowLeft className="h-6 w-6 sm:h-7 sm:w-7" />
          </button>

          {isBev ? (
            (() => {
              const allBevs = beverages ?? [];
              const cats = (beverageCatalogs ?? []).filter(c => allBevs.some(b => b.catalog_id === c.id));
              const uncatBevs = allBevs.filter(b => !b.catalog_id || !cats.some(c => c.id === b.catalog_id));
              const hasSubcats = cats.length > 0;

              // Level 3 — show beverages of selected subcategory
              if (activeBevCatalog) {
                const selected = activeBevCatalog === BEV_UNCAT
                  ? { id: BEV_UNCAT, name: "Outras Bebidas", description: null as string | null, image_url: null as string | null }
                  : cats.find(c => c.id === activeBevCatalog);
                const bevList = activeBevCatalog === BEV_UNCAT
                  ? uncatBevs
                  : allBevs.filter(b => b.catalog_id === activeBevCatalog);
                return (
                  <>
                    {selected?.image_url ? (
                      <div className="relative h-40 sm:h-56 rounded-2xl overflow-hidden mb-6 border border-[hsl(var(--site-border))]">
                        <img src={selected.image_url} alt={selected.name} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <h3 className="absolute bottom-4 left-4 text-3xl font-black text-white drop-shadow uppercase">{selected.name}</h3>
                      </div>
                    ) : (
                      <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-8 text-[hsl(var(--site-fg))]">{selected?.name}</h3>
                    )}
                    <div className="bg-[hsl(var(--site-muted))] rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-8">
                      <SiteBeverageSection beverages={bevList} catalogs={[]} restaurant={restaurant} />
                    </div>
                  </>
                );
              }

              // Level 2 — show beverage subcategory cards. Skip if no subcategories at all.
              if (!hasSubcats) {
                return (
                  <>
                    <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-8 text-[hsl(var(--site-fg))]">🍺 Bebidas</h3>
                    <div className="bg-[hsl(var(--site-muted))] rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-8">
                      <SiteBeverageSection beverages={allBevs} catalogs={beverageCatalogs} restaurant={restaurant} />
                    </div>
                  </>
                );
              }

              return (
                <>
                  <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-8 text-[hsl(var(--site-fg))]">🍺 Bebidas</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    {cats.map((bc) => {
                      const count = allBevs.filter(b => b.catalog_id === bc.id).length;
                      return (
                        <button
                          key={bc.id}
                          onClick={() => setActiveBevCatalog(bc.id)}
                          className="group relative aspect-[4/3] rounded-3xl overflow-hidden border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary))] transition-colors duration-200 shadow-xl text-left"
                        >
                          {bc.image_url ? (
                            <img src={bc.image_url} alt={bc.name} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[hsl(var(--site-primary)/0.2)] to-[hsl(var(--site-muted))]">
                              <span className="text-6xl opacity-60">🍺</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                            <h4 className="text-white font-black text-xl sm:text-2xl leading-tight drop-shadow uppercase tracking-tight">{bc.name}</h4>
                            <p className="text-white/80 text-xs sm:text-sm mt-1 font-medium">
                              {count} {count === 1 ? "produto" : "produtos"}
                            </p>
                            {bc.description && (
                              <p className="text-white/70 text-[11px] sm:text-xs mt-1 line-clamp-2">{bc.description}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {uncatBevs.length > 0 && (
                      <button
                        key={BEV_UNCAT}
                        onClick={() => setActiveBevCatalog(BEV_UNCAT)}
                        className="group relative aspect-[4/3] rounded-3xl overflow-hidden border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary))] transition-colors duration-200 shadow-xl text-left"
                      >
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[hsl(var(--site-primary)/0.2)] to-[hsl(var(--site-muted))]">
                          <span className="text-6xl opacity-60">🥤</span>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                          <h4 className="text-white font-black text-xl sm:text-2xl leading-tight drop-shadow uppercase tracking-tight">Outras Bebidas</h4>
                          <p className="text-white/80 text-xs sm:text-sm mt-1 font-medium">
                            {uncatBevs.length} {uncatBevs.length === 1 ? "produto" : "produtos"}
                          </p>
                        </div>
                      </button>
                    )}
                  </div>
                </>
              );
            })()
          ) : selectedCat ? (
            <>
              {selectedCat.image_url && (
                <div className="relative h-40 sm:h-56 rounded-2xl overflow-hidden mb-6 border border-[hsl(var(--site-border))]">
                  <img src={selectedCat.image_url} alt={selectedCat.name} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <h3 className="absolute bottom-4 left-4 text-3xl font-black text-white drop-shadow uppercase">
                    {selectedCat.icon ? `${selectedCat.icon} ` : ""}
                    {selectedCat.name}
                  </h3>
                </div>
              )}
              {!selectedCat.image_url && (
                <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-8 text-[hsl(var(--site-fg))]">
                  {selectedCat.icon ? `${selectedCat.icon} ` : ""}
                  {selectedCat.name}
                </h3>
              )}
              {selectedCat.is_pizza ? (
                <SitePizzaBuilder
                  category={selectedCat}
                  restaurant={restaurant}
                  beverages={beverages}
                  beverageCatalogs={beverageCatalogs}
                />
              ) : selectedCat.items.length === 0 ? (
                <div className="py-16 text-center text-[hsl(var(--site-muted-fg))]">
                  Nenhum produto disponível nesta categoria.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {selectedCat.items.map((it) => (
                    <div key={it.id} className="h-full">
                      <SiteMenuItemCard item={it} restaurant={restaurant} adicionaisCategory={adicionaisCategory} />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </section>
    );
  }

  // ============ MODO 2: Exibição Direta (rolagem única) ============
  //
  // Uma categoria embaixo da outra, com os produtos à vista. Ninguém precisa
  // clicar em nada para ver o cardápio inteiro — é o cardápio de papel aberto
  // em cima da mesa, e não o cardápio digital que pede para escolher a página.
  if (modo === "direct") {
    return (
      <section id="cardapio" className="py-12 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          {cabecalho}
          <div className="space-y-16 sm:space-y-24">
            {directCategories.map(cat => (
              <div key={cat.id} className="space-y-6 sm:space-y-10">
                <div className="flex items-center gap-4 sm:gap-6 px-2">
                  <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-[hsl(var(--site-border))] to-[hsl(var(--site-primary)/0.3)]" />
                  <h3 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-[hsl(var(--site-fg))] shrink-0">
                    {cat.icon ? `${cat.icon} ` : ""}
                    {cat.name}
                  </h3>
                  <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-[hsl(var(--site-border))] to-[hsl(var(--site-primary)/0.3)]" />
                </div>
                {cat.items.length === 0 ? (
                  <p className="text-center text-sm text-[hsl(var(--site-muted-fg))]">
                    Nenhum produto disponível nesta categoria.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8 h-full">
                    {cat.items.map((it) => (
                      <div key={it.id} className="h-full">
                        <SiteMenuItemCard item={it} restaurant={restaurant} adicionaisCategory={adicionaisCategory} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {hasBeverages && secaoDeBebidas("Acompanhamentos")}
          </div>
        </div>
      </section>
    );
  }

  // ============ MODO 1: Navegação por Categorias ============
  //
  // Primeiro a grade de categorias; depois de escolher uma, os produtos dela e
  // uma barra para pular de categoria sem voltar. É o garçom perguntando "vai
  // querer ver as massas ou as carnes?" antes de trazer a lista inteira.
  const bebidasAbertas = active === BEV_ID;

  return (
    <section id="cardapio" className="py-12 sm:py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {cabecalho}

        {!current && !bebidasAbertas ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {clickableCategories.map((c) => (
               <button
                 key={c.id}
                 onClick={() => setActive(c.id)}
                 className="group relative aspect-square rounded-2xl sm:rounded-3xl overflow-hidden border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-primary/50 transition-colors duration-200 shadow-xl sm:shadow-2xl"
               >
                {c.image_url && (
                  <img
                    src={c.image_url}
                    alt={c.name}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                {!c.image_url && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--site-card))] text-[hsl(var(--site-muted-fg))]">
                    <ImageIcon className="h-10 w-10 opacity-40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-4 text-left">
                  <h3 className="text-white font-black text-sm sm:text-lg leading-tight drop-shadow">
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </h3>
                  <p className="text-white/80 text-[10px] sm:text-xs mt-0.5">
                    {c.is_pizza
                      ? `${c.items.length} ${c.items.length === 1 ? "sabor" : "sabores"}`
                      : `${c.items.length} ${c.items.length === 1 ? "item" : "itens"}`}
                  </p>
                </div>
              </button>
            ))}
            {/* As bebidas entram como mais uma "categoria" na grade. Sem isto,
                uma adega — que só tem bebida cadastrada — abriria uma grade
                vazia, como uma prateleira sem placa e sem produto. */}
            {hasBeverages && (
              <button
                key={BEV_ID}
                onClick={() => setActive(BEV_ID)}
                className="group relative aspect-square rounded-2xl sm:rounded-3xl overflow-hidden border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-primary/50 transition-colors duration-200 shadow-xl sm:shadow-2xl"
              >
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[hsl(var(--site-primary)/0.2)] to-[hsl(var(--site-muted))]">
                  <span className="text-5xl opacity-60">🍺</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-4 text-left">
                  <h3 className="text-white font-black text-sm sm:text-lg leading-tight drop-shadow">
                    🍺 Bebidas
                  </h3>
                  <p className="text-white/80 text-[10px] sm:text-xs mt-0.5">
                    {beverages!.length} {beverages!.length === 1 ? "item" : "itens"}
                  </p>
                </div>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-6">
               <button
                 onClick={() => setActive(null)}
                 className="px-6 py-2.5 site-btn-secondary !rounded-2xl"
               >
                 ← Voltar
               </button>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1 min-w-0">
                {clickableCategories.map((c) => (
                   <button
                     key={c.id}
                     onClick={() => setActive(c.id)}
                     className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl whitespace-nowrap font-black text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-all ${
                       active === c.id
                         ? "site-btn-primary shadow-glow"
                         : "site-btn-secondary text-muted-foreground"
                     }`}
                   >
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </button>
                ))}
                {hasBeverages && (
                  <button
                    key={BEV_ID}
                    onClick={() => setActive(BEV_ID)}
                    className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl whitespace-nowrap font-black text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-all ${
                      bebidasAbertas
                        ? "site-btn-primary shadow-glow"
                        : "site-btn-secondary text-muted-foreground"
                    }`}
                  >
                    🍺 Bebidas
                  </button>
                )}
              </div>
            </div>

            {bebidasAbertas ? (
              <>
                <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-8 text-[hsl(var(--site-fg))]">
                  🍺 Bebidas
                </h3>
                <div className="bg-[hsl(var(--site-muted))] rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-8">
                  <SiteBeverageSection beverages={beverages ?? []} catalogs={beverageCatalogs} restaurant={restaurant} />
                </div>
              </>
            ) : (
              <>
                {current && current.image_url && (
                  <div className="relative h-40 sm:h-56 rounded-2xl overflow-hidden mb-6 border border-[hsl(var(--site-border))]">
                    <img
                      src={current.image_url}
                      alt={current.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <h3 className="absolute bottom-4 left-4 text-3xl font-black text-white drop-shadow">
                      {current.icon ? `${current.icon} ` : ""}
                      {current.name}
                    </h3>
                  </div>
                )}

                {current && current.is_pizza ? (
                  <SitePizzaBuilder
                    category={current}
                    restaurant={restaurant}
                    beverages={beverages}
                    beverageCatalogs={beverageCatalogs}
                  />
                ) : (
                  <div className="space-y-12">
                    {current && current.items.length === 0 ? (
                      <div className="py-16 text-center text-[hsl(var(--site-muted-fg))]">
                        Nenhum produto disponível nesta categoria.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
                        {current?.items.map((it) => (
                          <div key={it.id} className="h-full">
                            <SiteMenuItemCard item={it} restaurant={restaurant} adicionaisCategory={adicionaisCategory} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

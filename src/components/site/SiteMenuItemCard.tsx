import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, ImageIcon, Check } from "lucide-react";
import type { MenuItemRow, MenuCategoryRow, Size, RestaurantRow } from "@/lib/site/types";
import { formatBRL } from "@/lib/site/format";
import { useCart } from "./CartContext";
import {
  adicionaisDaCategoria,
  type VinculosDeAdicional,
} from "@/lib/site/adicionaisDaCategoria";

export function SiteMenuItemCard({ item, restaurant, adicionaisCategory, vinculosDeAdicional }: { item: MenuItemRow, restaurant?: RestaurantRow, adicionaisCategory?: MenuCategoryRow & { items: MenuItemRow[] }, vinculosDeAdicional?: VinculosDeAdicional }) {
  const { addLine } = useCart();
  const sizes: Size[] = item.sizes && item.sizes.length > 0 ? item.sizes : [];
  const [selected, setSelected] = useState<Size | null>(sizes[0] ?? null);

  // Só os adicionais que valem para a categoria DESTE produto. Sem isto, quem
  // abre o açaí é oferecido bacon. Adicional sem vínculo continua em todos.
  const extras = useMemo(
    () =>
      adicionaisDaCategoria(
        adicionaisCategory?.items ?? [],
        item.category_id,
        vinculosDeAdicional,
      ),
    [adicionaisCategory, item.category_id, vinculosDeAdicional],
  );
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);
  // Fechado por padrão: o card é pequeno, e abrir a lista de adicionais em
  // todo produto empurraria o botão de pedir para fora da tela no celular.
  const [showExtras, setShowExtras] = useState(false);

  const chosenExtras = extras.filter((e) => selectedExtraIds.includes(e.id));
  const extrasPrice = chosenExtras.reduce((sum, e) => sum + (Number(e.price) || 0), 0);

  // Nulo/vazio = sem limite. Com limite, dá pra TIRAR um adicional marcado
  // sempre — só travamos quem ainda não foi marcado, quando o teto já bateu.
  const limiteDeAdicionais = item.max_extras ?? null;
  const limiteAtingido = limiteDeAdicionais != null && selectedExtraIds.length >= limiteDeAdicionais;

  function alternarExtra(extraId: string) {
    setSelectedExtraIds((cur) => {
      if (cur.includes(extraId)) return cur.filter((x) => x !== extraId);
      if (limiteDeAdicionais != null && cur.length >= limiteDeAdicionais) return cur;
      return [...cur, extraId];
    });
  }

  const price = (selected ? selected.price : item.price) + extrasPrice;
  const showConsult = !selected && item.price === 0;

  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    setIsAdding(true);
    addLine({
      // Os adicionais entram na identidade da linha porque o carrinho junta
      // linhas iguais: sem isso, um lanche com bacon e o mesmo lanche sem
      // bacon virariam duas unidades pelo preço do primeiro.
      itemId: selectedExtraIds.length > 0
        ? `${item.id}-a:${[...selectedExtraIds].sort().join("_")}`
        : item.id,
      name: item.name,
      description: [
        item.description ?? "",
        chosenExtras.length > 0
          ? `Adicionais (+${formatBRL(extrasPrice)}): ${chosenExtras.map((e) => e.name).join(", ")}`
          : "",
      ].filter(Boolean).join(" • "),
      unitPrice: price,
      sizeLabel: selected?.label,
    });
    setSelectedExtraIds([]);
    setShowExtras(false);
    setTimeout(() => setIsAdding(false), 1000);
  };

  const nameParts = item.name.match(/^\[(.*?)\]\s*(.*)$/) || [null, null, item.name];
  const itemCode = nameParts[1];
  const itemName = nameParts[2];

  // Mesmo em duas linhas, um nome bem comprido ainda pode não caber
  // ("PASTEL DE CARNE SECA COM CREAM CHEESE E..."). Aqui a gente mede se
  // sobrou texto cortado e só aí liga o botão "..." — em nome curto ele nem
  // aparece.
  const nameRef = useRef<HTMLHeadingElement>(null);
  const [nameExpanded, setNameExpanded] = useState(false);
  const [nameOverflows, setNameOverflows] = useState(false);

  useEffect(() => {
    if (nameExpanded) return;
    const medir = () => {
      const el = nameRef.current;
      if (!el) return;
      setNameOverflows(el.scrollHeight > el.clientHeight + 1);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [itemName, nameExpanded]);

  return (
     <div className="rounded-2xl sm:rounded-[2rem] border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] flex flex-col gap-0 hover:border-[hsl(var(--site-primary)/0.6)] transition-colors duration-200 overflow-hidden shadow-xl group relative h-full">
       {/* Brilho de hover: só existe em tela com mouse. No celular ninguém
           passa o mouse, e a camada ficaria sendo pintada à toa em cada card. */}
       <div className="hidden [@media(hover:hover)]:block absolute inset-0 bg-gradient-to-br from-[hsl(var(--site-primary)/0.08)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
       {(restaurant?.show_item_images ?? true) && item.image_url && (
         <div
           data-foto
           className="relative aspect-[16/9] sm:aspect-[16/10] overflow-hidden bg-[hsl(var(--site-muted))] shrink-0"
         >
           <img
             src={item.image_url}
             alt={item.name}
             loading="lazy"
             decoding="async"
             // A proporção já vem do contêiner; as medidas aqui evitam que o
             // card mude de altura quando a foto termina de carregar — é a
             // diferença entre a lista ficar parada e os produtos pularem de
             // lugar bem na hora em que o cliente vai tocar num deles.
             width={800}
             height={450}
             className="absolute inset-0 w-full h-full object-cover [@media(hover:hover)]:group-hover:scale-110 [@media(hover:hover)]:transition-transform [@media(hover:hover)]:duration-500"
             onError={(e) => {
               const foto = (e.target as HTMLImageElement).closest("[data-foto]");
               if (foto) (foto as HTMLElement).style.display = "none";
             }}
           />
           <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
         </div>
       )}
       <div className="p-3.5 sm:p-6 flex flex-col gap-2.5 sm:gap-4 flex-1 relative z-10">
         <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="flex flex-col min-w-0">
              {itemCode && (
                <span className="text-[8px] sm:text-[10px] font-bold text-[hsl(var(--site-primary))] tracking-widest uppercase mb-0.5 sm:mb-1">
                  [{itemCode}]
                </span>
              )}
              {/* Duas linhas em vez de reticências: "PASTEL DE CARNE DE S…" não
                  diz qual é o recheio, e o cliente não compra o que não
                  consegue ler. Se nem duas linhas bastarem, o botão "ver
                  mais" abaixo mostra o nome inteiro. */}
              <h3
                ref={nameRef}
                className={`font-black text-base sm:text-xl tracking-tighter uppercase group-hover:text-[hsl(var(--site-primary))] transition-colors leading-tight [overflow-wrap:anywhere] ${
                  nameExpanded ? "" : "line-clamp-2"
                }`}
              >
                {itemName}
              </h3>
              {nameOverflows && (
                <button
                  type="button"
                  onClick={() => setNameExpanded((v) => !v)}
                  className="self-start text-[10px] sm:text-xs font-black text-[hsl(var(--site-primary))] mt-0.5"
                >
                  {nameExpanded ? "ver menos" : "ver mais"}
                </button>
              )}
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className="text-[hsl(var(--site-primary))] font-black text-base sm:text-xl tracking-tighter">
                {showConsult ? "CONSULTAR" : formatBRL(price)}
              </span>
            </div>
         </div>
         {item.description && (
           <p className="text-[10px] sm:text-xs text-[hsl(var(--site-muted-fg))] leading-relaxed italic line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem]">
             {item.description}
           </p>
         )}
          {sizes.length > 0 && (
            <div className="flex flex-wrap gap-1 sm:gap-2 mt-auto">
              {sizes.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setSelected(s)}
                  className={`px-2.5 sm:px-4 py-1 sm:py-1.5 text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg sm:rounded-xl border transition-all ${
                    selected?.label === s.label
                      ? "site-btn-primary border-[hsl(var(--site-primary)/0.5)] text-[hsl(var(--site-primary-fg))] shadow-lg scale-105"
                       : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-muted))] hover:border-[hsl(var(--site-primary)/0.3)] text-[hsl(var(--site-muted-fg))]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {extras.length > 0 && !showConsult && (
            <div className={sizes.length === 0 ? 'mt-auto' : ''}>
              <button
                type="button"
                onClick={() => setShowExtras((v) => !v)}
                aria-expanded={showExtras}
                className="w-full flex items-center justify-between gap-2 py-1.5 text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-[hsl(var(--site-primary))]"
              >
                <span>
                  + Adicionais
                  {chosenExtras.length > 0 &&
                    ` (${chosenExtras.length}${limiteDeAdicionais != null ? `/${limiteDeAdicionais}` : ""})`}
                </span>
                <span className="text-[hsl(var(--site-muted-fg))] normal-case tracking-normal font-bold">
                  {showExtras ? "fechar" : "ver"}
                </span>
              </button>
              {showExtras && (
                <div className="flex flex-wrap gap-1 sm:gap-1.5 pb-1">
                  {extras.map((e) => {
                    const active = selectedExtraIds.includes(e.id);
                    const travado = !active && limiteAtingido;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        aria-pressed={active}
                        aria-disabled={travado}
                        disabled={travado}
                        onClick={() => alternarExtra(e.id)}
                        className={`px-2 sm:px-2.5 py-1 text-[8px] sm:text-[10px] font-bold rounded-lg border transition-all ${
                          active
                            ? "border-[hsl(var(--site-primary))] bg-[hsl(var(--site-primary)/0.12)] text-[hsl(var(--site-primary))]"
                            : travado
                              ? "cursor-not-allowed border-[hsl(var(--site-border))] bg-[hsl(var(--site-muted))] text-[hsl(var(--site-muted-fg))] opacity-40"
                              : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-muted))] text-[hsl(var(--site-muted-fg))] hover:border-[hsl(var(--site-primary)/0.4)]"
                        }`}
                      >
                        {active && <Check className="inline h-2.5 w-2.5 mr-0.5" />}
                        {e.name} +{formatBRL(e.price)}
                      </button>
                    );
                  })}
                  {limiteAtingido && (
                    <p className="w-full text-[9px] sm:text-[10px] text-[hsl(var(--site-muted-fg))]">
                      Máximo de {limiteDeAdicionais} adicion
                      {limiteDeAdicionais === 1 ? "al" : "ais"} atingido.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleAdd}
            disabled={showConsult || isAdding}
            // Transição só do que de fato muda no botão: a cor (fica verde ao
            // adicionar) e o afundar do toque. `transition-all` mandaria o
            // navegador ficar de olho em toda propriedade animável de cada um
            // dos 200 botões da lista.
            className={`mt-1.5 sm:mt-2 site-btn-primary py-2 sm:py-3.5 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 disabled:opacity-70 disabled:scale-100 shadow-xl active:scale-95 transition-[background-color,transform] duration-200 group/btn ${sizes.length === 0 ? 'mt-auto' : ''} ${isAdding ? 'bg-green-600 border-green-500 shadow-green-900/20' : ''}`}
          >
            {isAdding ? (
              <>
                <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.2em] font-black text-white">Adicionado!</span>
              </>
            ) : (
              <>
                <Plus className="h-3 sm:h-4 w-3 sm:w-4 text-[hsl(var(--site-primary-fg))] group-hover/btn:rotate-90 transition-transform" />
                <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.2em] font-black">
                  <span className="hidden xs:inline">Adicionar ao pedido</span>
                  <span className="xs:hidden">Adicionar</span>
                </span>
              </>
            )}
          </button>
       </div>
     </div>
  );
}
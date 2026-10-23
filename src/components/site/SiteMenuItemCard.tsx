import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Check } from "lucide-react";
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
     <div className="rounded-2xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] flex flex-col overflow-hidden shadow-sm [@media(hover:hover)]:hover:shadow-md [@media(hover:hover)]:hover:border-[hsl(var(--site-primary)/0.5)] transition-[box-shadow,border-color] duration-200 group relative h-full">
       {(restaurant?.show_item_images ?? true) && item.image_url && (
         <div
           data-foto
           className="relative aspect-[4/3] sm:aspect-[16/10] overflow-hidden bg-[hsl(var(--site-muted))] shrink-0"
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
             height={500}
             className="absolute inset-0 w-full h-full object-cover [@media(hover:hover)]:motion-safe:group-hover:scale-105 [@media(hover:hover)]:transition-transform [@media(hover:hover)]:duration-500"
             onError={(e) => {
               const foto = (e.target as HTMLImageElement).closest("[data-foto]");
               if (foto) (foto as HTMLElement).style.display = "none";
             }}
           />
         </div>
       )}
       <div className="p-4 sm:p-5 flex flex-col gap-2 flex-1">
         <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col min-w-0">
              {itemCode && (
                <span className="text-[11px] font-bold text-[hsl(var(--site-primary))] tracking-wider uppercase mb-0.5">
                  [{itemCode}]
                </span>
              )}
              {/* Duas linhas em vez de reticências: "PASTEL DE CARNE DE S…" não
                  diz qual é o recheio, e o cliente não compra o que não
                  consegue ler. Se nem duas linhas bastarem, o botão "ver
                  mais" abaixo mostra o nome inteiro. */}
              <h3
                ref={nameRef}
                className={`font-bold text-base sm:text-lg leading-snug tracking-tight text-[hsl(var(--site-fg))] [overflow-wrap:anywhere] ${
                  nameExpanded ? "" : "line-clamp-2"
                }`}
              >
                {itemName}
              </h3>
              {nameOverflows && (
                <button
                  type="button"
                  onClick={() => setNameExpanded((v) => !v)}
                  aria-expanded={nameExpanded}
                  className="self-start text-xs font-semibold text-[hsl(var(--site-primary))] mt-0.5 underline underline-offset-2"
                >
                  {nameExpanded ? "ver menos" : "ver mais"}
                </button>
              )}
            </div>
            <span className="shrink-0 text-[hsl(var(--site-primary))] font-extrabold text-base sm:text-lg tabular-nums leading-snug">
              {showConsult ? "Consultar" : formatBRL(price)}
            </span>
         </div>
         {item.description && (
           <p className="text-[13px] sm:text-sm text-[hsl(var(--site-muted-fg))] leading-relaxed line-clamp-2">
             {item.description}
           </p>
         )}

         {/* Tudo que é escolha + o botão ficam juntos no pé do card. Assim o
             botão "Adicionar" cai sempre na mesma altura numa fileira de
             cards, tenha o produto descrição longa, curta ou nenhuma. */}
         <div className="mt-auto flex flex-col gap-2.5 pt-1">
          {sizes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2" role="group" aria-label="Tamanho">
              {sizes.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  aria-pressed={selected?.label === s.label}
                  onClick={() => setSelected(s)}
                  className={`min-h-9 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg border transition-colors ${
                    selected?.label === s.label
                      ? "site-btn-primary border-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))]"
                       : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-muted))] hover:border-[hsl(var(--site-primary)/0.4)] text-[hsl(var(--site-fg))]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {extras.length > 0 && !showConsult && (
            <div>
              <button
                type="button"
                onClick={() => setShowExtras((v) => !v)}
                aria-expanded={showExtras}
                className="w-full min-h-9 flex items-center justify-between gap-2 text-xs sm:text-sm font-semibold text-[hsl(var(--site-primary))]"
              >
                <span>
                  + Adicionais
                  {chosenExtras.length > 0 &&
                    ` (${chosenExtras.length}${limiteDeAdicionais != null ? `/${limiteDeAdicionais}` : ""})`}
                </span>
                <span className="text-[hsl(var(--site-muted-fg))] font-medium">
                  {showExtras ? "fechar" : "ver opções"}
                </span>
              </button>
              {showExtras && (
                <div className="flex flex-wrap gap-1.5 pb-1">
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
                        className={`min-h-9 px-2.5 text-xs font-medium rounded-lg border transition-colors ${
                          active
                            ? "border-[hsl(var(--site-primary))] bg-[hsl(var(--site-primary)/0.12)] text-[hsl(var(--site-primary))]"
                            : travado
                              ? "cursor-not-allowed border-[hsl(var(--site-border))] bg-[hsl(var(--site-muted))] text-[hsl(var(--site-muted-fg))] opacity-40"
                              : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-muted))] text-[hsl(var(--site-fg))] hover:border-[hsl(var(--site-primary)/0.4)]"
                        }`}
                      >
                        {active && <Check className="inline h-3 w-3 mr-0.5" aria-hidden="true" />}
                        {e.name} +{formatBRL(e.price)}
                      </button>
                    );
                  })}
                  {limiteAtingido && (
                    <p className="w-full text-xs text-[hsl(var(--site-muted-fg))]">
                      Máximo de {limiteDeAdicionais} adicion
                      {limiteDeAdicionais === 1 ? "al" : "ais"} atingido.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={handleAdd}
            disabled={showConsult || isAdding}
            aria-label={`Adicionar ${itemName} ao pedido`}
            // Transição só do que de fato muda no botão: a cor (fica verde ao
            // adicionar) e o afundar do toque. `transition-all` mandaria o
            // navegador ficar de olho em toda propriedade animável de cada um
            // dos 200 botões da lista.
            className={`site-btn-primary min-h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-70 disabled:scale-100 active:scale-95 transition-[background-color,transform] duration-200 ${isAdding ? 'bg-green-600 border-green-500' : ''}`}
          >
            {isAdding ? (
              <>
                <Check className="h-4 w-4 text-white" aria-hidden="true" />
                <span className="text-white">Adicionado!</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 text-[hsl(var(--site-primary-fg))]" aria-hidden="true" />
                <span>Adicionar</span>
              </>
            )}
          </button>
         </div>
       </div>
     </div>
  );
}

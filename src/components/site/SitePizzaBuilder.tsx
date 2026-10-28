import { useMemo, useState, useEffect, useRef } from "react";
import { Check, Plus, Minus, Sparkles, Info, ShoppingBag, Flame, GlassWater, X, Pencil, AlertCircle } from "lucide-react";
import type { CartLine, MenuCategoryRow, MenuItemRow, PizzaSize, RestaurantRow, BeverageRow, BeverageCatalogRow } from "@/lib/site/types";
import { formatBRL } from "@/lib/site/format";
import { useCart } from "./CartContext";
import { SiteBeverageSection } from "./SiteBeverageSection";
import { adicionaisDaCategoria, type VinculosDeAdicional } from "@/lib/site/adicionaisDaCategoria";
import { montarCatalogoDePizza } from "@/lib/site/pizza/catalogo";
import { linhaDaPizza } from "@/lib/site/pizza/linhaDoCarrinho";
import {
  LIMITES,
  NOMES_DAS_REGRAS,
  calcularPizza,
  chaveDeNome,
  formatarCentavos,
  precoDaOpcaoNoTamanho,
  precoDoSaborNoTamanho,
  type MontagemDePizza,
} from "@/lib/site/pizza/motorDePreco";

/**
 * Pedido para reabrir uma pizza do carrinho no montador. O carrinho dispara,
 * o montador da categoria certa escuta e carrega a pizza para edição.
 */
export const EVENTO_EDITAR_PIZZA = "pizza:editar";
export type PedidoDeEdicao = { linha: CartLine; atendido?: boolean };

  interface Props {
    category: MenuCategoryRow & { items: MenuItemRow[] };
    restaurant?: RestaurantRow;
    bordasCategory?: MenuCategoryRow & { items: MenuItemRow[] };
    adicionaisCategory?: MenuCategoryRow & { items: MenuItemRow[] };
    vinculosDeAdicional?: VinculosDeAdicional;
    beverages?: BeverageRow[];
    beverageCatalogs?: BeverageCatalogRow[];
  }

interface FlavorCardProps {
  it: MenuItemRow;
  checked: boolean;
  disabled: boolean;
  size: any;
  toggleFlavor: (id: string) => void;
  restaurant?: RestaurantRow;
  isSpecialSection?: boolean;
  /** Preço do sabor no tamanho escolhido, quando a regra da loja usa preço por sabor. */
  precoNoTamanho?: string | null;
}

function FlavorCard({ it, checked, disabled, size, toggleFlavor, restaurant, precoNoTamanho }: FlavorCardProps) {
  return (
    <button
      onClick={() => toggleFlavor(it.id)}
      disabled={!size || disabled}
      aria-pressed={checked}
      className={`relative text-left rounded-xl sm:rounded-3xl border p-3 sm:p-5 transition-all duration-300 flex items-start gap-3 sm:gap-4 overflow-hidden group h-full ${
        checked
          ? "border-[hsl(var(--site-primary))] bg-[hsl(var(--site-primary)/0.08)] shadow-[0_10px_30px_hsl(var(--site-primary)/0.12)] ring-2 ring-[hsl(var(--site-primary)/0.2)]"
          : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary)/0.5)] hover:shadow-lg"
      } ${disabled ? "opacity-30 cursor-not-allowed" : "hover:scale-[1.02]"}`}
    >
      {(restaurant?.show_item_images ?? true) && it.image_url && (
        <div className="h-16 w-16 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-muted))]">
          <img
            src={it.image_url}
            alt={it.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.style.display = 'none';
            }}
          />
        </div>
      )}
      <div
        className={`mt-1 h-5 w-5 sm:h-6 sm:w-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
          checked
            ? "bg-[hsl(var(--site-primary))] border-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))] shadow-[0_4px_12px_hsl(var(--site-primary)/0.3)] scale-110"
            : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] group-hover:border-[hsl(var(--site-primary)/0.5)]"
        }`}
      >
        {checked && <Check className="h-3 sm:h-3.5 w-3 sm:w-3.5 stroke-[3]" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <p className="font-bold text-sm sm:text-base leading-tight text-[hsl(var(--site-fg))]">{it.name}</p>
          {it.is_special && (
            <span className="inline-flex items-center gap-1 text-[8px] sm:text-[10px] uppercase tracking-wider px-1.5 sm:py-0.5 rounded-full font-extrabold bg-[hsl(var(--site-primary))] text-white shadow-sm">
              <Sparkles className="h-2.5 sm:h-3 w-2.5 sm:w-3" /> Especial
              {!precoNoTamanho && it.special_extra > 0 ? ` +${formatBRL(it.special_extra)}` : ""}
            </span>
          )}
        </div>
        {precoNoTamanho && (
          <p className="text-[hsl(var(--site-secondary))] font-black text-sm sm:text-base mt-0.5">{precoNoTamanho}</p>
        )}
        {it.description && (
          <p className="text-xs sm:text-sm text-[hsl(var(--site-muted-fg))] mt-1 sm:mt-1.5 leading-relaxed line-clamp-2">
            {it.description}
          </p>
        )}
      </div>
    </button>
  );
}

const cardBase = "relative rounded-2xl sm:rounded-3xl border p-3 sm:p-5 text-left transition-all duration-300 transform";
const cardAtivo =
  "border-[hsl(var(--site-primary))] bg-[hsl(var(--site-primary)/0.05)] shadow-[0_10px_30px_hsl(var(--site-primary)/0.1)] ring-2 ring-[hsl(var(--site-primary)/0.2)]";
const cardInativo = "border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary)/0.3)]";

function Marcado() {
  return (
    <span className="absolute top-2 right-2 sm:top-3 sm:right-3 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))] inline-flex items-center justify-center">
      <Check className="h-2.5 sm:h-3 w-2.5 sm:w-3" />
    </span>
  );
}

  export function SitePizzaBuilder({ category, restaurant, bordasCategory, adicionaisCategory, vinculosDeAdicional, beverages, beverageCatalogs }: Props) {
    // Os adicionais que valem para ESTA categoria de pizza. Calculado uma vez
    // e usado em todos os pontos abaixo: ler `adicionaisCategory.items` direto
    // em qualquer um deles traria a lista inteira de volta e o filtro passaria
    // a valer só em metade da tela.
    const adicionaisDaqui = useMemo(
      () => adicionaisDaCategoria(adicionaisCategory?.items ?? [], category?.id, vinculosDeAdicional),
      [adicionaisCategory?.items, category?.id, vinculosDeAdicional],
    );
  const sizes: PizzaSize[] = useMemo(() => category.pizza_sizes ?? [], [category.pizza_sizes]);
  const bordas = useMemo(() => bordasCategory?.items ?? [], [bordasCategory?.items]);
  const { addLine, replaceLine, setCartOpen } = useCart();
  const [sizeIdx, setSizeIdx] = useState<number | null>(sizes.length > 0 ? 0 : null);
   const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
    const [selectedBorderId, setSelectedBorderId] = useState<string | null>(null);
    // Adicional é escolha múltipla e, quando o lojista permite, com
    // quantidade: bacon x2 e cheddar x1 na mesma pizza. Borda continua sendo
    // uma só — não existe pizza com duas.
    const [qtdAdicionais, setQtdAdicionais] = useState<Record<string, number>>({});
    const [removidos, setRemovidos] = useState<string[]>([]);
    const [observacao, setObservacao] = useState("");
    const [quantidade, setQuantidade] = useState(1);
    // Pizza do carrinho reaberta para edição: guardamos qual linha substituir.
    const [editando, setEditando] = useState<{ itemId: string; sizeLabel?: string } | null>(null);

  const [confirm, setConfirm] = useState<string | null>(null);
  const [scrollMessage, setScrollMessage] = useState<string | null>(null);
  const [lastCompletedCount, setLastCompletedCount] = useState<number>(0);

  const bordasRef = useRef<HTMLDivElement>(null);
  const adicionaisRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // O cardápio no formato da calculadora — a MESMA conversão que o servidor
  // usa para conferir o pedido. O preço que o cliente vê aqui é o preço que
  // o servidor vai aceitar.
  const catalogo = useMemo(
    () =>
      montarCatalogoDePizza({
        tamanhos: sizes,
        sabores: category.items,
        bordas,
        adicionais: adicionaisDaqui,
        siteSettings: restaurant?.site_settings,
      }),
    [sizes, category.items, bordas, adicionaisDaqui, restaurant?.site_settings],
  );
  const config = catalogo.config;

  const size = sizeIdx !== null ? sizes[sizeIdx] : null;
  const tamanhoDoCatalogo = size ? catalogo.tamanhos.find((t) => t.chave === chaveDeNome(size.label)) ?? null : null;
  const maxFlavors = size?.max_flavors ?? 0;
  const remaining = Math.max(0, maxFlavors - selectedFlavors.length);
  const isSelectionComplete = !!size && selectedFlavors.length === maxFlavors && maxFlavors > 0;
  const precoPorSabor = config.regra !== "tamanho_e_especiais";

  useEffect(() => {
    if (editando) return; // reabrindo do carrinho: não pular a tela sozinho
    if (isSelectionComplete && selectedFlavors.length !== lastCompletedCount) {
      setLastCompletedCount(selectedFlavors.length);

      let targetRef = null;
      let message = "";

      if (bordas.length > 0) {
        targetRef = bordasRef;
        message = "Agora escolha sua borda ✨";
      } else if (adicionaisDaqui.length > 0) {
        // Sem bordas cadastradas, o proximo passo e o de adicionais - levar
        // direto para o resumo faria o cliente passar reto por eles.
        targetRef = adicionaisRef;
        message = "Quer turbinar com algum adicional? ✨";
      } else {
        targetRef = summaryRef;
        message = "Tudo pronto! Revise seu pedido abaixo. ✨";
      }

      if (targetRef?.current) {
        setScrollMessage(message);
        const offset = 100; // Safe offset for fixed headers
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = targetRef.current.getBoundingClientRect().top;
        window.scrollTo({ top: elementRect - bodyRect - offset, behavior: "smooth" });
        setTimeout(() => setScrollMessage(null), 4000);
      }
    } else if (selectedFlavors.length < maxFlavors) {
      setLastCompletedCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelectionComplete, selectedFlavors.length, maxFlavors, bordas.length, adicionaisDaqui.length, lastCompletedCount, editando]);

  const { flavorMap, classicFlavors, specialFlavors } = useMemo(() => {
    const m = new Map<string, MenuItemRow>();
    const classic: MenuItemRow[] = [];
    const special: MenuItemRow[] = [];
    category.items.forEach((it) => {
      m.set(it.id, it);
      if (it.is_special) special.push(it);
      else classic.push(it);
    });
    return { flavorMap: m, classicFlavors: classic, specialFlavors: special };
  }, [category.items]);

  // Ingredientes que o cliente pode tirar: só os dos sabores escolhidos, e
  // só se a loja permitir. Tirar não dá desconto (o motor nunca desconta).
  const ingredientesDisponiveis = useMemo(() => {
    if (!config.permitirRemoverIngredientes) return [];
    const todos = new Set<string>();
    for (const id of selectedFlavors) {
      catalogo.sabores.find((s) => s.id === id)?.ingredientes.forEach((i) => todos.add(i));
    }
    return [...todos];
  }, [config.permitirRemoverIngredientes, selectedFlavors, catalogo.sabores]);

  // Tirou o sabor, some o "sem cebola" que era dele.
  useEffect(() => {
    setRemovidos((cur) => {
      const validos = cur.filter((r) => ingredientesDisponiveis.includes(r));
      return validos.length === cur.length ? cur : validos;
    });
  }, [ingredientesDisponiveis]);

  const montagem: MontagemDePizza | null = tamanhoDoCatalogo
    ? {
        tamanho: tamanhoDoCatalogo.chave,
        sabores: selectedFlavors.map((id) => ({ id })),
        bordaId: selectedBorderId,
        adicionais: Object.entries(qtdAdicionais)
          .filter(([, q]) => q > 0)
          .map(([id, q]) => ({ id, quantidade: q })),
        removidos,
        observacao: observacao.trim() || null,
        quantidade,
      }
    : null;
  const resultado = montagem ? calcularPizza(catalogo, montagem) : null;
  const pizza = resultado?.ok ? resultado.pizza : null;
  const erros = resultado && !resultado.ok ? resultado.erros : [];
  const canAdd = !!pizza;

  const totalDeAdicionais = Object.values(qtdAdicionais).reduce((s, q) => s + q, 0);
  const limiteDeAdicionaisAtingido =
    config.maxAdicionaisPorPizza !== null && totalDeAdicionais >= config.maxAdicionaisPorPizza;

  // Numeração das etapas calculada, e não escrita à mão: uma loja sem
  // bordas cadastradas mostraria "1, 2, 4" e pareceria uma etapa perdida.
  const hasBordas = bordas.length > 0;
  const hasAdicionais = adicionaisDaqui.length > 0;
  const hasIngredientes = ingredientesDisponiveis.length > 0;
  let etapa = 2;
  const bordasStepNumber = hasBordas ? ++etapa : 0;
  const adicionaisStepNumber = hasAdicionais ? ++etapa : 0;
  const ingredientesStepNumber = hasIngredientes ? ++etapa : 0;
  const observacaoStepNumber = ++etapa;
  const beveragesStepNumber = ++etapa;

  const toggleFlavor = (id: string) => {
    setSelectedFlavors((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= maxFlavors) return cur;
      return [...cur, id];
    });
  };

  const handleSelectSize = (i: number) => {
    setSizeIdx(i);
    const newMax = sizes[i].max_flavors;
    setSelectedFlavors((cur) => cur.slice(0, newMax));
  };

  const mudarAdicional = (id: string, delta: number, max: number) => {
    setQtdAdicionais((cur) => {
      const atual = cur[id] ?? 0;
      const novo = Math.max(0, Math.min(max, atual + delta));
      if (delta > 0 && limiteDeAdicionaisAtingido) return cur;
      const copia = { ...cur };
      if (novo === 0) delete copia[id];
      else copia[id] = novo;
      return copia;
    });
  };

  const limpar = () => {
    setSelectedFlavors([]);
    setSelectedBorderId(null);
    setQtdAdicionais({});
    setRemovidos([]);
    setObservacao("");
    setQuantidade(1);
    setEditando(null);
  };

  // Reabrir uma pizza do carrinho: o carrinho avisa, e só o montador da
  // categoria de onde ela saiu responde.
  useEffect(() => {
    const onEditar = (ev: Event) => {
      const pedido = (ev as CustomEvent<PedidoDeEdicao>).detail;
      const linha = pedido?.linha;
      if (!linha?.montagem || linha.pizzaCategoryId !== category.id || pedido.atendido) return;
      const m = linha.montagem;
      const idx = sizes.findIndex((s) => chaveDeNome(s.label) === chaveDeNome(m.tamanho));
      if (idx < 0) return;
      pedido.atendido = true;
      setSizeIdx(idx);
      setSelectedFlavors(m.sabores.map((s) => s.id));
      setSelectedBorderId(m.bordaId ?? null);
      setQtdAdicionais(Object.fromEntries((m.adicionais ?? []).map((a) => [a.id, a.quantidade])));
      setRemovidos(m.removidos ?? []);
      setObservacao(m.observacao ?? "");
      setQuantidade(linha.quantity || 1);
      setEditando({ itemId: linha.itemId, sizeLabel: linha.sizeLabel });
      setTimeout(() => rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    };
    window.addEventListener(EVENTO_EDITAR_PIZZA, onEditar);
    return () => window.removeEventListener(EVENTO_EDITAR_PIZZA, onEditar);
  }, [category.id, sizes]);

    const handleAddToCart = (shouldOpenCart = false, event?: React.MouseEvent) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (!pizza || !montagem) return;
      const linha = linhaDaPizza({ categoriaId: category.id, montagem, pizza });
      if (editando) {
        replaceLine(editando, linha, pizza.quantidade);
        setConfirm("Pizza atualizada no carrinho!");
      } else {
        addLine(linha, pizza.quantidade);
        setConfirm("Adicionado ao carrinho!");
      }
      limpar();
      if (shouldOpenCart || editando) setCartOpen(true);
      setTimeout(() => setConfirm(null), 2200);
   };

  if (sizes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--site-border))] p-6 text-center text-[hsl(var(--site-muted-fg))]">
        Nenhum tamanho cadastrado para esta categoria.
      </div>
    );
  }

  const precoDoSabor = (it: MenuItemRow) => {
    if (!precoPorSabor || !tamanhoDoCatalogo) return null;
    const s = catalogo.sabores.find((x) => x.id === it.id);
    return s ? formatarCentavos(precoDoSaborNoTamanho(s, tamanhoDoCatalogo)) : null;
  };
  const precoDaOpcao = (id: string, lista: typeof catalogo.bordas) => {
    const o = lista.find((x) => x.id === id);
    if (!o) return 0;
    return tamanhoDoCatalogo ? precoDaOpcaoNoTamanho(o, tamanhoDoCatalogo) : o.precoCentavos;
  };

  return (
    <div className="space-y-4 sm:space-y-6 relative scroll-mt-24" id={`pizza-builder-${category.id}`} ref={rootRef}>
      {editando && (
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-[hsl(var(--site-primary))] bg-[hsl(var(--site-primary)/0.08)] p-3 sm:p-4 text-sm font-bold text-[hsl(var(--site-fg))]">
          <span className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-[hsl(var(--site-primary))]" /> Editando uma pizza do carrinho
          </span>
          <button onClick={limpar} className="inline-flex items-center gap-1 text-xs underline">
            <X className="h-3.5 w-3.5" /> Cancelar edição
          </button>
        </div>
      )}

      {/* Step 1 — Sizes */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h4 className="text-base sm:text-lg font-bold">1. Escolha o tamanho</h4>
          <span className="text-[10px] sm:text-xs text-[hsl(var(--site-muted-fg))] uppercase tracking-wider">
            {precoPorSabor ? "a partir de" : "preço por tamanho"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          {sizes.map((s, i) => {
            const active = sizeIdx === i;
            return (
               <button
                 key={`${s.label}-${i}`}
                 onClick={() => handleSelectSize(i)}
                 aria-pressed={active}
                 className={`relative rounded-2xl sm:rounded-3xl border p-3 sm:p-5 text-left transition-all duration-300 transform ${
                   active
                     ? "border-[hsl(var(--site-primary))] bg-[hsl(var(--site-primary)/0.05)] shadow-[0_12px_30px_hsl(var(--site-primary)/0.12)] scale-[1.05] z-10 border-2"
                     : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary)/0.3)] hover:bg-[hsl(var(--site-muted))]"
                 }`}
               >
                {active && (
                  <span className="absolute top-2 right-2 sm:top-3 sm:right-3 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))] inline-flex items-center justify-center shadow-lg">
                    <Check className="h-3 sm:h-3.5 w-3 sm:w-3.5 stroke-[3]" />
                  </span>
                )}
                <p className={`font-extrabold text-sm sm:text-lg leading-tight ${active ? "text-[hsl(var(--site-primary))]" : "text-[hsl(var(--site-fg))]"}`}>{s.label}</p>
                <p className="text-[hsl(var(--site-secondary))] font-black text-lg sm:text-xl mt-1">
                  {formatBRL(s.price)}
                </p>
                <p className="text-[10px] sm:text-xs font-medium text-[hsl(var(--site-muted-fg))] mt-0.5">
                  {s.slices ? `${s.slices} fatias · ` : ""}
                  até {s.max_flavors} {s.max_flavors === 1 ? "sabor" : "sabores"}
                </p>
              </button>
            );
          })}
        </div>
        <div className="flex items-start gap-2 text-xs rounded-xl border border-[hsl(var(--site-primary)/0.3)] bg-[hsl(var(--site-primary)/0.05)] text-[hsl(var(--site-primary))] p-3 sm:p-4 font-medium shadow-sm">
          <Info className="h-4 w-4 shrink-0 text-[hsl(var(--site-primary))]" />
          <span>
            {config.regra === "maior_preco" && (
              <>Pizza com mais de um sabor: vale o preço do <strong className="font-extrabold">sabor mais caro</strong>.</>
            )}
            {config.regra === "media_ponderada" && (
              <>Pizza com mais de um sabor: o preço é a <strong className="font-extrabold">média dos sabores</strong>, na proporção de cada um.</>
            )}
            {config.regra === "combinacao" && (
              <>O preço depende da <strong className="font-extrabold">combinação de sabores</strong> escolhida.</>
            )}
            {config.regra === "tamanho_e_especiais" && (
              <>
                Ao selecionar <strong className="font-extrabold">itens especiais</strong>, o valor final poderá ser
                alterado proporcionalmente.
              </>
            )}
          </span>
        </div>
      </div>

      {/* Step 2 — Flavors */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h4 className="text-base sm:text-xl font-extrabold text-[hsl(var(--site-fg))]">2. Escolha os sabores</h4>
          {size && (
            <span className="text-[10px] sm:text-sm font-extrabold px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-[hsl(var(--site-card))] border-2 border-[hsl(var(--site-primary))] text-[hsl(var(--site-primary))] shadow-sm">
              {selectedFlavors.length}/{maxFlavors}
              <span className="hidden xs:inline"> selecionados</span>
              {remaining > 0 && <span className="hidden sm:inline"> · {remaining} restante{remaining > 1 ? "s" : ""}</span>}
            </span>
          )}
        </div>
        {category.items.length === 0 ? (
          <p className="text-xs text-[hsl(var(--site-muted-fg))]">Nenhum sabor cadastrado ainda.</p>
        ) : (
          <div className="space-y-8 sm:space-y-16">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {classicFlavors.map((it) => (
                <FlavorCard
                  key={it.id}
                  it={it}
                  checked={selectedFlavors.includes(it.id)}
                  disabled={!size || (!selectedFlavors.includes(it.id) && selectedFlavors.length >= maxFlavors)}
                  size={size}
                  toggleFlavor={toggleFlavor}
                  restaurant={restaurant}
                  precoNoTamanho={precoDoSabor(it)}
                />
              ))}
            </div>

            {specialFlavors.length > 0 && (
              <div className="space-y-4 sm:space-y-8" id="sabores-especiais">
                <div className="relative overflow-hidden rounded-[1.5rem] sm:rounded-[2.5rem] bg-gradient-to-br from-[hsl(var(--site-primary))] to-[hsl(var(--site-primary)/0.7)] p-6 sm:p-10 shadow-[0_20px_50px_hsl(var(--site-primary)/0.3)] border border-white/10">
                  <div className="absolute top-0 right-0 p-4 sm:p-8 opacity-10">
                    <Sparkles className="h-24 w-24 sm:h-40 sm:w-40 text-white" />
                  </div>
                  <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
                    <div>
                      <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                        <span className="flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md">
                          <Flame className="h-5 w-5 sm:h-6 sm:w-6 text-[hsl(var(--site-primary-fg))]" />
                        </span>
                        <h3 className="text-xl sm:text-4xl font-black text-white tracking-tighter uppercase italic">
                          Destaques Especiais
                        </h3>
                      </div>
                      <p className="text-white/90 font-medium max-w-lg text-sm sm:text-lg">
                        Experimente nossas opções premium e exclusivos.
                      </p>
                    </div>
                    <span className="px-4 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl bg-[hsl(var(--site-card))] text-[hsl(var(--site-primary))] font-black text-[10px] sm:text-sm uppercase tracking-widest shadow-xl">
                      Seleção Gourmet
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {specialFlavors.map((it) => (
                    <FlavorCard
                      key={it.id}
                      it={it}
                      isSpecialSection
                      checked={selectedFlavors.includes(it.id)}
                      disabled={!size || (!selectedFlavors.includes(it.id) && selectedFlavors.length >= maxFlavors)}
                      size={size}
                      toggleFlavor={toggleFlavor}
                      restaurant={restaurant}
                      precoNoTamanho={precoDoSabor(it)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bordas */}
      {hasBordas && (
        <div className="space-y-3" ref={bordasRef}>
          <div className="flex items-baseline justify-between">
            <h4 className="text-base sm:text-lg font-bold">
              {bordasStepNumber}. Escolha a borda {config.bordaObrigatoria ? "(obrigatório)" : "(opcional)"}
            </h4>
            {scrollMessage && scrollMessage.includes("escolha") && (
              <span className="text-[10px] sm:text-xs font-bold text-[hsl(var(--site-primary))] animate-bounce">
                {scrollMessage}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {!config.bordaObrigatoria && (
              <button
                onClick={() => setSelectedBorderId(null)}
                aria-pressed={selectedBorderId === null}
                className={`${cardBase} ${selectedBorderId === null ? cardAtivo : cardInativo}`}
              >
                {selectedBorderId === null && <Marcado />}
                <p className="font-extrabold text-sm sm:text-base text-[hsl(var(--site-fg))] leading-tight">Sem Borda</p>
                <p className="text-[hsl(var(--site-secondary))] font-black text-sm sm:text-base mt-0.5">Grátis</p>
              </button>
            )}
            {bordas.map((b) => {
              const active = selectedBorderId === b.id;
              const preco = precoDaOpcao(b.id, catalogo.bordas);
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBorderId(b.id)}
                  aria-pressed={active}
                  className={`${cardBase} ${active ? cardAtivo : cardInativo}`}
                >
                  {active && <Marcado />}
                  <p className="font-extrabold text-sm sm:text-base text-[hsl(var(--site-fg))] leading-tight">{b.name}</p>
                  <p className="text-[hsl(var(--site-secondary))] font-black text-sm sm:text-base mt-0.5">
                    {preco > 0 ? `+${formatarCentavos(preco)}` : "Grátis"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Adicionais — escolha múltipla, com quantidade quando o lojista permite */}
      {hasAdicionais && (
        <div className="space-y-3" ref={adicionaisRef}>
          <div className="flex items-baseline justify-between">
            <h4 className="text-base sm:text-lg font-bold">{adicionaisStepNumber}. Adicionais (opcional)</h4>
            {pizza && pizza.adicionais.length > 0 && (
              <span className="text-[10px] sm:text-xs font-bold text-[hsl(var(--site-secondary))]">
                +{formatarCentavos(pizza.adicionais.reduce((s, a) => s + a.totalCentavos, 0))}
              </span>
            )}
          </div>
          <p className="text-xs text-[hsl(var(--site-muted-fg))]">
            Pode escolher mais de um.
            {config.maxAdicionaisPorPizza !== null && ` Máximo de ${config.maxAdicionaisPorPizza} por pizza.`}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {catalogo.adicionais.map((a) => {
              const qtd = qtdAdicionais[a.id] ?? 0;
              const active = qtd > 0;
              const preco = precoDaOpcao(a.id, catalogo.adicionais);
              const podeMais = qtd < a.maxQuantidade && !limiteDeAdicionaisAtingido;
              if (a.maxQuantidade <= 1) {
                return (
                  <button
                    key={a.id}
                    aria-pressed={active}
                    disabled={!active && !podeMais}
                    onClick={() => mudarAdicional(a.id, active ? -1 : 1, 1)}
                    className={`${cardBase} ${active ? cardAtivo : cardInativo} disabled:opacity-40`}
                  >
                    {active && <Marcado />}
                    <p className="font-extrabold text-sm sm:text-base text-[hsl(var(--site-fg))] leading-tight">{a.nome}</p>
                    <p className="text-[hsl(var(--site-secondary))] font-black text-sm sm:text-base mt-0.5">+{formatarCentavos(preco)}</p>
                  </button>
                );
              }
              return (
                <div key={a.id} className={`${cardBase} ${active ? cardAtivo : cardInativo}`}>
                  <p className="font-extrabold text-sm sm:text-base text-[hsl(var(--site-fg))] leading-tight">{a.nome}</p>
                  <p className="text-[hsl(var(--site-secondary))] font-black text-sm sm:text-base mt-0.5">+{formatarCentavos(preco)} cada</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      aria-label={`Tirar um ${a.nome}`}
                      disabled={qtd === 0}
                      onClick={() => mudarAdicional(a.id, -1, a.maxQuantidade)}
                      className="h-8 w-8 site-btn-secondary !rounded-lg flex items-center justify-center disabled:opacity-30"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center font-black">{qtd}</span>
                    <button
                      aria-label={`Mais um ${a.nome}`}
                      disabled={!podeMais}
                      onClick={() => mudarAdicional(a.id, 1, a.maxQuantidade)}
                      className="h-8 w-8 site-btn-primary !rounded-lg flex items-center justify-center disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-[10px] text-[hsl(var(--site-muted-fg))]">até {a.maxQuantidade}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Retirar ingredientes */}
      {hasIngredientes && (
        <div className="space-y-3">
          <h4 className="text-base sm:text-lg font-bold">{ingredientesStepNumber}. Quer tirar algum ingrediente?</h4>
          <p className="text-xs text-[hsl(var(--site-muted-fg))]">Toque para retirar. Retirar ingrediente não altera o preço.</p>
          <div className="flex flex-wrap gap-2">
            {ingredientesDisponiveis.map((ing) => {
              const tirado = removidos.includes(ing);
              return (
                <button
                  key={ing}
                  aria-pressed={tirado}
                  onClick={() =>
                    setRemovidos((cur) => (cur.includes(ing) ? cur.filter((x) => x !== ing) : [...cur, ing]))
                  }
                  className={`px-3 py-2 rounded-full border text-sm font-bold transition ${
                    tirado
                      ? "border-destructive bg-destructive/10 text-destructive line-through"
                      : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] text-[hsl(var(--site-fg))]"
                  }`}
                >
                  {tirado ? `Sem ${ing}` : ing}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Observação */}
      <div className="space-y-2">
        <h4 className="text-base sm:text-lg font-bold">{observacaoStepNumber}. Observação (opcional)</h4>
        <textarea
          value={observacao}
          maxLength={LIMITES.observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={2}
          placeholder="Ex.: bem assada, cortar em 12 pedaços"
          className="w-full rounded-xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] text-[hsl(var(--site-fg))] p-3 text-sm"
        />
        <p className="text-[10px] text-right text-[hsl(var(--site-muted-fg))]">
          {observacao.length}/{LIMITES.observacao}
        </p>
      </div>

      {/* Beverages */}
      {beverages && beverages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h4 className="text-base sm:text-lg font-bold flex items-center gap-2">
              {beveragesStepNumber}. Acompanhamentos <GlassWater className="h-4 w-4 text-[hsl(var(--site-primary))]" />
            </h4>
          </div>
          <div className="bg-[hsl(var(--site-muted))] rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-8">
            <SiteBeverageSection beverages={beverages} catalogs={beverageCatalogs} restaurant={restaurant!} />
          </div>
        </div>
      )}

      {/* Resumo + adicionar */}
      <div
        id={`summary-${category.id}`}
        ref={summaryRef}
        className="rounded-[1.5rem] sm:rounded-[2.5rem] border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] p-5 sm:p-10 shadow-[0_20px_60px_hsl(var(--site-bg)/0.3)] relative"
      >
        {scrollMessage && scrollMessage.includes("pronto") && (
          <div className="absolute top-3 right-6 z-10">
            <span className="text-xs sm:text-sm font-bold text-[hsl(var(--site-primary))] animate-pulse">{scrollMessage}</span>
          </div>
        )}
        <div className="absolute top-0 right-0 p-6 sm:p-10 opacity-5">
          <ShoppingBag className="h-20 w-20 sm:h-32 sm:w-32 text-[hsl(var(--site-primary))]" />
        </div>
        <h4 className="text-xl sm:text-2xl font-black mb-4 sm:mb-6 tracking-tight text-[hsl(var(--site-fg))]">Resumo da sua Pizza</h4>
        {size ? (
          <ul className="text-sm sm:text-base text-[hsl(var(--site-muted-fg))] space-y-1.5 sm:space-y-2">
            <li className="flex justify-between items-center border-b border-[hsl(var(--site-border))] pb-1.5 sm:pb-2">
              <span className="font-medium">Tamanho: <strong className="text-[hsl(var(--site-fg))] font-extrabold">{size.label}</strong></span>
            </li>
            <li className="flex flex-col border-b border-[hsl(var(--site-border))] pb-1.5 sm:pb-2">
              <span className="font-medium">Sabores:</span>
              {pizza ? (
                pizza.sabores.map((s) => (
                  <span key={s.id} className="flex justify-between text-[hsl(var(--site-fg))] font-extrabold">
                    <span>
                      {s.nome}
                      {pizza.sabores.length > 1 ? ` — ${s.fracao}` : " (inteira)"}
                    </span>
                    {precoPorSabor && <span className="font-medium text-[hsl(var(--site-muted-fg))]">{formatarCentavos(s.precoNoTamanhoCentavos)}</span>}
                  </span>
                ))
              ) : (
                <span className="text-[hsl(var(--site-fg))] font-extrabold">
                  {selectedFlavors.length === 0
                    ? "Nenhum selecionado"
                    : selectedFlavors.map((id) => flavorMap.get(id)?.name).filter(Boolean).join(" + ")}
                </span>
              )}
            </li>
            {pizza && (
              <li className="flex justify-between items-center border-b border-[hsl(var(--site-border))] pb-1.5 sm:pb-2">
                <span className="font-medium">
                  Pizza
                  {pizza.sabores.length > 1 && (
                    <span className="block text-[10px] uppercase tracking-wider">{NOMES_DAS_REGRAS[pizza.regraAplicada]}</span>
                  )}
                </span>
                <span className="font-extrabold text-[hsl(var(--site-fg))]">{formatarCentavos(pizza.precoSaboresCentavos)}</span>
              </li>
            )}
            {pizza?.borda && (
              <li className="flex justify-between items-center border-b border-[hsl(var(--site-border))] pb-1.5 sm:pb-2 text-[hsl(var(--site-secondary))]">
                <span className="font-medium">Borda: <strong className="font-extrabold">{pizza.borda.nome}</strong></span>
                <span className="font-extrabold">+{formatarCentavos(pizza.borda.precoCentavos)}</span>
              </li>
            )}
            {pizza?.adicionais.map((a) => (
              <li key={a.id} className="flex justify-between items-center gap-3 border-b border-[hsl(var(--site-border))] pb-1.5 sm:pb-2 text-[hsl(var(--site-secondary))]">
                <span className="font-medium">
                  Adicional: <strong className="font-extrabold">{a.nome}{a.quantidade > 1 ? ` x${a.quantidade}` : ""}</strong>
                </span>
                <span className="font-extrabold whitespace-nowrap">+{formatarCentavos(a.totalCentavos)}</span>
              </li>
            ))}
            {pizza && pizza.removidos.length > 0 && (
              <li className="border-b border-[hsl(var(--site-border))] pb-1.5 sm:pb-2">
                <span className="font-medium">Sem: <strong className="text-[hsl(var(--site-fg))]">{pizza.removidos.join(", ")}</strong></span>
              </li>
            )}
            {pizza?.observacao && (
              <li className="border-b border-[hsl(var(--site-border))] pb-1.5 sm:pb-2">
                <span className="font-medium">Obs.: <span className="text-[hsl(var(--site-fg))]">{pizza.observacao}</span></span>
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm sm:text-base text-[hsl(var(--site-muted-fg))] font-medium">Selecione um tamanho para ver o resumo.</p>
        )}

        {/* O que falta: em vez de um botão apagado sem explicação. */}
        {selectedFlavors.length > 0 && erros.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
            {erros.map((e, i) => (
              <li key={`${e.codigo}-${i}`} className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {e.mensagem}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-4 sm:gap-6 mt-6 sm:mt-10 pt-6 sm:pt-8 border-t-2 border-dashed border-[hsl(var(--site-border))] flex-wrap">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[hsl(var(--site-muted-fg))] font-bold">
              Total {pizza && pizza.quantidade > 1 ? `(${pizza.quantidade} pizzas)` : ""}
            </span>
            <span className="text-2xl sm:text-4xl font-black text-[hsl(var(--site-secondary))]">
              {pizza ? formatarCentavos(pizza.totalCentavos) : "—"}
            </span>
            <div className="flex items-center gap-2">
              <button
                aria-label="Uma pizza a menos"
                disabled={quantidade <= 1}
                onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                className="h-8 w-8 site-btn-secondary !rounded-lg flex items-center justify-center disabled:opacity-30"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center font-black text-[hsl(var(--site-fg))]">{quantidade}</span>
              <button
                aria-label="Uma pizza a mais"
                disabled={quantidade >= LIMITES.quantidade}
                onClick={() => setQuantidade((q) => Math.min(LIMITES.quantidade, q + 1))}
                className="h-8 w-8 site-btn-primary !rounded-lg flex items-center justify-center disabled:opacity-30"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
            <button
              onClick={(e) => handleAddToCart(false, e)}
              disabled={!canAdd}
              className="site-btn-primary px-6 py-4 sm:px-10 sm:py-6 rounded-full text-base sm:text-xl flex items-center gap-3 sm:gap-4 disabled:opacity-30 disabled:scale-100 disabled:shadow-none uppercase tracking-widest active:scale-95 transition-all group shadow-xl"
            >
              <Plus className="h-5 w-5 sm:h-7 sm:w-7 text-[hsl(var(--site-primary-fg))] group-hover:rotate-90 transition-transform" />
              <span>{editando ? "Salvar alterações" : "Adicionar ao Pedido"}</span>
            </button>
        </div>
        {confirm && (
          <div className="mt-4 sm:mt-6 text-sm sm:text-base font-bold text-[hsl(var(--site-success))] bg-[hsl(var(--site-success)/0.1)] border-2 border-[hsl(var(--site-success)/0.2)] rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center animate-in zoom-in duration-300">
            ✓ {confirm}
          </div>
        )}
      </div>

      <div className="h-8 sm:h-12" />
    </div>
  );
}

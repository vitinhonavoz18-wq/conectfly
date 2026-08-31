/**
 * O motor de layouts do cardápio.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 *
 * Até aqui, todo cardápio tinha a mesma estrutura: capa, pizzas, combos,
 * categorias, bebidas — sempre nessa ordem, sempre com o mesmo tamanho de
 * card. Trocava a cor e pronto. Só que uma adega não vende como uma
 * pizzaria: quem entra numa adega já sabe o que quer e procura pelo nome;
 * quem entra numa pizzaria quer VER os sabores. Uma farmácia precisa de uma
 * busca gritante; uma padaria precisa de "café da manhã" logo de cara.
 *
 * É a diferença entre o balcão da padaria e a prateleira do mercado: os dois
 * vendem, mas ninguém organiza os dois do mesmo jeito.
 *
 * COMO FUNCIONA
 *
 * Duas coisas separadas, de propósito:
 *
 * - SEGMENTO (`business_type`): o que o estabelecimento É. "Pizzaria".
 * - LAYOUT (`site_settings.menu_layout`): como o cardápio se ORGANIZA.
 *
 * O segmento recomenda um layout. O lojista pode trocar depois sem deixar de
 * ser pizzaria — e é isso que vai permitir, no futuro, ter "Pizza Clássica",
 * "Pizza Moderna" e "Pizza Escura" sem mexer no tipo da empresa.
 *
 * Nada aqui toca em dados: todos os layouts leem exatamente as mesmas
 * categorias, produtos, adicionais e carrinho. Layout é só a vitrine.
 */

import type { ModoDeNavegacao } from "./menuBehavior";

/** Os blocos que um cardápio pode montar, na ordem que o layout mandar. */
export type BlocoDoCardapio =
  "capa" | "busca" | "categorias" | "populares" | "pizzas" | "combos" | "cardapio" | "bebidas";

export type EstiloDeCard = "vitrine" | "padrao" | "compacto" | "prateleira";

export type ConfigDeLayout = {
  id: LayoutId;
  /** O nome que o lojista vê no painel. */
  nome: string;
  descricao: string;
  /** A ordem em que os blocos aparecem. Bloco fora desta lista não é montado. */
  ordem: readonly BlocoDoCardapio[];
  estiloDeCard: EstiloDeCard;
  /** Quantas colunas de produto no computador. No celular quem manda é a tela. */
  colunas: 1 | 2 | 3 | 4;
  /** Busca no topo, grande, antes de qualquer categoria. */
  buscaEmDestaque: boolean;
  /** O texto do botão de comprar. Muda a expectativa de quem lê. */
  ctaProduto: string;
  /** Mostra "12 peças" e afins no card — vale para sushi e para packs. */
  mostraQuantidade: boolean;
  /**
   * O modo de navegação que combina com este layout — uma SUGESTÃO, não uma
   * ordem. Vale só para a loja que nunca escolheu nada na aba Comportamento.
   * Se o lojista escolheu, a escolha dele ganha sempre. Ver
   * `resolverModoDeNavegacao` em `menuBehavior.ts`.
   *
   * Ausente = usa o padrão global (rolagem única).
   */
  modoDeNavegacaoPadrao?: ModoDeNavegacao;
};

export type LayoutId =
  | "generic"
  | "pizza"
  | "burger"
  | "acai"
  | "restaurant"
  | "japanese"
  | "bakery"
  | "beverage"
  | "pharmacy"
  | "market";

/**
 * O layout de referência: exatamente a estrutura que todo cardápio tinha
 * antes deste sistema existir.
 *
 * Ele é o ponto de partida de todos os outros e o destino de quem não tem
 * segmento reconhecido. Mexer aqui muda o cardápio de quem nunca escolheu
 * nada — então mexa com cuidado.
 */
const GENERICO: ConfigDeLayout = {
  id: "generic",
  nome: "Padrão",
  descricao: "A organização clássica do FlyControl, que serve para qualquer negócio.",
  ordem: ["capa", "pizzas", "combos", "cardapio", "bebidas"],
  estiloDeCard: "padrao",
  colunas: 2,
  buscaEmDestaque: false,
  ctaProduto: "Adicionar",
  mostraQuantidade: false,
};

export const MENU_LAYOUTS: Readonly<Record<LayoutId, ConfigDeLayout>> = {
  generic: GENERICO,

  pizza: {
    ...GENERICO,
    id: "pizza",
    nome: "Pizzaria",
    descricao: "Sabores em destaque, monte sua pizza logo no começo e combos em evidência.",
    // Pizza primeiro, sempre: é o que a pessoa veio ver.
    ordem: ["capa", "pizzas", "populares", "combos", "cardapio", "bebidas"],
    estiloDeCard: "vitrine",
    colunas: 2,
    ctaProduto: "Escolher pizza",
  },

  burger: {
    ...GENERICO,
    id: "burger",
    nome: "Hamburgueria",
    descricao: "Foto grande, mais pedidos no topo e compra em um toque.",
    ordem: ["capa", "populares", "cardapio", "combos", "bebidas"],
    estiloDeCard: "vitrine",
    colunas: 2,
    ctaProduto: "Adicionar",
  },

  acai: {
    ...GENERICO,
    id: "acai",
    nome: "Açaí e sorveteria",
    descricao: "Tamanhos e complementos primeiro — a montagem é o produto.",
    ordem: ["capa", "cardapio", "populares", "combos", "bebidas"],
    estiloDeCard: "vitrine",
    colunas: 2,
    ctaProduto: "Montar meu açaí",
  },

  restaurant: {
    ...GENERICO,
    id: "restaurant",
    // Cardápio grande: escolher a categoria antes evita rolar a loja inteira.
    modoDeNavegacaoPadrao: "navigation",
    nome: "Restaurante",
    descricao: "Categorias organizadas e espaço para descrever bem cada prato.",
    ordem: ["capa", "categorias", "populares", "cardapio", "combos", "bebidas"],
    estiloDeCard: "padrao",
    colunas: 2,
    ctaProduto: "Adicionar",
  },

  japanese: {
    ...GENERICO,
    id: "japanese",
    // Cardápio grande: escolher a categoria antes evita rolar a loja inteira.
    modoDeNavegacaoPadrao: "navigation",
    nome: "Japonês e sushi",
    descricao: "Combinados em destaque e a quantidade de peças visível no card.",
    ordem: ["capa", "combos", "categorias", "populares", "cardapio", "bebidas"],
    estiloDeCard: "padrao",
    colunas: 2,
    mostraQuantidade: true,
    ctaProduto: "Adicionar",
  },

  bakery: {
    ...GENERICO,
    id: "bakery",
    // Cardápio grande: escolher a categoria antes evita rolar a loja inteira.
    modoDeNavegacaoPadrao: "navigation",
    nome: "Padaria e cafeteria",
    descricao: "Compra rápida, com mais itens à vista e busca por perto.",
    ordem: ["capa", "busca", "populares", "categorias", "cardapio", "bebidas"],
    estiloDeCard: "compacto",
    colunas: 3,
    ctaProduto: "Adicionar",
  },

  beverage: {
    ...GENERICO,
    id: "beverage",
    // Cardápio grande: escolher a categoria antes evita rolar a loja inteira.
    modoDeNavegacaoPadrao: "navigation",
    nome: "Adega e distribuidora",
    descricao: "Busca em primeiro lugar e prateleira de produtos, como uma loja.",
    // A capa vem sempre primeiro — é a identidade da loja, e nenhum layout
    // pode engolir a logo. Depois dela, a busca: quem compra bebida procura
    // pelo nome, não rola a tela.
    ordem: ["capa", "busca", "categorias", "populares", "cardapio", "bebidas", "combos"],
    estiloDeCard: "prateleira",
    colunas: 3,
    buscaEmDestaque: true,
    mostraQuantidade: true,
    ctaProduto: "Adicionar",
  },

  pharmacy: {
    ...GENERICO,
    id: "pharmacy",
    // Cardápio grande: escolher a categoria antes evita rolar a loja inteira.
    modoDeNavegacaoPadrao: "navigation",
    nome: "Farmácia",
    descricao: "Catálogo com busca no topo, do jeito que se procura remédio.",
    ordem: ["capa", "busca", "categorias", "cardapio", "populares", "combos", "bebidas"],
    estiloDeCard: "prateleira",
    colunas: 3,
    buscaEmDestaque: true,
    mostraQuantidade: true,
    ctaProduto: "Adicionar",
  },

  market: {
    ...GENERICO,
    id: "market",
    // Cardápio grande: escolher a categoria antes evita rolar a loja inteira.
    modoDeNavegacaoPadrao: "navigation",
    nome: "Mercado e conveniência",
    descricao: "Muitas categorias, muitos itens na tela e carrinho sempre à mão.",
    ordem: ["capa", "busca", "categorias", "cardapio", "populares", "combos", "bebidas"],
    estiloDeCard: "compacto",
    colunas: 4,
    buscaEmDestaque: true,
    mostraQuantidade: true,
    ctaProduto: "Adicionar",
  },
} as const;

// ---------------------------------------------------------------------------
// Segmentos
// ---------------------------------------------------------------------------

export type SegmentoId =
  | "pizzaria"
  | "hamburgueria"
  | "acai"
  | "restaurante"
  | "japones"
  | "padaria"
  | "adega"
  | "farmacia"
  | "mercado"
  | "outro";

export type Segmento = {
  id: SegmentoId;
  rotulo: string;
  layoutRecomendado: LayoutId;
  /**
   * O que já está gravado hoje em `business_type`, em texto livre. Serve para
   * reconhecer as lojas antigas sem obrigar ninguém a recadastrar nada.
   */
  apelidos: readonly string[];
};

export const SEGMENTOS: readonly Segmento[] = [
  {
    id: "pizzaria",
    rotulo: "Pizzaria",
    layoutRecomendado: "pizza",
    apelidos: ["pizzaria", "pizza", "pizzas"],
  },
  {
    id: "hamburgueria",
    rotulo: "Hamburgueria / Lanchonete",
    layoutRecomendado: "burger",
    apelidos: ["hamburgueria", "burger", "lanchonete", "lanches", "pastelaria"],
  },
  {
    id: "acai",
    rotulo: "Açaí / Sorveteria",
    layoutRecomendado: "acai",
    apelidos: ["acaiteria", "acai", "sorveteria", "sorvetes", "gelateria"],
  },
  {
    id: "restaurante",
    rotulo: "Restaurante",
    layoutRecomendado: "restaurant",
    apelidos: ["restaurante", "restaurant", "marmitaria", "self service"],
  },
  {
    id: "japones",
    rotulo: "Japonês / Sushi",
    layoutRecomendado: "japanese",
    apelidos: ["japones", "japonesa", "sushi", "temakeria", "oriental"],
  },
  {
    id: "padaria",
    rotulo: "Padaria / Cafeteria",
    layoutRecomendado: "bakery",
    apelidos: ["padaria", "panificadora", "cafeteria", "cafe", "confeitaria"],
  },
  {
    id: "adega",
    rotulo: "Adega / Distribuidora",
    layoutRecomendado: "beverage",
    apelidos: ["adega", "distribuidora", "bebidas", "choperia", "bar"],
  },
  {
    id: "farmacia",
    rotulo: "Farmácia",
    layoutRecomendado: "pharmacy",
    apelidos: ["farmacia", "drogaria"],
  },
  {
    id: "mercado",
    rotulo: "Mercado / Conveniência",
    layoutRecomendado: "market",
    apelidos: ["mercado", "mercadinho", "supermercado", "conveniencia", "empório", "emporio"],
  },
  {
    id: "outro",
    rotulo: "Outro",
    layoutRecomendado: "generic",
    apelidos: ["outro", "outros", "generico"],
  },
] as const;

/** Tira acento e caixa, para "Açaíteria" e "acaiteria" caírem no mesmo lugar. */
function simplificar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/**
 * Descobre o segmento a partir do que está gravado em `business_type`.
 *
 * Devolve `null` quando não reconhece — e aí quem chama decide o que fazer.
 * Chutar um segmento seria pior: a loja apareceria organizada como outra
 * coisa sem ninguém ter pedido.
 */
export function segmentoDe(businessType: unknown): Segmento | null {
  if (typeof businessType !== "string") return null;
  const alvo = simplificar(businessType);
  if (!alvo) return null;

  const exato = SEGMENTOS.find((s) => s.id === alvo || s.apelidos.includes(alvo));
  if (exato) return exato;

  // Nada exato: aceita "Pizzaria do Zé" caindo em pizzaria. A busca é pela
  // palavra mais longa primeiro, senão "bar" casaria dentro de "barbearia".
  const porPedaco = [...SEGMENTOS]
    .flatMap((s) => s.apelidos.map((a) => ({ segmento: s, apelido: a })))
    .sort((a, b) => b.apelido.length - a.apelido.length)
    .find(({ apelido }) => apelido.length >= 4 && alvo.includes(apelido));

  return porPedaco?.segmento ?? null;
}

export function ehLayoutConhecido(valor: unknown): valor is LayoutId {
  return typeof valor === "string" && valor in MENU_LAYOUTS;
}

type LojaParaLayout = {
  business_type?: unknown;
  site_settings?: { menu_layout?: unknown } | null;
};

/**
 * O layout que este cardápio deve usar.
 *
 * A ordem importa:
 *
 * 1. A escolha explícita do lojista, se ele fez alguma.
 * 2. O layout recomendado para o segmento dele.
 * 3. O padrão — que é exatamente o cardápio de antes.
 *
 * Nunca lança e nunca devolve nada inválido: cardápio no ar não pode quebrar
 * porque alguém digitou um nome de segmento que o sistema não conhece.
 */
export function resolverLayout(loja: LojaParaLayout | null | undefined): ConfigDeLayout {
  const escolhido = loja?.site_settings?.menu_layout;
  if (ehLayoutConhecido(escolhido)) return MENU_LAYOUTS[escolhido];

  const segmento = segmentoDe(loja?.business_type);
  if (segmento) return MENU_LAYOUTS[segmento.layoutRecomendado];

  return MENU_LAYOUTS.generic;
}

/** As classes de grade de cada estilo de card. Mobile primeiro, sempre. */
export function classesDaGrade(layout: ConfigDeLayout): string {
  if (layout.colunas === 4) return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  if (layout.colunas === 3) return "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3";
  if (layout.colunas === 1) return "grid-cols-1";
  return "grid-cols-1 sm:grid-cols-2";
}

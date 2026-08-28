import type { MenuCategoryRow, MenuItemRow } from "./types";

/**
 * A busca do cardápio.
 *
 * Numa pizzaria ela é dispensável — são doze sabores, a pessoa rola a tela.
 * Numa farmácia ou num mercado ela é o cardápio inteiro: ninguém rola até
 * achar "Dipirona 500mg" no meio de oitocentos itens. Por isso a busca é uma
 * das coisas que o layout do segmento decide destacar ou esconder.
 *
 * A conta fica aqui fora do componente para poder ser testada sozinha: é ela
 * que decide o que o cliente encontra, e errar aqui é o cliente achar que a
 * loja não vende o produto que ela vende.
 */

export type ResultadoDaBusca = {
  item: MenuItemRow;
  categoria: MenuCategoryRow;
};

/** Tira acento, caixa e espaço sobrando — "açaí" acha "acai" e vice-versa. */
export function simplificarTexto(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Quantos caracteres a pessoa precisa digitar antes de a busca valer. */
export const MINIMO_PARA_BUSCAR = 2;

/**
 * Procura por nome e por descrição, em todas as categorias.
 *
 * A ordem do resultado não é aleatória: quem começa com o que foi digitado
 * vem antes de quem só contém no meio. Quem digita "coca" quer a Coca-Cola
 * primeiro, não a "Torta de coco com cacau".
 */
export function buscarNoCardapio(
  categorias: (MenuCategoryRow & { items: MenuItemRow[] })[],
  termo: string,
  limite = 40,
): ResultadoDaBusca[] {
  const alvo = simplificarTexto(termo);
  if (alvo.length < MINIMO_PARA_BUSCAR) return [];

  const achados: Array<ResultadoDaBusca & { peso: number }> = [];

  for (const categoria of categorias) {
    for (const item of categoria.items ?? []) {
      if (item.is_active === false) continue;

      const nome = simplificarTexto(item.name);
      const descricao = simplificarTexto(item.description);

      let peso = -1;
      if (nome.startsWith(alvo)) peso = 0;
      else if (nome.includes(alvo)) peso = 1;
      else if (simplificarTexto(categoria.name).includes(alvo)) peso = 2;
      else if (descricao.includes(alvo)) peso = 3;

      if (peso >= 0) achados.push({ item, categoria, peso });
    }
  }

  return achados
    .sort((a, b) => a.peso - b.peso || a.item.name.localeCompare(b.item.name, "pt-BR"))
    .slice(0, limite)
    .map(({ item, categoria }) => ({ item, categoria }));
}

/**
 * Os "mais pedidos".
 *
 * O cardápio não guarda quantas vezes cada item foi vendido, então inventar
 * um ranking seria mentir para o cliente. O que existe de verdade é a
 * marcação de destaque (`is_special`) e a ordem que o dono definiu — e é
 * exatamente isso que este bloco mostra: o que a loja escolheu destacar.
 *
 * Devolve vazio quando não há nada marcado. Melhor não mostrar o bloco do que
 * mostrar seis produtos aleatórios sob o título "mais pedidos".
 */
export function destaquesDoCardapio(
  categorias: (MenuCategoryRow & { items: MenuItemRow[] })[],
  limite = 6,
): MenuItemRow[] {
  const marcados = categorias
    .flatMap((c) => c.items ?? [])
    .filter((i) => i.is_active !== false && i.is_special);

  return marcados.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).slice(0, limite);
}

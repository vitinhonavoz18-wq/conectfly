/**
 * Quais adicionais aparecem em cada produto.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 *
 * O cliente abria qualquer produto e recebia a lista inteira de adicionais da
 * loja. Numa pastelaria que também vende açaí, quem ia pedir açaí era
 * oferecido bacon, e quem ia pedir pastel era oferecido leite ninho.
 *
 * Era o garçom levando a bandeja inteira de acompanhamentos para todas as
 * mesas: a mesa da sobremesa não quer ver a farofa.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * A REGRA QUE PROTEGE QUEM JÁ ESTÁ VENDENDO
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ADICIONAL SEM NENHUM VÍNCULO APARECE EM TODAS AS CATEGORIAS.
 *
 * No dia em que isto entrou no ar, nenhum adicional tinha vínculo — e nenhum
 * podia sumir do cardápio de ninguém. Inverter esta regra apagaria os
 * adicionais de todas as lojas de uma vez, e o dono só descobriria pelo
 * cliente ligando para perguntar cadê o bacon.
 *
 * Quem cria vínculo é o lojista, pelo FlyControl.
 */

/** Adicional → em quais categorias ele vale. Vindo de `menu_addon_categories`. */
export type VinculosDeAdicional = Record<string, string[]>;

export function montarVinculos(
  linhas: { addon_item_id: string; category_id: string }[] | null | undefined,
): VinculosDeAdicional {
  const mapa: VinculosDeAdicional = {};
  for (const linha of linhas ?? []) {
    if (!linha?.addon_item_id || !linha?.category_id) continue;
    (mapa[linha.addon_item_id] ??= []).push(linha.category_id);
  }
  return mapa;
}

/**
 * Filtra a lista de adicionais para o produto que está na tela.
 *
 * `categoriaDoProduto` nulo (produto sem categoria) recebe só os adicionais
 * globais: sem categoria não há como saber a qual grupo ele pertence, e
 * mostrar tudo seria voltar ao problema.
 */
export function adicionaisDaCategoria<T extends { id: string }>(
  adicionais: T[],
  categoriaDoProduto: string | null | undefined,
  vinculos: VinculosDeAdicional | undefined,
): T[] {
  if (!vinculos) return adicionais;

  return adicionais.filter((a) => {
    const categorias = vinculos[a.id];
    // Sem vínculo: vale em todo o cardápio.
    if (!categorias || categorias.length === 0) return true;
    if (!categoriaDoProduto) return false;
    return categorias.includes(categoriaDoProduto);
  });
}

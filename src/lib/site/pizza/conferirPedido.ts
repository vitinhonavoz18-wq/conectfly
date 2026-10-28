/**
 * Confere, no servidor, as pizzas de um pedido antes de ele seguir para o
 * FlyControl.
 *
 * O PROBLEMA
 *
 * O preço que chega do navegador é o que o navegador diz. Qualquer pessoa com
 * um mínimo de jeito consegue mandar "pizza grande, R$ 1,00". Aceitar esse
 * número é o caixa cobrar o valor que o cliente escreveu no guardanapo.
 *
 * O QUE ESTA FUNÇÃO FAZ
 *
 * Para cada pizza montada no configurador (item com `montagem`), refaz a conta
 * com o cardápio OFICIAL, lido do banco, e:
 *   - se a montagem for inválida (sabor que saiu do cardápio, tamanho
 *     desativado…), recusa e diz o motivo;
 *   - se o preço mudou desde que o cliente montou (o lojista reajustou no
 *     meio do caminho), recusa e devolve o preço novo — quem decide pagar o
 *     novo valor é o cliente, nunca o sistema em silêncio;
 *   - se tudo bate, troca o item pela versão oficial: preço do servidor e a
 *     fotografia completa da pizza (`pizza`), que é o que fica gravado.
 *
 * Também confere se o subtotal do pedido é a soma dos itens. Itens que não
 * vieram do configurador (bebidas, combos, pizzas do formato antigo) passam
 * como antes — a conferência deles não é escopo desta função.
 *
 * A leitura do banco vem de fora (`carregarCatalogo`), para a regra poder ser
 * testada sem banco nenhum.
 */

import {
  calcularPizza,
  centavosParaReais,
  reaisParaCentavos,
  registrarPizza,
  type CatalogoDePizza,
  type ErroDeMontagem,
  type MontagemDePizza,
  type RegistroDaPizza,
} from "./motorDePreco";

export type ItemDoPedido = Record<string, unknown> & {
  type?: string;
  name?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  /** Categoria de pizza de onde a montagem saiu (o cardápio dela). */
  pizza_category_id?: string;
  montagem?: MontagemDePizza;
};

export type DiferencaDePreco = {
  indice: number;
  nome: string;
  preco_enviado_centavos: number;
  preco_atual_centavos: number;
};

export type ResultadoDaConferencia =
  | { ok: true; itens: ItemDoPedido[]; subtotal: number; conferidas: number }
  | { ok: false; motivo: "montagem_invalida"; indice: number; erros: ErroDeMontagem[] }
  | { ok: false; motivo: "preco_mudou"; diferencas: DiferencaDePreco[] }
  | {
      ok: false;
      motivo: "subtotal_inconsistente";
      subtotal_enviado: number;
      soma_dos_itens: number;
    }
  | { ok: false; motivo: "cardapio_indisponivel"; indice: number };

/** O item é uma pizza do configurador novo? */
export function temMontagem(item: unknown): item is ItemDoPedido & { montagem: MontagemDePizza } {
  if (!item || typeof item !== "object") return false;
  const m = (item as ItemDoPedido).montagem;
  return !!m && typeof m === "object" && typeof m.tamanho === "string" && Array.isArray(m.sabores);
}

/** Campos antigos que a cozinha, o Kanban e a impressão já sabem ler. */
function camposLegados(r: RegistroDaPizza) {
  return {
    size: r.tamanho,
    flavors: r.sabores.map((s) => (r.sabores.length > 1 ? `${s.nome} (${s.fracao})` : s.nome)),
    crust: r.borda?.nome ?? "",
    adicionais: r.adicionais.map((a) => (a.quantidade > 1 ? `${a.nome} x${a.quantidade}` : a.nome)),
    notes: [
      r.removidos.length > 0 ? `Sem: ${r.removidos.join(", ")}` : "",
      r.observacao ? `Obs: ${r.observacao}` : "",
    ]
      .filter(Boolean)
      .join(" • "),
  };
}

export async function conferirItensDePizza(args: {
  itens: unknown[];
  subtotalEnviado: number;
  carregarCatalogo: (categoriaId: string) => Promise<CatalogoDePizza | null>;
}): Promise<ResultadoDaConferencia> {
  const cache = new Map<string, CatalogoDePizza | null>();
  const saida: ItemDoPedido[] = [];
  const diferencas: DiferencaDePreco[] = [];
  let conferidas = 0;

  for (let i = 0; i < args.itens.length; i++) {
    const item = args.itens[i] as ItemDoPedido;
    if (!temMontagem(item)) {
      saida.push(item);
      continue;
    }
    const categoriaId = String(item.pizza_category_id ?? "");
    if (!cache.has(categoriaId)) {
      cache.set(categoriaId, categoriaId ? await args.carregarCatalogo(categoriaId) : null);
    }
    const catalogo = cache.get(categoriaId);
    if (!catalogo) return { ok: false, motivo: "cardapio_indisponivel", indice: i };

    // A quantidade que vale é a do item do pedido, não a que veio dentro da
    // montagem: é a do carrinho que o cliente vê e paga.
    const quantidade = Number(item.quantity) || 1;
    const resultado = calcularPizza(catalogo, { ...item.montagem, quantidade });
    if (!resultado.ok)
      return { ok: false, motivo: "montagem_invalida", indice: i, erros: resultado.erros };

    const enviado = reaisParaCentavos(item.unit_price);
    if (enviado !== resultado.pizza.precoUnitarioCentavos) {
      diferencas.push({
        indice: i,
        nome: String(item.name ?? "Pizza"),
        preco_enviado_centavos: enviado,
        preco_atual_centavos: resultado.pizza.precoUnitarioCentavos,
      });
      continue;
    }

    const registro = registrarPizza(resultado.pizza);
    conferidas += 1;
    saida.push({
      ...item,
      ...camposLegados(registro),
      type: "pizza",
      name: item.name || `Pizza ${registro.tamanho}`,
      quantity: registro.quantidade,
      unit_price: centavosParaReais(registro.preco_unitario_centavos),
      total_price: centavosParaReais(registro.total_centavos),
      description: registro.descricao,
      pizza: registro,
    });
  }

  if (diferencas.length > 0) return { ok: false, motivo: "preco_mudou", diferencas };

  // O subtotal precisa ser a soma dos itens. Senão bastaria mandar os itens
  // certos com um subtotal menor — e é o subtotal que vira cobrança.
  const somaCentavos = saida.reduce((s, it) => {
    const total = it.total_price ?? Number(it.unit_price ?? 0) * Number(it.quantity ?? 1);
    return s + reaisParaCentavos(total);
  }, 0);
  if (conferidas > 0 && Math.abs(somaCentavos - reaisParaCentavos(args.subtotalEnviado)) > 1) {
    return {
      ok: false,
      motivo: "subtotal_inconsistente",
      subtotal_enviado: args.subtotalEnviado,
      soma_dos_itens: centavosParaReais(somaCentavos),
    };
  }

  return { ok: true, itens: saida, subtotal: centavosParaReais(somaCentavos), conferidas };
}

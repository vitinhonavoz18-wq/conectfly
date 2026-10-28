/**
 * Como uma pizza montada vira uma linha do carrinho — e como o carrinho se
 * ajusta quando o servidor avisa que um preço mudou.
 *
 * Separado da tela para poder ser testado sem navegador.
 */

import type { CartLine } from "@/lib/site/types";
import {
  centavosParaReais,
  reaisParaCentavos,
  type MontagemDePizza,
  type PizzaCalculada,
} from "./motorDePreco";

/** Pequeno resumo numérico de um texto (djb2). Não é segurança: é só um rótulo. */
function resumo(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * A "identidade" de uma pizza no carrinho.
 *
 * O carrinho junta linhas de mesma identidade (soma a quantidade). Por isso
 * TUDO que muda a pizza entra aqui: tamanho, sabores e frações, borda,
 * adicionais e quantidades, ingredientes retirados e observação. Duas
 * calabresas — uma sem cebola e outra normal — são duas linhas, como dois
 * pedidos diferentes na comanda da cozinha.
 */
export function identidadeDaPizza(categoriaId: string, m: MontagemDePizza): string {
  const normalizada = {
    t: m.tamanho,
    s: [...m.sabores].map((s) => `${s.id}:${s.partes ?? 1}`).sort(),
    b: m.bordaId ?? null,
    a: [...(m.adicionais ?? [])]
      .filter((a) => a.quantidade > 0)
      .map((a) => `${a.id}:${a.quantidade}`)
      .sort(),
    r: [...(m.removidos ?? [])].sort(),
    o: (m.observacao ?? "").trim(),
  };
  return `pizza-${categoriaId}-${resumo(JSON.stringify(normalizada))}`;
}

/** Texto curto para o carrinho: "Calabresa 1/2 + Camarão 1/2 • Borda: Catupiry • …". */
function descricaoCurta(p: PizzaCalculada): string {
  const partes: string[] = [];
  partes.push(
    p.sabores.length === 1
      ? `Sabor: ${p.sabores[0].nome}`
      : `Sabores: ${p.sabores.map((s) => `${s.nome} ${s.fracao}`).join(" + ")}`,
  );
  if (p.borda) partes.push(`Borda: ${p.borda.nome}`);
  if (p.adicionais.length > 0) {
    partes.push(
      `Adicionais: ${p.adicionais.map((a) => (a.quantidade > 1 ? `${a.nome} x${a.quantidade}` : a.nome)).join(", ")}`,
    );
  }
  if (p.removidos.length > 0) partes.push(`Sem: ${p.removidos.join(", ")}`);
  if (p.observacao) partes.push(`Obs: ${p.observacao}`);
  return partes.join(" • ");
}

export function linhaDaPizza(args: {
  categoriaId: string;
  montagem: MontagemDePizza;
  pizza: PizzaCalculada;
}): Omit<CartLine, "quantity"> {
  const { categoriaId, pizza } = args;
  // A quantidade é do carrinho; a montagem guardada é a receita de UMA pizza.
  const { quantidade: _q, ...montagem } = args.montagem;
  void _q;
  return {
    itemId: identidadeDaPizza(categoriaId, montagem),
    name: `Pizza ${pizza.tamanho.nome}`,
    description: descricaoCurta(pizza),
    unitPrice: centavosParaReais(pizza.precoUnitarioCentavos),
    sizeLabel: pizza.tamanho.nome,
    flavors: pizza.sabores.map((s) =>
      pizza.sabores.length > 1 ? `${s.nome} (${s.fracao})` : s.nome,
    ),
    specialFlavors: [],
    extras: 0,
    montagem,
    pizzaCategoryId: categoriaId,
  };
}

export type DiferencaRecebida = { indice: number; preco_atual_centavos: number };

/**
 * O servidor recusou porque o preço de alguma pizza mudou. Atualiza o preço
 * dessas linhas no carrinho, para o cliente VER o valor novo antes de enviar
 * de novo. Nunca envia sozinho: quem confirma é o cliente.
 *
 * O `indice` é a posição do item no pedido, que é a mesma do carrinho (o
 * pedido é montado do carrinho, item por item, na mesma ordem). Por cautela,
 * só mexe em linha que é pizza do configurador.
 */
export function aplicarPrecosDoServidor(
  itens: CartLine[],
  diferencas: DiferencaRecebida[],
): CartLine[] {
  const novos = new Map(diferencas.map((d) => [d.indice, d.preco_atual_centavos]));
  return itens.map((linha, i) => {
    const centavos = novos.get(i);
    if (centavos === undefined || !linha.montagem) return linha;
    if (reaisParaCentavos(linha.unitPrice) === centavos) return linha;
    return { ...linha, unitPrice: centavosParaReais(centavos) };
  });
}

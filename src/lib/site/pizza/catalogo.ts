/**
 * Transforma o cardápio como ele está guardado no banco do site no formato que
 * o motor de preços entende (`motorDePreco.ts`).
 *
 * É a MESMA função no navegador (o montador de pizza mostra o preço com ela) e
 * no servidor (`routes/api/public/submit-order.ts` confere o pedido com ela).
 * Se cada lado montasse o cardápio do seu jeito, o cliente poderia ver um
 * preço e o servidor cobrar outro.
 */

import {
  CHAVE_DA_CONFIG,
  chaveDeNome,
  lerConfigPizzaria,
  lerPrecosPorTamanho,
  reaisParaCentavos,
  type CatalogoDePizza,
  type OpcaoDoCatalogo,
} from "./motorDePreco";

export type TamanhoBruto = {
  label: string;
  price: number | string | null;
  max_flavors: number | null;
  slices?: number | null;
  active?: boolean | null;
};

export type ItemBruto = {
  id: string;
  name: string;
  price?: number | string | null;
  is_active?: boolean | null;
  is_special?: boolean | null;
  special_extra?: number | string | null;
  pizza_size_prices_cents?: unknown;
  ingredients?: unknown;
  max_quantity?: number | null;
};

function lerIngredientes(bruto: unknown): string[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .map((i) => String(i ?? "").trim())
    .filter(Boolean)
    .slice(0, 40);
}

function paraOpcao(item: ItemBruto): OpcaoDoCatalogo {
  const max = Number(item.max_quantity);
  return {
    id: item.id,
    nome: item.name,
    ativo: item.is_active !== false,
    precoCentavos: reaisParaCentavos(item.price),
    precosPorTamanho: lerPrecosPorTamanho(item.pizza_size_prices_cents),
    maxQuantidade: Number.isInteger(max) && max >= 1 ? max : 1,
  };
}

export function montarCatalogoDePizza(args: {
  tamanhos: TamanhoBruto[];
  sabores: ItemBruto[];
  bordas: ItemBruto[];
  adicionais: ItemBruto[];
  siteSettings: unknown;
}): CatalogoDePizza {
  const settings =
    args.siteSettings && typeof args.siteSettings === "object"
      ? (args.siteSettings as Record<string, unknown>)
      : {};
  return {
    config: lerConfigPizzaria(settings[CHAVE_DA_CONFIG]),
    tamanhos: args.tamanhos.map((t) => ({
      chave: chaveDeNome(t.label),
      nome: String(t.label ?? "").trim(),
      precoBaseCentavos: reaisParaCentavos(t.price),
      maxSabores: Math.max(0, Math.round(Number(t.max_flavors) || 0)),
      fatias: Number.isFinite(Number(t.slices)) && Number(t.slices) > 0 ? Number(t.slices) : null,
      ativo: t.active !== false,
    })),
    sabores: args.sabores.map((s) => ({
      id: s.id,
      nome: s.name,
      ativo: s.is_active !== false,
      precosPorTamanho: lerPrecosPorTamanho(s.pizza_size_prices_cents),
      extraEspecialCentavos: s.is_special ? reaisParaCentavos(s.special_extra) : 0,
      ingredientes: lerIngredientes(s.ingredients),
    })),
    bordas: args.bordas.map(paraOpcao),
    adicionais: args.adicionais.map(paraOpcao),
  };
}

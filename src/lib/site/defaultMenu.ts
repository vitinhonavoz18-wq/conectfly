import type { PizzaSize } from "./types";

/**
 * Cardápio padrão pré-definido (baseado na "Pizzaria Paradiso").
 * Aplicado automaticamente a novos restaurantes e disponível como
 * template manual para restaurantes existentes sem cardápio.
 */

export interface DefaultFlavor {
  name: string;
  description: string;
  is_special: boolean;
  special_extra: number;
}

export interface DefaultCategory {
  name: string;
  icon: string | null;
  is_pizza: boolean;
  pizza_sizes: PizzaSize[] | null;
  flavors: DefaultFlavor[];
}

export const DEFAULT_PIZZA_SIZES: PizzaSize[] = [
  { label: "Pequena", price: 25, max_flavors: 1 },
  { label: "Média", price: 35, max_flavors: 2 },
  { label: "Grande", price: 45, max_flavors: 3 },
  { label: "Família", price: 55, max_flavors: 4 },
];

export const DEFAULT_PIZZA_FLAVORS: DefaultFlavor[] = [
  { name: "MUSSARELA", description: "Molho de tomate, queijo mussarela, orégano e azeitonas.", is_special: false, special_extra: 0 },
  { name: "CALABRESA", description: "Molho de tomate, mussarela, calabresa fatiada, cebola e orégano.", is_special: false, special_extra: 0 },
  { name: "PORTUGUESA", description: "Molho de tomate, mussarela, presunto, ovos cozidos, cebola, pimentão, ervilha e azeitona.", is_special: false, special_extra: 0 },
  { name: "MARGUERITA", description: "Molho de tomate, mussarela, tomate em rodelas, manjericão fresco e parmesão.", is_special: false, special_extra: 0 },
  { name: "NAPOLITANA", description: "Molho de tomate, mussarela, tomate picado, alho e parmesão.", is_special: false, special_extra: 0 },
  { name: "BAIANA", description: "Molho de tomate, mussarela, calabresa moída apimentada, cebola e pimenta.", is_special: false, special_extra: 0 },
  { name: "QUATRO QUEIJOS", description: "Molho de tomate, mussarela, provolone, parmesão e catupiry/gorgonzola.", is_special: true, special_extra: 5 },
  { name: "FRANGO COM CATUPIRY", description: "Molho de tomate, mussarela, frango desfiado temperado e catupiry.", is_special: false, special_extra: 0 },
  { name: "ATUM", description: "Molho de tomate, mussarela, atum, cebola e orégano.", is_special: false, special_extra: 0 },
  { name: "MILHO COM BACON", description: "Molho de tomate, mussarela, milho verde e bacon crocante.", is_special: false, special_extra: 0 },
  { name: "STROGONOFF DE FRANGO", description: "Molho de tomate, mussarela, frango ao molho strogonoff e batata palha.", is_special: true, special_extra: 5 },
  { name: "STROGONOFF DE CARNE", description: "Molho de tomate, mussarela, carne ao molho strogonoff e batata palha.", is_special: true, special_extra: 5 },
  { name: "MEXICANA", description: "Molho de tomate, mussarela, carne moída temperada, pimenta, milho e cheddar.", is_special: true, special_extra: 5 },
  { name: "LOMBO CANADENSE", description: "Molho de tomate, mussarela, lombo canadense, cebola e catupiry.", is_special: true, special_extra: 5 },
  { name: "PALMITO", description: "Molho de tomate, mussarela, palmito picado, tomate e orégano.", is_special: true, special_extra: 5 },
  { name: "BROCOLIS C/BACON", description: "Molho de tomate, mussarela, brócolis refogado, bacon e alho.", is_special: true, special_extra: 5 },
  { name: "CAMARÃO", description: "Molho de tomate, mussarela, camarão temperado e catupiry.", is_special: true, special_extra: 5 },
  { name: "CARNE SECA C/CATUPIRY", description: "Molho de tomate, mussarela, carne seca desfiada, cebola roxa e catupiry.", is_special: true, special_extra: 5 },
  { name: "PARMEGIANA", description: "Molho de tomate, mussarela, frango desfiado ou carne, molho especial e parmesão.", is_special: true, special_extra: 5 },
  { name: "RÚCULA C/TOMATE SECO", description: "Molho de tomate, mussarela, rúcula fresca, tomate seco e parmesão.", is_special: true, special_extra: 5 },
  { name: "CHOCOLATE", description: "Chocolate ao leite derretido e granulado.", is_special: true, special_extra: 5 },
  { name: "CHOCOLATE C/MORANGO", description: "Chocolate ao leite e morangos frescos.", is_special: true, special_extra: 5 },
  { name: "ROMEU E JULIETA", description: "Mussarela, goiabada e queijo minas.", is_special: true, special_extra: 5 },
  { name: "BANANA C/CANELA", description: "Banana fatiada, açúcar, canela e leite condensado.", is_special: true, special_extra: 5 },
  { name: "PRESTÍGIO", description: "Chocolate ao leite, coco ralado e leite condensado.", is_special: true, special_extra: 5 },
  { name: "NUTELLA", description: "Creme de avelã e leite condensado.", is_special: true, special_extra: 5 },
  { name: "NUTELLA C/MORANGO", description: "Creme de avelã e morangos frescos.", is_special: true, special_extra: 5 },
  { name: "NORDESTINA", description: "Carne de sol desfiada, cebola roxa, queijo coalho e manteiga da terra.", is_special: false, special_extra: 0 },
  { name: "BAIANA ESPECIAL", description: "Calabresa moída, pimenta, ovos e cebola.", is_special: false, special_extra: 0 },
  { name: "CAIPIRA", description: "Frango desfiado, milho, catupiry e cheiro-verde.", is_special: false, special_extra: 0 },
  { name: "MINEIRA", description: "Linguiça artesanal, milho, cebola e queijo minas.", is_special: false, special_extra: 0 },
  { name: "VEGETARIANA", description: "Mussarela, palmito, cebola, tomate, milho, ervilha e pimentão.", is_special: false, special_extra: 0 },
];

export const DEFAULT_MENU: DefaultCategory[] = [
  {
    name: "PIZZA",
    icon: "🍕",
    is_pizza: true,
    pizza_sizes: DEFAULT_PIZZA_SIZES,
    flavors: DEFAULT_PIZZA_FLAVORS,
  },
  {
    name: "BEBIDAS",
    icon: "🥤",
    is_pizza: false,
    pizza_sizes: null,
    flavors: [
      { name: "Coca-Cola Lata 350ml", description: "Refrigerante gelado.", is_special: false, special_extra: 0 },
      { name: "Coca-Cola 2L", description: "Refrigerante gelado.", is_special: false, special_extra: 0 },
      { name: "Guaraná Antarctica Lata 350ml", description: "Refrigerante gelado.", is_special: false, special_extra: 0 },
      { name: "Guaraná Antarctica 2L", description: "Refrigerante gelado.", is_special: false, special_extra: 0 },
      { name: "Sprite Lata 350ml", description: "Refrigerante gelado.", is_special: false, special_extra: 0 },
      { name: "Suco Del Valle 1L", description: "Sabores diversos.", is_special: false, special_extra: 0 },
      { name: "Água Mineral 500ml", description: "Sem gás.", is_special: false, special_extra: 0 },
      { name: "Água com Gás 500ml", description: "Com gás.", is_special: false, special_extra: 0 },
      { name: "Cerveja Heineken Long Neck", description: "330ml gelada.", is_special: false, special_extra: 0 },
      { name: "Cerveja Brahma Lata 350ml", description: "Gelada.", is_special: false, special_extra: 0 },
    ],
  },
];

/** Bairros padrão de Salvador (baseado no arquivo de taxas fornecido). */
export const DEFAULT_DELIVERY_ZONES: { neighborhood: string; fee: number }[] = [
  { neighborhood: "ACUPE DE BROTAS", fee: 26 }, { neighborhood: "ALPHAVILLE I", fee: 14 },
  { neighborhood: "ALPHAVILLE II", fee: 16 }, { neighborhood: "AMARALINA", fee: 20 },
  { neighborhood: "ARMAÇÃO", fee: 15 }, { neighborhood: "BARBALHO", fee: 32 },
  { neighborhood: "BARRA", fee: 36 }, { neighborhood: "BARREIRAS", fee: 20 },
  { neighborhood: "BARRIS", fee: 35 }, { neighborhood: "BOCA DO RIO", fee: 16 },
  { neighborhood: "BROTAS", fee: 26 }, { neighborhood: "BURAQUINHO", fee: 36 },
  { neighborhood: "CABULA", fee: 20 }, { neighborhood: "CABULA VI", fee: 20 },
  { neighborhood: "CAJAZEIRAS", fee: 18 }, { neighborhood: "CAJAZEIRAS 2", fee: 18 },
  { neighborhood: "CAMINHO DAS ÁRVORES", fee: 19 }, { neighborhood: "CAMPO GRANDE", fee: 55 },
  { neighborhood: "CANABRAVA", fee: 16 }, { neighborhood: "CANDEAL", fee: 20 },
  { neighborhood: "CANELA", fee: 36 }, { neighborhood: "COSTA AZUL", fee: 16 },
  { neighborhood: "DANIEL LISBOA", fee: 25 }, { neighborhood: "DORON", fee: 16 },
  { neighborhood: "FEDERAÇÃO", fee: 29 }, { neighborhood: "GRAÇA", fee: 35 },
  { neighborhood: "HORTO BELA VISTA", fee: 20 }, { neighborhood: "HORTO FLORESTAL", fee: 24 },
  { neighborhood: "IMBUÍ", fee: 15 }, { neighborhood: "ITAIGARA", fee: 19 },
  { neighborhood: "ITAPUÃ", fee: 15 }, { neighborhood: "JAGUARIBE", fee: 8 },
  { neighborhood: "JARDIM DAS MARGARIDAS", fee: 25 }, { neighborhood: "JARDIM NOVA ESPERANÇA", fee: 17 },
  { neighborhood: "JARDIM PLACAFORD", fee: 10 }, { neighborhood: "LAURO DE FREITAS", fee: 33 },
  { neighborhood: "MATA ESCURA", fee: 20 }, { neighborhood: "MUSSURUNGA I", fee: 18 },
  { neighborhood: "MUSSURUNGA II", fee: 18 }, { neighborhood: "NAZARÉ", fee: 32 },
  { neighborhood: "NOVA BRASÍLIA", fee: 18 }, { neighborhood: "NOVA BRASÍLIA DE ITAPUÃ", fee: 15 },
  { neighborhood: "NOVO MAROTINHO", fee: 17 }, { neighborhood: "ONDINA", fee: 26 },
  { neighborhood: "PARALELA", fee: 14 }, { neighborhood: "PATAMARES", fee: 10 },
  { neighborhood: "PERNAMBUÉS", fee: 20 }, { neighborhood: "PIATÃ", fee: 10 },
  { neighborhood: "PITUAÇU", fee: 10 }, { neighborhood: "PITUBA", fee: 19 },
  { neighborhood: "PRAIA DO FLAMENGO", fee: 20 }, { neighborhood: "RESGATE", fee: 20 },
  { neighborhood: "RIO VERMELHO", fee: 26 }, { neighborhood: "SABOEIRO", fee: 16 },
  { neighborhood: "SANTA CRUZ", fee: 18 }, { neighborhood: "SANTA TERESA", fee: 18.9 },
  { neighborhood: "STELLA MARIS", fee: 18 }, { neighborhood: "STIEP", fee: 15 },
  { neighborhood: "SUSSUARANA", fee: 16 }, { neighborhood: "SÃO CRISTÓVÃO", fee: 16 },
  { neighborhood: "SÃO MARCOS", fee: 13.9 }, { neighborhood: "TROBOGY", fee: 16 },
  { neighborhood: "VILA LAURA", fee: 26 }, { neighborhood: "VILA PRAIANA", fee: 25 },
  { neighborhood: "VILAS DO ATLÂNTICO", fee: 35 }, { neighborhood: "VITÓRIA", fee: 40 },
];

/**
 * Client-agnostic seed. Works with either the browser Supabase client
 * (`@/integrations/supabase/client`) or the server admin client
 * (`@/integrations/supabase/client.server`). The caller decides.
 *
 * Typed as `any` on purpose so we can accept both clients without pulling
 * server-only modules into browser bundles.
 */
export async function seedDefaultDeliveryZonesWithClient(
  client: any,
  restaurantId: string,
): Promise<void> {
  const { data: existing } = await client
    .from("delivery_zones")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .limit(1);
  if (existing && existing.length > 0) return;
  const rows = DEFAULT_DELIVERY_ZONES.map((z, i) => ({
    restaurant_id: restaurantId,
    neighborhood: z.neighborhood,
    fee: z.fee,
    sort_order: i,
  }));
  await client.from("delivery_zones").insert(rows);
}

export async function seedDefaultDeliveryZones(restaurantId: string): Promise<void> {
  return seedDefaultDeliveryZonesWithClient(supabase, restaurantId);
}

/**
 * Semeia o cardápio padrão para um restaurante.
 * Não faz nada se o restaurante já tiver categorias (a menos que `force` seja true,
 * que apaga tudo antes — usar com cuidado).
 */
import { supabase } from "@/integrations/supabase/client";

export async function seedDefaultMenuWithClient(
  client: any,
  restaurantId: string,
  options: { force?: boolean } = {},
): Promise<{ inserted: boolean; reason?: string }> {
  const { data: existing, error: exErr } = await client
    .from("menu_categories")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .limit(1);
  if (exErr) return { inserted: false, reason: exErr.message };

  if (existing && existing.length > 0) {
    if (!options.force) return { inserted: false, reason: "already-has-menu" };
    // force: limpa categorias e itens antes
    await client.from("menu_items").delete().eq("restaurant_id", restaurantId);
    await client.from("menu_categories").delete().eq("restaurant_id", restaurantId);
  }

  for (let ci = 0; ci < DEFAULT_MENU.length; ci++) {
    const cat = DEFAULT_MENU[ci];
    const { data: catRow, error: catErr } = await client
      .from("menu_categories")
      .insert({
        restaurant_id: restaurantId,
        name: cat.name,
        icon: cat.icon,
        is_pizza: cat.is_pizza,
        pizza_sizes: cat.pizza_sizes as never,
        sort_order: ci,
        is_active: true,
      })
      .select()
      .single();
    if (catErr || !catRow) {
      console.error(`[seedDefaultMenu] Erro ao criar categoria ${cat.name}:`, catErr);
      continue;
    }

    const isBeverageCat = cat.name.toLowerCase() === "bebidas" || cat.name.toLowerCase() === "bebida";

    if (cat.flavors.length > 0) {
      if (isBeverageCat) {
        // Inserir na tabela específica de bebidas
        const beverageRows = cat.flavors.map((f, idx) => ({
          pizzeria_id: restaurantId,
          name: f.name,
          price: f.name.includes("Lata") ? 6 : (f.name.includes("2L") ? 14 : 8),
          is_active: true,
          sort_order: idx,
        }));
        const { error: bevErr } = await client.from("pizzeria_beverages").insert(beverageRows);
        if (bevErr) console.error("[seedDefaultMenu] Erro ao criar bebidas padrão:", bevErr);
      } else {
        // Inserir na tabela genérica de itens
        const rows = cat.flavors.map((f, idx) => ({
          restaurant_id: restaurantId,
          category_id: catRow.id,
          name: f.name,
          description: f.description,
          price: 0,
          is_special: f.is_special,
          special_extra: f.special_extra,
          sort_order: idx,
          is_active: true,
        }));
        const { error: itemErr } = await client.from("menu_items").insert(rows);
        if (itemErr) console.error(`[seedDefaultMenu] Erro ao criar itens para ${cat.name}:`, itemErr);
      }
    }

    // Se for categoria de pizza, inserir também na tabela de tamanhos
    if (cat.is_pizza && cat.pizza_sizes) {
      const sizeRows = cat.pizza_sizes.map((s, idx) => ({
        pizzeria_id: restaurantId,
        name: s.label,
        price: s.price,
        max_flavors: s.max_flavors,
        slices: s.slices || 0,
        is_active: true,
        sort_order: idx,
      }));
      const { error: sizeErr } = await client.from("pizzeria_pizza_sizes").insert(sizeRows);
      if (sizeErr) console.error("[seedDefaultMenu] Erro ao criar tamanhos de pizza padrão:", sizeErr);
    }
  }

  return { inserted: true };
}

export async function seedDefaultMenu(
  restaurantId: string,
  options: { force?: boolean } = {},
): Promise<{ inserted: boolean; reason?: string }> {
  return seedDefaultMenuWithClient(supabase, restaurantId, options);
}
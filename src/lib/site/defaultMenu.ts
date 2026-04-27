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
];

/**
 * Semeia o cardápio padrão para um restaurante.
 * Não faz nada se o restaurante já tiver categorias (a menos que `force` seja true,
 * que apaga tudo antes — usar com cuidado).
 */
import { supabase } from "@/integrations/supabase/client";

export async function seedDefaultMenu(
  restaurantId: string,
  options: { force?: boolean } = {},
): Promise<{ inserted: boolean; reason?: string }> {
  const { data: existing, error: exErr } = await supabase
    .from("menu_categories")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .limit(1);
  if (exErr) return { inserted: false, reason: exErr.message };

  if (existing && existing.length > 0) {
    if (!options.force) return { inserted: false, reason: "already-has-menu" };
    // force: limpa categorias e itens antes
    await supabase.from("menu_items").delete().eq("restaurant_id", restaurantId);
    await supabase.from("menu_categories").delete().eq("restaurant_id", restaurantId);
  }

  for (let ci = 0; ci < DEFAULT_MENU.length; ci++) {
    const cat = DEFAULT_MENU[ci];
    const { data: catRow, error: catErr } = await supabase
      .from("menu_categories")
      .insert({
        restaurant_id: restaurantId,
        name: cat.name,
        icon: cat.icon,
        is_pizza: cat.is_pizza,
        pizza_sizes: cat.pizza_sizes as never,
        sort_order: ci,
      })
      .select()
      .single();
    if (catErr || !catRow) continue;

    if (cat.flavors.length > 0) {
      const rows = cat.flavors.map((f, idx) => ({
        restaurant_id: restaurantId,
        category_id: catRow.id,
        name: f.name,
        description: f.description,
        price: 0,
        is_special: f.is_special,
        special_extra: f.special_extra,
        sort_order: idx,
      }));
      await supabase.from("menu_items").insert(rows);
    }
  }

  return { inserted: true };
}
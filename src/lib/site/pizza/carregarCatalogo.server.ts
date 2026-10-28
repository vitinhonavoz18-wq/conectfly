/**
 * Lê do banco o cardápio oficial de UMA categoria de pizza, para o servidor
 * conferir o preço de um pedido. Servidor apenas (usa a chave de serviço).
 *
 * Segue as mesmas regras do cardápio público (`lib/site/queries.ts`):
 *   - os tamanhos vêm da tabela `pizzeria_pizza_sizes` quando a loja tem
 *     algum; senão, da lista guardada na própria categoria (lojas antigas);
 *   - bordas e adicionais são as categorias reconhecidas pelo nome
 *     (`categoryKinds.ts`), e os adicionais respeitam os vínculos por categoria.
 *
 * ISOLAMENTO ENTRE LOJAS: toda consulta é amarrada ao `restaurantId` do
 * pedido. Uma categoria de outra loja simplesmente "não existe" aqui — não dá
 * para montar uma pizza com o cardápio (ou o preço) de outra pizzaria.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adicionaisDaCategoria, montarVinculos } from "@/lib/site/adicionaisDaCategoria";
import { isAdicionaisCategory, isBordasCategory } from "@/lib/site/categoryKinds";
import { montarCatalogoDePizza, type ItemBruto, type TamanhoBruto } from "./catalogo";
import type { CatalogoDePizza } from "./motorDePreco";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function carregarCatalogoDaCategoria(
  restaurantId: string,
  categoriaId: string,
): Promise<CatalogoDePizza | null> {
  const db = supabaseAdmin as any;

  const [restRes, catsRes, sizesRes, vinculosRes] = await Promise.all([
    db.from("restaurants").select("id, site_settings").eq("id", restaurantId).maybeSingle(),
    db
      .from("menu_categories")
      .select("id, name, is_pizza, pizza_sizes, is_active, sort_order")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("sort_order"),
    db
      .from("pizzeria_pizza_sizes")
      .select("name, price, max_flavors, slices, is_active, sort_order")
      .eq("pizzeria_id", restaurantId)
      .eq("is_active", true)
      .order("sort_order"),
    db.from("menu_addon_categories").select("addon_item_id, category_id"),
  ]);
  if (restRes.error || !restRes.data || catsRes.error || sizesRes.error) return null;

  const categorias = (catsRes.data ?? []) as any[];
  const categoria = categorias.find((c) => c.id === categoriaId);
  if (!categoria || !categoria.is_pizza) return null;

  const bordasCat = categorias.find(isBordasCategory);
  const adicionaisCat = categorias.find(isAdicionaisCategory);
  const idsDeCategoria = [categoria.id, bordasCat?.id, adicionaisCat?.id].filter(Boolean);

  const itensRes = await db
    .from("menu_items")
    .select(
      "id, category_id, name, price, is_active, is_special, special_extra, pizza_size_prices_cents, ingredients, max_quantity",
    )
    .eq("restaurant_id", restaurantId)
    .in("category_id", idsDeCategoria);
  if (itensRes.error) return null;
  const itens = (itensRes.data ?? []) as (ItemBruto & { category_id: string })[];

  const daTabela: TamanhoBruto[] = ((sizesRes.data ?? []) as any[]).map((s) => ({
    label: s.name,
    price: s.price,
    max_flavors: s.max_flavors,
    slices: s.slices,
    active: s.is_active,
  }));
  const tamanhos: TamanhoBruto[] =
    daTabela.length > 0 ? daTabela : ((categoria.pizza_sizes ?? []) as TamanhoBruto[]);

  // Falha ao ler os vínculos não derruba a conferência: sem eles, todo
  // adicional vale para toda categoria — o mesmo que o cardápio faz.
  const vinculos = vinculosRes.error ? undefined : montarVinculos(vinculosRes.data ?? []);
  const adicionais = adicionaisDaCategoria(
    itens.filter((i) => adicionaisCat && i.category_id === adicionaisCat.id),
    categoria.id,
    vinculos,
  );

  return montarCatalogoDePizza({
    tamanhos,
    sabores: itens.filter((i) => i.category_id === categoria.id),
    bordas: itens.filter((i) => bordasCat && i.category_id === bordasCat.id),
    adicionais,
    siteSettings: (restRes.data as any).site_settings,
  });
}

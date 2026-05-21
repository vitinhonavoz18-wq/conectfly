import { supabase } from "@/integrations/supabase/client";
import type {
  ComboGroupRow,
  ComboRow,
  DeliveryZoneRow,
  MenuCategoryRow,
  MenuItemRow,
  RestaurantRow,
  SiteData,
  BeverageRow,
  PizzaSize,
} from "./types";

// Função para gerar logs apenas em desenvolvimento
const debugLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log("[DEBUG]", ...args);
  }
};

 export async function fetchSiteBySlug(identifier: string): Promise<SiteData | null> {
    // Normalização extra do slug antes da query
    const normalizedIdentifier = identifier.toLowerCase().trim().replace(/^\/+|\/+$/g, '');
    
    console.log("--- PUBLIC PAGE ACCESS ---");
    console.log("IDENTIFIER DETECTED:", normalizedIdentifier);

    // Buscamos apenas os dados públicos da view segura.
    // Priorizamos custom_subdomain, depois slug.
    const { data, error } = await supabase
      .from("pizzerias_public")
      .select("*")
      .or(`custom_subdomain.eq.${normalizedIdentifier},slug.eq.${normalizedIdentifier}`)
      .maybeSingle();

    if (error) {
      console.error(`[fetchSiteBySlug] Erro ao buscar restaurante:`, error);
      throw error;
    }

    if (!data) {
      console.warn(`[fetchSiteBySlug] Restaurante não encontrado para o identificador: "${normalizedIdentifier}"`);
      return null;
    }
 
    debugLog(`[fetchSiteBySlug] Sucesso: Restaurante "${data.name}" encontrado.`);
    return fetchSiteByRestaurant(data as unknown as RestaurantRow);
 }

 export async function fetchSiteByRestaurant(
   restaurant: RestaurantRow,
 ): Promise<SiteData> {
  debugLog(`[fetchSiteByRestaurant] Carregando cardápio para restaurante ID: ${restaurant.id}`);
   
   const [catsRes, itemsRes, groupsRes, combosRes, zonesRes, beveragesRes, sizesRes] = await Promise.all([
     supabase
       .from("menu_categories")
       .select("*")
       .eq("restaurant_id", restaurant.id)
       .eq("is_active", true)
       .order("sort_order"),
     supabase
       .from("menu_items")
       .select("*")
       .eq("restaurant_id", restaurant.id)
       .eq("is_active", true)
       .order("sort_order"),
    supabase
      .from("combo_groups")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order"),
     supabase
       .from("combos")
       .select("*")
       .eq("restaurant_id", restaurant.id)
       .eq("is_active", true)
       .order("is_highlighted", { ascending: false })
       .order("sort_order"),
    supabase
      .from("delivery_zones")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order"),
    supabase
      .from("pizzeria_beverages")
      .select("*")
      .eq("pizzeria_id", restaurant.id)
      .eq("is_active", true)
       .order("sort_order"),
     supabase
       .from("pizzeria_pizza_sizes")
       .select("*")
       .eq("pizzeria_id", restaurant.id)
       .eq("is_active", true)
       .order("sort_order"),
   ]);
   if (catsRes.error) {
     console.error("[fetchSiteByRestaurant] Erro ao carregar categorias:", catsRes.error);
     throw catsRes.error;
   }
   if (itemsRes.error) {
     console.error("[fetchSiteByRestaurant] Erro ao carregar itens:", itemsRes.error);
     throw itemsRes.error;
   }
   if (groupsRes.error) {
     console.error("[fetchSiteByRestaurant] Erro ao carregar grupos de combo:", groupsRes.error);
     throw groupsRes.error;
   }
   if (combosRes.error) {
     console.error("[fetchSiteByRestaurant] Erro ao carregar combos:", combosRes.error);
     throw combosRes.error;
   }
 
  const catsData = catsRes.data ?? [];
  const itemsData = itemsRes.data ?? [];
  const beveragesData = beveragesRes.data ?? [];

  debugLog(`[fetchSiteByRestaurant] 📊 RESUMO PARA "${restaurant.slug}":`, {
    restaurant_id: restaurant.id,
    categorias: (catsRes.data ?? []).length,
    itens_sabores: (itemsRes.data ?? []).length,
    bebidas: (beveragesRes.data ?? []).length,
    tamanhos_pizza: sizesRes.data?.length || 0,
  });

  const cats = catsData as unknown as MenuCategoryRow[];
  const items = itemsData as unknown as MenuItemRow[];
  const groups = (groupsRes.data ?? []) as unknown as ComboGroupRow[];
  const combos = (combosRes.data ?? []) as unknown as ComboRow[];
  const zones = (zonesRes.data ?? []) as unknown as DeliveryZoneRow[];
  const beverages = beveragesData as unknown as BeverageRow[];
  
  const pizzaSizesFromTable = (sizesRes?.data ?? []).map(s => ({
    id: s.id,
    label: s.name,
    price: Number(s.price),
    max_flavors: s.max_flavors,
    slices: s.slices,
    active: s.is_active,
    sort_order: s.sort_order
  })) as PizzaSize[];

  return {
    restaurant,
    categories: cats.map((c) => {
      // Use os tamanhos da tabela se existirem, senão use o JSONB da categoria (fallback para dados legados)
      const sizes = (c.is_pizza && pizzaSizesFromTable.length > 0) 
        ? pizzaSizesFromTable 
        : (c.pizza_sizes || []);
      
      return {
        ...c,
        items: items.filter((i) => i.category_id === c.id),
        pizza_sizes: c.is_pizza ? sizes : null
      };
    }),
    comboGroups: groups.map((g) => ({
      ...g,
      combos: combos.filter((cb) => cb.group_id === g.id),
    })),
    deliveryZones: zones,
    beverages,
    pizzaSizes: pizzaSizesFromTable,
  };
}

export async function listRestaurants(): Promise<RestaurantRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return [];

  // Check admin role (best-effort); admins see all, owners see only their own.
  let isAdmin = false;
  try {
    const { data: adminCheck } = await supabase.rpc("has_role", {
      _user_id: uid,
      _role: "admin",
    });
    isAdmin = adminCheck === true;
  } catch {
    isAdmin = false;
  }

  let query = supabase
    .from("restaurants")
    .select("*")
    .order("created_at", { ascending: false });
  if (!isAdmin) query = query.eq("owner_id", uid);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as RestaurantRow[];
}
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "./api-utils";
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
    console.log("SLUG RECEIVED:", identifier);
    console.log("NORMALIZED SLUG:", normalizedIdentifier);

    // Buscamos apenas os dados públicos da view segura.
    // Priorizamos custom_subdomain, depois slug.
    console.log(`[fetchSiteBySlug] Querying pizzerias_public where slug or custom_subdomain = "${normalizedIdentifier}"`);
    
    const { data, error } = await supabase
      .from("pizzerias_public")
      .select("*")
      .or(`custom_subdomain.eq.${normalizedIdentifier},slug.eq.${normalizedIdentifier}`)
      .maybeSingle();
    
    console.log("[fetchSiteBySlug] QUERY RESULT:", data ? "Found" : "Not Found");
    if (data) {
      console.log(`[fetchSiteBySlug] Pizzeria: ${data.name} | ID: ${data.id} | Published: ${data.published} | Slug: ${data.slug}`);
    }

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
  console.log("[listRestaurants] Iniciando carregamento de pizzarias...");
  
  // Usamos getUser() para garantir que a sessão é válida antes de tentar chamar o backend
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn("[listRestaurants] Usuário ausente ou sessão expirada");
    return [];
  }
  
  console.log("[listRestaurants] Chamando backend seguro (admin-list-restaurants)...");
  
  try {
    const { data, error } = await safeInvoke("admin-list-restaurants");
    
    if (error) {
      console.error("[listRestaurants] Erro na chamada da Edge Function:", error);
      throw error;
    }
    
    if (!data?.success) {
      console.error("[listRestaurants] Backend retornou erro:", data?.error);
      throw new Error(data?.error || "Falha ao carregar pizzarias");
    }
    
    console.log(`[listRestaurants] Sucesso: ${data.data?.length || 0} pizzarias retornadas`);
    return (data.data ?? []) as RestaurantRow[];
  } catch (err: any) {
    console.error("[listRestaurants] Erro completo:", err);
    throw err;
  }
}

export async function getRestaurantById(id: string): Promise<RestaurantRow> {
  console.log(`[getRestaurantById] Buscando restaurante: ${id}`);
  
  // Detecta tipo (UUID ou slug) para logs
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  console.log(`[getRestaurantById] Tipo detectado: ${isUuid ? "UUID" : "Slug"}`);

  try {
    const { data, error } = await supabase.functions.invoke("admin-get-restaurant", {
      body: { id }
    });
    
    if (error) {
      console.error("[getRestaurantById] Erro na chamada da Edge Function:", error);
      throw error;
    }
    
    if (!data?.success) {
      console.error("[getRestaurantById] Backend retornou erro:", data?.error);
      throw new Error(data?.error || "Restaurante não encontrado");
    }
    
    console.log(`[getRestaurantById] Sucesso: Restaurante "${data.data.name}" encontrado`);
    return data.data as RestaurantRow;
  } catch (err) {
    console.error("[getRestaurantById] Erro completo:", err);
    throw err;
  }
}

export async function updateRestaurant(id: string, updates: Partial<RestaurantRow>): Promise<RestaurantRow> {
  console.log(`[updateRestaurant] Atualizando restaurante: ${id}`);
  
  try {
    const { data, error } = await supabase.functions.invoke("admin-get-restaurant", {
      body: { id, action: "update", updates }
    });
    
    if (error) {
      console.error("[updateRestaurant] Erro na chamada da Edge Function:", error);
      throw error;
    }
    
    if (!data?.success) {
      console.error("[updateRestaurant] Backend retornou erro:", data?.error);
      throw new Error(data?.error || "Falha ao atualizar restaurante");
    }
    
    console.log(`[updateRestaurant] Sucesso: Restaurante "${data.data.name}" atualizado`);
    return data.data as RestaurantRow;
  } catch (err) {
    console.error("[updateRestaurant] Erro completo:", err);
    throw err;
  }
}

export async function adminFetchSiteData(id: string): Promise<SiteData> {
  console.log(`[adminFetchSiteData] Carregando dados completos via backend seguro: ${id}`);
  
  try {
    const { data, error } = await supabase.functions.invoke("admin-get-restaurant", {
      body: { id, action: "get", full: true }
    });
    
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Falha ao carregar dados do restaurante");

    const { restaurant, categories, items, comboGroups, combos, deliveryZones, beverages, pizzaSizes } = data.data;

    // Normalização local similar ao fetchSiteByRestaurant
    const pizzaSizesFromTable = (pizzaSizes || []).map((s: any) => ({
      id: s.id,
      label: s.name,
      price: Number(s.price),
      max_flavors: s.max_flavors,
      slices: s.slices,
      active: s.is_active,
      sort_order: s.sort_order
    })) as PizzaSize[];

    return {
      restaurant: restaurant as RestaurantRow,
      categories: categories.map((c: any) => {
        const sizes = (c.is_pizza && pizzaSizesFromTable.length > 0) 
          ? pizzaSizesFromTable 
          : (c.pizza_sizes || []);
        
        return {
          ...c,
          items: items.filter((i: any) => i.category_id === c.id),
          pizza_sizes: c.is_pizza ? sizes : null
        };
      }),
      comboGroups: comboGroups.map((g: any) => ({
        ...g,
        combos: combos.filter((cb: any) => cb.group_id === g.id),
      })),
      deliveryZones: deliveryZones as DeliveryZoneRow[],
      beverages: beverages as BeverageRow[],
      pizzaSizes: pizzaSizesFromTable,
    };
  } catch (err) {
    console.error("[adminFetchSiteData] Erro completo:", err);
    throw err;
  }
}
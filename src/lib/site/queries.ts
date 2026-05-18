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
} from "./types";

 export async function fetchSiteBySlug(slug: string): Promise<SiteData | null> {
   console.log(`[fetchSiteBySlug] Buscando restaurante pelo slug: "${slug}"`);
   
    const { data, error } = await supabase
      .from("pizzerias_public")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    const restaurant = data as any;
 
   if (error) {
     console.error(`[fetchSiteBySlug] Erro ao buscar restaurante "${slug}":`, error);
     throw error;
   }
 
   if (!restaurant) {
     console.warn(`[fetchSiteBySlug] Restaurante não encontrado no banco para o slug: "${slug}"`);
     // Verificar se o restaurante existe na tabela principal mas não está publicado
     const { count } = await supabase
       .from("restaurants")
       .select("*", { count: 'exact', head: true })
       .eq("slug", slug);
     
     if (count && count > 0) {
       console.warn(`[fetchSiteBySlug] O restaurante "${slug}" existe mas possivelmente não está publicado ou há restrição de RLS.`);
     }
     
     return null;
   }
 
    if (restaurant) {
      console.log(`[fetchSiteBySlug] Restaurante encontrado: ID=${restaurant.id}, Nome=${restaurant.name}`);
    }
    return fetchSiteByRestaurant(restaurant as unknown as RestaurantRow);
 }

 export async function fetchSiteByRestaurant(
   restaurant: RestaurantRow,
 ): Promise<SiteData> {
   console.log(`[fetchSiteByRestaurant] Carregando cardápio para restaurante ID: ${restaurant.id}`);
   
  const [catsRes, itemsRes, groupsRes, combosRes, zonesRes, beveragesRes] = await Promise.all([
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
 
   console.log(`[fetchSiteByRestaurant] Sucesso ao carregar dados: ${catsRes.data?.length || 0} categorias, ${itemsRes.data?.length || 0} itens.`);

  const cats = (catsRes.data ?? []) as unknown as MenuCategoryRow[];
  const items = (itemsRes.data ?? []) as unknown as MenuItemRow[];
  const groups = (groupsRes.data ?? []) as unknown as ComboGroupRow[];
  const combos = (combosRes.data ?? []) as unknown as ComboRow[];
  const zones = (zonesRes.data ?? []) as unknown as DeliveryZoneRow[];
  const beverages = (beveragesRes.data ?? []) as unknown as BeverageRow[];

  return {
    restaurant,
    categories: cats.map((c) => ({
      ...c,
      items: items.filter((i) => i.category_id === c.id),
    })),
    comboGroups: groups.map((g) => ({
      ...g,
      combos: combos.filter((cb) => cb.group_id === g.id),
    })),
    deliveryZones: zones,
    beverages,
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
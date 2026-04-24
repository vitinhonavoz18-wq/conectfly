import { supabase } from "@/integrations/supabase/client";
import type {
  ComboGroupRow,
  ComboRow,
  MenuCategoryRow,
  MenuItemRow,
  RestaurantRow,
  SiteData,
} from "./types";

export async function fetchSiteBySlug(slug: string): Promise<SiteData | null> {
  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!restaurant) return null;
  return fetchSiteByRestaurant(restaurant as unknown as RestaurantRow);
}

export async function fetchSiteByRestaurant(
  restaurant: RestaurantRow,
): Promise<SiteData> {
  const [catsRes, itemsRes, groupsRes, combosRes] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order"),
    supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurant.id)
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
      .order("sort_order"),
  ]);
  if (catsRes.error) throw catsRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (groupsRes.error) throw groupsRes.error;
  if (combosRes.error) throw combosRes.error;

  const cats = (catsRes.data ?? []) as unknown as MenuCategoryRow[];
  const items = (itemsRes.data ?? []) as unknown as MenuItemRow[];
  const groups = (groupsRes.data ?? []) as unknown as ComboGroupRow[];
  const combos = (combosRes.data ?? []) as unknown as ComboRow[];

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
  };
}

export async function listRestaurants(): Promise<RestaurantRow[]> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as RestaurantRow[];
}
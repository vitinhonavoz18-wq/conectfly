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
  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("id, name, slug, tagline, description, whatsapp_number, whatsapp_display, whatsapp_enabled, address, hours, city, logo_url, hero_image_url, hero_media_type, hero_video_url, primary_color, secondary_color, published, show_item_images, flycontrol_enabled, created_at, updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!restaurant) return null;
  return fetchSiteByRestaurant(restaurant as unknown as RestaurantRow);
}

export async function fetchSiteByRestaurant(
  restaurant: RestaurantRow,
): Promise<SiteData> {
  const [catsRes, itemsRes, groupsRes, combosRes, zonesRes, beveragesRes] = await Promise.all([
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
  if (catsRes.error) throw catsRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (groupsRes.error) throw groupsRes.error;
  if (combosRes.error) throw combosRes.error;

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
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as RestaurantRow[];
}
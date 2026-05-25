export type Size = { label: string; price: number };

 export type PizzaSize = { 
   id?: string;
   label: string; 
   price: number; 
   max_flavors: number;
   slices?: number;
   active?: boolean;
   sort_order?: number;
 };

export interface MenuItemRow {
  id: string;
  category_id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
   price: number;
   sizes: Size[] | null;
   sort_order: number;
   is_special: boolean;
   special_extra: number;
   image_url?: string | null;
   is_active?: boolean;
}

export interface MenuCategoryRow {
  id: string;
  restaurant_id: string;
  name: string;
  icon: string | null;
  image_url: string | null;
   sort_order: number;
   is_pizza: boolean;
   pizza_sizes: PizzaSize[] | null;
   is_active?: boolean;
}

export interface ComboRow {
  id: string;
  group_id: string;
  restaurant_id: string;
  name: string;
  items: string[];
   price: number;
   badge: string | null;
   sort_order: number;
   is_active?: boolean;
   is_highlighted?: boolean;
}

export interface ComboGroupRow {
  id: string;
  restaurant_id: string;
  title: string;
  sort_order: number;
}

export type SiteTemplate = "black" | "white" | "pizza_hut_style" | "burger_style";

export interface RestaurantRow {
  id: string;
  slug: string;
  custom_subdomain: string | null;
  name: string;
  tagline: string | null;
  description: string | null;
  whatsapp_number: string;
  whatsapp_display: string | null;
  address: string | null;
  hours: string | null;
  city: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  hero_media_type: string;
  hero_video_url: string | null;
  primary_color: string;
  secondary_color: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  flycontrol_enabled?: boolean;
  flycontrol_api_url?: string | null;
  // flycontrol_api_key is sensitive and handled server-side/via RPC
  flycontrol_api_key?: string | null;
  flycontrol_base_url?: string | null;
  flycontrol_register_url?: string | null;
  flycontrol_tenant_id?: string | null;
  whatsapp_enabled?: boolean;
  show_item_images?: boolean;
  selected_template?: SiteTemplate;
}

export interface BeverageRow {
  id: string;
  pizzeria_id: string;
  name: string;
  brand: string | null;
  size: string | null;
  price: number;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface SiteData {
  restaurant: RestaurantRow;
  categories: (MenuCategoryRow & { items: MenuItemRow[] })[];
  comboGroups: (ComboGroupRow & { combos: ComboRow[] })[];
  deliveryZones?: DeliveryZoneRow[];
   beverages?: BeverageRow[];
   pizzaSizes?: PizzaSize[];
}

export interface CartLine {
  itemId: string;
  name: string;
  description: string;
  unitPrice: number;
  quantity: number;
  sizeLabel?: string;
  flavors?: string[];
  specialFlavors?: string[];
  extras?: number;
}

export interface DeliveryZoneRow {
  id: string;
  restaurant_id: string;
  neighborhood: string;
  fee: number;
  sort_order: number;
}
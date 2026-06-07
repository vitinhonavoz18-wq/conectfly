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

export interface BeverageCatalogRow {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  active: boolean;
  sort_order: number;
}


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
  description: string | null;
  icon: string | null;
  image_url: string | null;
  sort_order: number;
  is_pizza: boolean;
  type: string;
  pizza_sizes: PizzaSize[] | null;
  is_active: boolean;
  show_on_public_site: boolean;
  show_directly_in_menu: boolean;
  show_as_clickable_category: boolean;
  allow_cart_addition: boolean;
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

export type SiteTemplate = "black" | "white" | "pizza_hut_style" | "burger_style" | "bar_prime";

export type BusinessType = 
  | "Pizzaria"
  | "Pastelaria"
  | "Hamburgueria"
  | "Restaurante"
  | "Lanchonete"
  | "Açaíteria"
  | "Farmácia"
  | "Mercado"
  | "Outro";

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
  flycontrol_api_key?: string | null;
  flycontrol_base_url?: string | null;
  flycontrol_register_url?: string | null;
  flycontrol_tenant_id?: string | null;
  delivery_enabled?: boolean;
  pickup_enabled?: boolean;
  table_enabled?: boolean;
  whatsapp_enabled?: boolean;
  show_item_images?: boolean;
  selected_template?: SiteTemplate;
  business_type?: BusinessType;
  theme_settings?: any;
  site_settings?: {
    hero_button_text?: string;
    show_hero_button?: boolean;
    entry_mode?: "navigation" | "direct";
    combos_visibility?: "auto" | "always" | "hide";
    show_categories_section?: boolean;
    beverages_visibility?: boolean;
    beverages_position?: "after_products" | "after_combos" | "end";
    primaryButtonText?: string;
    show_cart_button?: boolean;
    // Legado - movido para o topo
    external_webhook_url?: string;
    order_flow_mode?: "fiqon" | "direct" | "whatsapp";
    allow_double_send?: boolean;
  };
  // Novos campos para fluxo de pedidos
  order_flow_mode?: "fiqon" | "direct" | "whatsapp";
  fiqon_webhook_url?: string | null;
  continue_opening_whatsapp?: boolean;
  allow_dual_send?: boolean;
  flycontrol_direct_url?: string | null;
  menu_sync_endpoint?: string | null;

  customization?: {
    primaryButtonText?: string;
  };
  hero_settings?: {
    primaryButtonText?: string;
  };
  checkout_settings?: any;
  delivery_settings?: any;
  seo_settings?: any;
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
  description: string | null;
  image_url: string | null;
  category: string | null;
  catalog_id?: string | null;
  created_at?: string;

  updated_at?: string;
}

export interface SiteData {
  restaurant: RestaurantRow;
  categories: (MenuCategoryRow & { items: MenuItemRow[] })[];
  comboGroups: (ComboGroupRow & { combos: ComboRow[] })[];
  deliveryZones?: DeliveryZoneRow[];
   beverages?: BeverageRow[];
   beverageCatalogs?: BeverageCatalogRow[];
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

export interface RestaurantTableRow {
  id: string;
  restaurant_id: string;
  table_number: string;
  table_name: string | null;
  public_token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TableSessionRow {
  id: string;
  restaurant_id: string;
  table_id: string;
  table_number: string;
  status: 'open' | 'closed';
  total_amount: number;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  orders?: any[]; // For summary
}
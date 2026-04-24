export type Size = { label: string; price: number };

export interface MenuItemRow {
  id: string;
  category_id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  sizes: Size[] | null;
  sort_order: number;
}

export interface MenuCategoryRow {
  id: string;
  restaurant_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
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
}

export interface ComboGroupRow {
  id: string;
  restaurant_id: string;
  title: string;
  sort_order: number;
}

export interface RestaurantRow {
  id: string;
  slug: string;
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
  primary_color: string;
  secondary_color: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface SiteData {
  restaurant: RestaurantRow;
  categories: (MenuCategoryRow & { items: MenuItemRow[] })[];
  comboGroups: (ComboGroupRow & { combos: ComboRow[] })[];
}

export interface CartLine {
  itemId: string;
  name: string;
  description: string;
  unitPrice: number;
  quantity: number;
  sizeLabel?: string;
}
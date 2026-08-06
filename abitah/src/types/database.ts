/**
 * Tipos das tabelas do Supabase (espelham supabase/schema.sql).
 * Mantidos manualmente para não exigir o CLI do Supabase no projeto.
 * Se preferir gerar automaticamente:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 */

export type ProductGroupKey = "roupas" | "acessorios";
export type UserRole = "customer" | "admin";
export type CouponType = "percent" | "fixed";
export type OrderStatusRow =
  | "aguardando"
  | "confirmado"
  | "em_separacao"
  | "enviado"
  | "entregue"
  | "cancelado";

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  group_key: ProductGroupKey;
  description: string | null;
  image_url: string | null;
  position: number;
  active: boolean;
  created_at: string;
};

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  category_id: string | null;
  subcategory: string | null;
  price: number;
  sale_price: number | null;
  cost_price: number | null;
  sku: string;
  barcode: string | null;
  material: string;
  care: string[];
  size_guide: { size: string; chest: string; waist: string; length: string }[];
  weight_grams: number;
  height_cm: number;
  width_cm: number;
  length_cm: number;
  is_featured: boolean;
  is_new: boolean;
  is_best_seller: boolean;
  is_active: boolean;
  is_demo: boolean;
  sales_count: number;
  created_at: string;
  updated_at: string;
};

export type ProductImageRow = {
  id: string;
  product_id: string;
  url: string;
  alt: string;
  position: number;
  is_primary: boolean;
  created_at: string;
};

export type ProductVariantRow = {
  id: string;
  product_id: string;
  size: string;
  color: string;
  color_hex: string;
  sku: string;
  stock: number;
  price_delta: number;
  created_at: string;
};

export type InventoryRow = {
  id: string;
  variant_id: string;
  change: number;
  reason: string;
  created_at: string;
};

export type AddressRow = {
  id: string;
  user_id: string;
  label: string;
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  is_default: boolean;
  created_at: string;
};

export type CouponRow = {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  min_order_value: number;
  description: string;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

export type OrderRow = {
  id: string;
  code: string;
  user_id: string | null;
  status: OrderStatusRow;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_cpf: string | null;
  shipping_method: string;
  shipping_price: number;
  coupon_code: string | null;
  discount: number;
  subtotal: number;
  total: number;
  notes: string | null;
  address: {
    cep: string;
    street: string;
    number: string;
    complement?: string | null;
    district: string;
    city: string;
    state: string;
  } | null;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_slug: string;
  image_url: string | null;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  total: number;
};

export type FavoriteRow = {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
};

export type BannerRow = {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_href: string;
  image_url: string | null;
  active: boolean;
  position: number;
  updated_at: string;
};

export type SiteSettingRow = {
  key: string;
  value: string;
  updated_at: string;
};

export type NewsletterSubscriberRow = {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  created_at: string;
};

export type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  handled: boolean;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: { Row: ProfileRow };
      categories: { Row: CategoryRow };
      products: { Row: ProductRow };
      product_images: { Row: ProductImageRow };
      product_variants: { Row: ProductVariantRow };
      inventory: { Row: InventoryRow };
      addresses: { Row: AddressRow };
      coupons: { Row: CouponRow };
      orders: { Row: OrderRow };
      order_items: { Row: OrderItemRow };
      favorites: { Row: FavoriteRow };
      banners: { Row: BannerRow };
      site_settings: { Row: SiteSettingRow };
      newsletter_subscribers: { Row: NewsletterSubscriberRow };
      contact_messages: { Row: ContactMessageRow };
    };
  };
};

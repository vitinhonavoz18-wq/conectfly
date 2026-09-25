/** Tipos de domínio da loja — usados tanto no modo demo quanto com Supabase. */

export type ProductGroup = "roupas" | "acessorios";

export type Category = {
  id: string;
  slug: string;
  name: string;
  group: ProductGroup;
  description: string | null;
  imageUrl: string | null;
  position: number;
  active: boolean;
};

export type ProductImage = {
  id: string;
  url: string | null;
  alt: string;
  position: number;
  isPrimary: boolean;
};

export type ProductVariant = {
  id: string;
  size: string;
  color: string;
  /** Hex usado na bolinha de cor do card. */
  colorHex: string;
  sku: string;
  stock: number;
  /** Ajuste de preço da variação (raro; normalmente 0). */
  priceDelta: number;
};

export type ProductDimensions = {
  weightGrams: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  group: ProductGroup;
  subcategory: string | null;
  price: number;
  salePrice: number | null;
  costPrice: number | null;
  sku: string;
  barcode: string | null;
  material: string;
  care: string[];
  sizeGuide: { size: string; chest: string; waist: string; length: string }[];
  dimensions: ProductDimensions;
  images: ProductImage[];
  variants: ProductVariant[];
  isFeatured: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  isDemo: boolean;
  salesCount: number;
  createdAt: string;
};

export type ProductSort =
  | "relevancia"
  | "menor-preco"
  | "maior-preco"
  | "novidades"
  | "mais-vendidos";

export type ProductFilters = {
  search?: string;
  categorySlug?: string;
  group?: ProductGroup;
  sizes?: string[];
  colors?: string[];
  minPrice?: number;
  maxPrice?: number;
  onlyAvailable?: boolean;
  onlyNew?: boolean;
  onlyBestSellers?: boolean;
  onlyFeatured?: boolean;
  sort?: ProductSort;
  page?: number;
  perPage?: number;
};

export type ProductListResult = {
  items: Product[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type Coupon = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrderValue: number;
  active: boolean;
  expiresAt: string | null;
  description: string;
};

export type Banner = {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string | null;
  active: boolean;
  position: number;
};

export type OrderStatus =
  | "aguardando"
  | "confirmado"
  | "em_separacao"
  | "enviado"
  | "entregue"
  | "cancelado";

export const orderStatusLabels: Record<OrderStatus, string> = {
  aguardando: "Aguardando pagamento",
  confirmado: "Pagamento confirmado",
  em_separacao: "Em separação",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  imageUrl: string | null;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type Order = {
  id: string;
  code: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingMethod: string;
  shippingPrice: number;
  discount: number;
  couponCode: string | null;
  subtotal: number;
  total: number;
  address: {
    cep: string;
    street: string;
    number: string;
    complement: string | null;
    district: string;
    city: string;
    state: string;
  } | null;
  items: OrderItem[];
  createdAt: string;
};

export type Address = {
  id: string;
  label: string;
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  isDefault: boolean;
};

export type Profile = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  role: "customer" | "admin";
  createdAt: string;
};

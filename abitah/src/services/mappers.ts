import type { Category, Product, ProductGroup } from "@/types/catalog";

/* Conversores linha do banco → tipos de domínio. Mantidos isolados para que
   qualquer mudança de schema fique concentrada em um único arquivo. */

type Row = Record<string, unknown>;

const str = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;
const num = (value: unknown, fallback = 0): number =>
  typeof value === "number" ? value : Number(value ?? fallback) || fallback;
const bool = (value: unknown): boolean => value === true;

export function mapCategory(row: Row): Category {
  return {
    id: str(row.id),
    slug: str(row.slug),
    name: str(row.name),
    group: (str(row.group_key, "roupas") as ProductGroup) ?? "roupas",
    description: (row.description as string | null) ?? null,
    imageUrl: (row.image_url as string | null) ?? null,
    position: num(row.position),
    active: row.active !== false,
  };
}

export function mapProduct(row: Row): Product {
  const category = (row.category ?? {}) as Row;
  const images = Array.isArray(row.images) ? (row.images as Row[]) : [];
  const variants = Array.isArray(row.variants) ? (row.variants as Row[]) : [];

  const sortedImages = images
    .map((image) => ({
      id: str(image.id),
      url: (image.url as string | null) ?? null,
      alt: str(image.alt, str(row.name)),
      position: num(image.position),
      isPrimary: bool(image.is_primary),
    }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position);

  return {
    id: str(row.id),
    slug: str(row.slug),
    name: str(row.name),
    shortDescription: str(row.short_description),
    description: str(row.description),
    categorySlug: str(category.slug),
    categoryName: str(category.name),
    group: (str(category.group_key, "roupas") as ProductGroup) ?? "roupas",
    subcategory: (row.subcategory as string | null) ?? null,
    price: num(row.price),
    salePrice: row.sale_price == null ? null : num(row.sale_price),
    costPrice: row.cost_price == null ? null : num(row.cost_price),
    sku: str(row.sku),
    barcode: (row.barcode as string | null) ?? null,
    material: str(row.material),
    care: Array.isArray(row.care) ? (row.care as string[]) : [],
    sizeGuide: Array.isArray(row.size_guide)
      ? (row.size_guide as Product["sizeGuide"])
      : [],
    dimensions: {
      weightGrams: num(row.weight_grams),
      heightCm: num(row.height_cm),
      widthCm: num(row.width_cm),
      lengthCm: num(row.length_cm),
    },
    images: sortedImages.length
      ? sortedImages
      : [{ id: `${str(row.id)}-placeholder`, url: null, alt: str(row.name), position: 0, isPrimary: true }],
    variants: variants
      .map((variant) => ({
        id: str(variant.id),
        size: str(variant.size, "Único"),
        color: str(variant.color, "Preto"),
        colorHex: str(variant.color_hex, "#0A0A0A"),
        sku: str(variant.sku),
        stock: num(variant.stock),
        priceDelta: num(variant.price_delta),
      }))
      .sort((a, b) => a.color.localeCompare(b.color) || a.size.localeCompare(b.size)),
    isFeatured: bool(row.is_featured),
    isNew: bool(row.is_new),
    isBestSeller: bool(row.is_best_seller),
    isActive: row.is_active !== false,
    isDemo: bool(row.is_demo),
    salesCount: num(row.sales_count),
    createdAt: str(row.created_at, new Date().toISOString()),
  };
}

/** Seleção usada em todas as consultas de produto. */
export const PRODUCT_SELECT =
  "*, category:categories(id, slug, name, group_key), images:product_images(*), variants:product_variants(*)";

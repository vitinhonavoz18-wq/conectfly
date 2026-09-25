import { demoCategories } from "@/data/categories";
import { demoProducts } from "@/data/products";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { PRODUCT_SELECT, mapCategory, mapProduct } from "@/services/mappers";
import { effectivePrice, unique } from "@/lib/utils";
import type {
  Category,
  Product,
  ProductFilters,
  ProductListResult,
} from "@/types/catalog";

/* ---------------------------------------------------------------------------
 * Camada de acesso ao catálogo.
 * Uma única API para as páginas; internamente escolhe Supabase ou modo demo.
 * ------------------------------------------------------------------------- */

export function isDemoMode(): boolean {
  return !isSupabaseConfigured();
}

async function fetchAllProducts(): Promise<Product[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return demoProducts;

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error || !data?.length) {
    // Falha de conexão ou banco ainda vazio: mantém a loja navegável.
    return demoProducts;
  }
  return data.map((row) => mapProduct(row as Record<string, unknown>));
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return demoCategories;

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("active", true)
    .order("position");

  if (error || !data?.length) return demoCategories;
  return data.map((row) => mapCategory(row as Record<string, unknown>));
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

function productInStock(product: Product): boolean {
  return product.variants.some((variant) => variant.stock > 0);
}

function matchesFilters(product: Product, filters: ProductFilters): boolean {
  const price = effectivePrice(product.price, product.salePrice);

  if (filters.search) {
    const needle = filters.search.toLowerCase().trim();
    const haystack = [
      product.name,
      product.shortDescription,
      product.categoryName,
      product.subcategory ?? "",
      product.material,
    ]
      .join(" ")
      .toLowerCase();
    if (!needle.split(/\s+/).every((token) => haystack.includes(token))) return false;
  }

  if (filters.categorySlug && product.categorySlug !== filters.categorySlug) return false;
  if (filters.group && product.group !== filters.group) return false;
  if (filters.minPrice != null && price < filters.minPrice) return false;
  if (filters.maxPrice != null && price > filters.maxPrice) return false;
  if (filters.onlyNew && !product.isNew) return false;
  if (filters.onlyBestSellers && !product.isBestSeller) return false;
  if (filters.onlyFeatured && !product.isFeatured) return false;
  if (filters.onlyAvailable && !productInStock(product)) return false;

  if (filters.sizes?.length) {
    const has = product.variants.some(
      (variant) => filters.sizes!.includes(variant.size) && variant.stock > 0,
    );
    if (!has) return false;
  }

  if (filters.colors?.length) {
    const has = product.variants.some((variant) => filters.colors!.includes(variant.color));
    if (!has) return false;
  }

  return true;
}

function sortProducts(products: Product[], sort: ProductFilters["sort"]): Product[] {
  const list = [...products];
  switch (sort) {
    case "menor-preco":
      return list.sort(
        (a, b) =>
          effectivePrice(a.price, a.salePrice) - effectivePrice(b.price, b.salePrice),
      );
    case "maior-preco":
      return list.sort(
        (a, b) =>
          effectivePrice(b.price, b.salePrice) - effectivePrice(a.price, a.salePrice),
      );
    case "novidades":
      return list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    case "mais-vendidos":
      return list.sort((a, b) => b.salesCount - a.salesCount);
    default:
      // Relevância: destaques primeiro, depois mais vendidos.
      return list.sort(
        (a, b) =>
          Number(b.isFeatured) - Number(a.isFeatured) ||
          b.salesCount - a.salesCount ||
          a.name.localeCompare(b.name),
      );
  }
}

export async function listProducts(filters: ProductFilters = {}): Promise<ProductListResult> {
  const all = await fetchAllProducts();
  const filtered = sortProducts(
    all.filter((product) => matchesFilters(product, filters)),
    filters.sort,
  );

  const perPage = filters.perPage ?? 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const start = (page - 1) * perPage;

  return {
    items: filtered.slice(start, start + perPage),
    total: filtered.length,
    page,
    perPage,
    totalPages,
  };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const all = await fetchAllProducts();
  return all.find((product) => product.slug === slug) ?? null;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const all = await fetchAllProducts();
  const byId = new Map(all.map((product) => [product.id, product]));
  return ids.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product));
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const all = await fetchAllProducts();
  const sameCategory = all.filter(
    (item) => item.id !== product.id && item.categorySlug === product.categorySlug,
  );
  const sameGroup = all.filter(
    (item) =>
      item.id !== product.id &&
      item.group === product.group &&
      item.categorySlug !== product.categorySlug,
  );
  return [...sameCategory, ...sameGroup].slice(0, limit);
}

export async function getShowcase(
  key: "novidades" | "mais-vendidos" | "destaques" | "roupas" | "acessorios",
  limit = 8,
): Promise<Product[]> {
  const filters: ProductFilters = { perPage: limit, page: 1 };

  switch (key) {
    case "novidades":
      filters.sort = "novidades";
      break;
    case "mais-vendidos":
      filters.sort = "mais-vendidos";
      break;
    case "destaques":
      filters.onlyFeatured = true;
      break;
    case "roupas":
      filters.group = "roupas";
      filters.sort = "relevancia";
      break;
    case "acessorios":
      filters.group = "acessorios";
      filters.sort = "relevancia";
      break;
  }

  const { items } = await listProducts(filters);
  return items;
}

/** Opções de filtro derivadas do catálogo real (tamanhos, cores, faixa de preço). */
export async function getFacets() {
  const all = await fetchAllProducts();
  const sizes = unique(all.flatMap((p) => p.variants.map((v) => v.size)));
  const colorEntries = new Map<string, string>();
  all.forEach((p) => p.variants.forEach((v) => colorEntries.set(v.color, v.colorHex)));

  const prices = all.map((p) => effectivePrice(p.price, p.salePrice));
  const sizeOrder = ["PP", "P", "M", "G", "GG", "XGG", "Único"];

  return {
    sizes: sizes.sort((a, b) => {
      const ia = sizeOrder.indexOf(a);
      const ib = sizeOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }),
    colors: Array.from(colorEntries, ([name, hex]) => ({ name, hex })).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    minPrice: prices.length ? Math.floor(Math.min(...prices)) : 0,
    maxPrice: prices.length ? Math.ceil(Math.max(...prices)) : 500,
  };
}

export async function getAllProductSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const all = await fetchAllProducts();
  return all.map((product) => ({ slug: product.slug, updatedAt: product.createdAt }));
}

"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_SELECT, mapCategory, mapProduct } from "@/services/mappers";
import { slugify } from "@/lib/utils";
import type { Category, Product } from "@/types/catalog";

/* Operações administrativas executadas com a sessão do admin.
   As políticas RLS do Supabase garantem que apenas admins consigam gravar. */

export const PRODUCT_IMAGES_BUCKET = "product-images";

export async function adminListProducts(supabase: SupabaseClient): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapProduct(row as Record<string, unknown>));
}

export async function adminGetProduct(
  supabase: SupabaseClient,
  id: string,
): Promise<Product | null> {
  const { data } = await supabase.from("products").select(PRODUCT_SELECT).eq("id", id).maybeSingle();
  return data ? mapProduct(data as Record<string, unknown>) : null;
}

export async function adminListCategories(supabase: SupabaseClient): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("*").order("position");
  if (error) throw error;
  return (data ?? []).map((row) => mapCategory(row as Record<string, unknown>));
}

export type ProductInput = {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  subcategory?: string | null;
  price: number;
  salePrice?: number | null;
  costPrice?: number | null;
  sku: string;
  barcode?: string | null;
  material: string;
  care: string[];
  weightGrams: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  isFeatured: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  isActive: boolean;
};

export type VariantInput = {
  size: string;
  color: string;
  colorHex: string;
  stock: number;
  sku: string;
};

function toRow(input: ProductInput) {
  return {
    name: input.name,
    slug: input.slug,
    short_description: input.shortDescription,
    description: input.description,
    category_id: input.categoryId,
    subcategory: input.subcategory || null,
    price: input.price,
    sale_price: input.salePrice && input.salePrice > 0 ? input.salePrice : null,
    cost_price: input.costPrice && input.costPrice > 0 ? input.costPrice : null,
    sku: input.sku,
    barcode: input.barcode || null,
    material: input.material,
    care: input.care,
    weight_grams: input.weightGrams,
    height_cm: input.heightCm,
    width_cm: input.widthCm,
    length_cm: input.lengthCm,
    is_featured: input.isFeatured,
    is_new: input.isNew,
    is_best_seller: input.isBestSeller,
    is_active: input.isActive,
    is_demo: false,
  };
}

async function replaceVariants(
  supabase: SupabaseClient,
  productId: string,
  variants: VariantInput[],
) {
  await supabase.from("product_variants").delete().eq("product_id", productId);
  if (!variants.length) return;

  await supabase.from("product_variants").insert(
    variants.map((variant) => ({
      product_id: productId,
      size: variant.size,
      color: variant.color,
      color_hex: variant.colorHex,
      stock: variant.stock,
      sku: variant.sku,
      price_delta: 0,
    })),
  );
}

export async function adminCreateProduct(
  supabase: SupabaseClient,
  input: ProductInput,
  variants: VariantInput[],
): Promise<string> {
  const { data, error } = await supabase.from("products").insert(toRow(input)).select("id").single();
  if (error) throw error;
  await replaceVariants(supabase, data.id as string, variants);
  return data.id as string;
}

export async function adminUpdateProduct(
  supabase: SupabaseClient,
  id: string,
  input: ProductInput,
  variants: VariantInput[],
): Promise<void> {
  const { error } = await supabase.from("products").update(toRow(input)).eq("id", id);
  if (error) throw error;
  await replaceVariants(supabase, id, variants);
}

export async function adminDeleteProduct(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function adminToggleFlag(
  supabase: SupabaseClient,
  id: string,
  column: "is_active" | "is_featured" | "is_new" | "is_best_seller",
  value: boolean,
): Promise<void> {
  const { error } = await supabase.from("products").update({ [column]: value }).eq("id", id);
  if (error) throw error;
}

/** Duplica um produto com todas as variações e imagens. */
export async function adminDuplicateProduct(
  supabase: SupabaseClient,
  product: Product,
): Promise<string> {
  const baseSlug = slugify(`${product.name}-copia`);
  const suffix = Date.now().toString().slice(-4);

  const { data, error } = await supabase
    .from("products")
    .insert({
      name: `${product.name} (cópia)`,
      slug: `${baseSlug}-${suffix}`,
      short_description: product.shortDescription,
      description: product.description,
      category_id: null,
      subcategory: product.subcategory,
      price: product.price,
      sale_price: product.salePrice,
      cost_price: product.costPrice,
      sku: `${product.sku}-C${suffix}`,
      material: product.material,
      care: product.care,
      weight_grams: product.dimensions.weightGrams,
      height_cm: product.dimensions.heightCm,
      width_cm: product.dimensions.widthCm,
      length_cm: product.dimensions.lengthCm,
      is_featured: false,
      is_new: product.isNew,
      is_best_seller: false,
      is_active: false,
      is_demo: false,
    })
    .select("id")
    .single();

  if (error) throw error;
  const newId = data.id as string;

  // Copia categoria por slug (evita depender do id em cache).
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", product.categorySlug)
    .maybeSingle();
  if (category) {
    await supabase.from("products").update({ category_id: category.id }).eq("id", newId);
  }

  await replaceVariants(
    supabase,
    newId,
    product.variants.map((variant) => ({
      size: variant.size,
      color: variant.color,
      colorHex: variant.colorHex,
      stock: variant.stock,
      sku: `${variant.sku}-C${suffix}`,
    })),
  );

  const imagesToCopy = product.images.filter((image) => image.url);
  if (imagesToCopy.length) {
    await supabase.from("product_images").insert(
      imagesToCopy.map((image) => ({
        product_id: newId,
        url: image.url,
        alt: image.alt,
        position: image.position,
        is_primary: image.isPrimary,
      })),
    );
  }

  return newId;
}

/* -------------------------------- imagens -------------------------------- */

export async function uploadProductImage(
  supabase: SupabaseClient,
  productId: string,
  file: File,
  position: number,
): Promise<void> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${productId}/${Date.now()}-${position}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { cacheControl: "31536000", upsert: false });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);

  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    url: publicUrl,
    alt: "",
    position,
    is_primary: position === 0,
  });

  if (error) throw error;
}

export async function deleteProductImage(supabase: SupabaseClient, imageId: string) {
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) throw error;
}

export async function setPrimaryImage(
  supabase: SupabaseClient,
  productId: string,
  imageId: string,
) {
  await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
  const { error } = await supabase
    .from("product_images")
    .update({ is_primary: true })
    .eq("id", imageId);
  if (error) throw error;
}

export async function reorderImages(
  supabase: SupabaseClient,
  ordered: { id: string; position: number }[],
) {
  await Promise.all(
    ordered.map(({ id, position }) =>
      supabase.from("product_images").update({ position }).eq("id", id),
    ),
  );
}

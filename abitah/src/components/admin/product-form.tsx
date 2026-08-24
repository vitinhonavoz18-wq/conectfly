"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ProductImagesManager } from "@/components/admin/product-images-manager";
import {
  adminCreateProduct,
  adminListCategories,
  adminUpdateProduct,
  type VariantInput,
} from "@/services/admin";
import { productSchema, type ProductFormValues } from "@/lib/validations";
import { slugify } from "@/lib/utils";
import { COLORS } from "@/data/products";
import type { Category, Product } from "@/types/catalog";

const colorHexByName = new Map(
  Object.values(COLORS).map((color) => [color.name.toLowerCase(), color.hex]),
);

/** "Preto, Verde Neon" → variações combinadas com cada tamanho. */
function buildVariants(
  sizesRaw: string,
  colorsRaw: string,
  stock: number,
  sku: string,
): VariantInput[] {
  const sizes = sizesRaw.split(",").map((value) => value.trim()).filter(Boolean);
  const colors = colorsRaw.split(",").map((value) => value.trim()).filter(Boolean);
  const variants: VariantInput[] = [];

  colors.forEach((color) => {
    sizes.forEach((size) => {
      variants.push({
        size,
        color,
        colorHex: colorHexByName.get(color.toLowerCase()) ?? "#0A0A0A",
        stock,
        sku: `${sku}-${color.slice(0, 3).toUpperCase()}-${size}`,
      });
    });
  });

  return variants;
}

export function ProductForm({ product }: { product?: Product }) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const { notify } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [productId, setProductId] = useState(product?.id ?? null);

  const defaultValues = useMemo<ProductFormValues>(
    () => ({
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      shortDescription: product?.shortDescription ?? "",
      description: product?.description ?? "",
      categorySlug: product?.categorySlug ?? "",
      subcategory: product?.subcategory ?? "",
      price: product?.price ?? 0,
      salePrice: product?.salePrice ?? 0,
      costPrice: product?.costPrice ?? 0,
      sku: product?.sku ?? "",
      barcode: product?.barcode ?? "",
      material: product?.material ?? "",
      care: product?.care.join("\n") ?? "",
      sizes: product ? [...new Set(product.variants.map((v) => v.size))].join(", ") : "P, M, G, GG",
      colors: product ? [...new Set(product.variants.map((v) => v.color))].join(", ") : "Preto",
      stock: product
        ? Math.max(0, ...product.variants.map((v) => v.stock))
        : 10,
      weightGrams: product?.dimensions.weightGrams ?? 250,
      heightCm: product?.dimensions.heightCm ?? 6,
      widthCm: product?.dimensions.widthCm ?? 26,
      lengthCm: product?.dimensions.lengthCm ?? 34,
      isFeatured: product?.isFeatured ?? false,
      isNew: product?.isNew ?? true,
      isBestSeller: product?.isBestSeller ?? false,
      isActive: product?.isActive ?? true,
    }),
    [product],
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!supabase) return;
    adminListCategories(supabase)
      .then(setCategories)
      .catch(() => notify("Não foi possível carregar as categorias.", "error"));
  }, [supabase, notify]);

  const nameValue = watch("name");

  async function onSubmit(values: ProductFormValues) {
    if (!supabase) return;

    const category = categories.find((item) => item.slug === values.categorySlug);
    if (!category) {
      notify("Selecione uma categoria válida.", "error");
      return;
    }

    const input = {
      name: String(values.name),
      slug: String(values.slug),
      shortDescription: String(values.shortDescription),
      description: String(values.description),
      categoryId: category.id,
      subcategory: values.subcategory ? String(values.subcategory) : null,
      price: Number(values.price),
      salePrice: Number(values.salePrice ?? 0),
      costPrice: Number(values.costPrice ?? 0),
      sku: String(values.sku),
      barcode: values.barcode ? String(values.barcode) : null,
      material: String(values.material),
      care: String(values.care ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      weightGrams: Number(values.weightGrams),
      heightCm: Number(values.heightCm),
      widthCm: Number(values.widthCm),
      lengthCm: Number(values.lengthCm),
      isFeatured: Boolean(values.isFeatured),
      isNew: Boolean(values.isNew),
      isBestSeller: Boolean(values.isBestSeller),
      isActive: Boolean(values.isActive),
    };

    const variants = buildVariants(
      String(values.sizes),
      String(values.colors),
      Number(values.stock),
      String(values.sku),
    );

    try {
      if (productId) {
        await adminUpdateProduct(supabase, productId, input, variants);
        notify("Produto atualizado.");
      } else {
        const id = await adminCreateProduct(supabase, input, variants);
        setProductId(id);
        notify("Produto criado! Agora adicione as imagens.");
        router.replace(`/admin/produtos/${id}`);
      }
      router.refresh();
    } catch (error) {
      notify(
        error instanceof Error && error.message.includes("duplicate")
          ? "Já existe um produto com este slug ou SKU."
          : "Não foi possível salvar o produto.",
        "error",
      );
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <section className="rounded-card border border-ink-700 bg-ink-900 p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
            Informações básicas
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-6">
            <Field
              label="Nome"
              htmlFor="p-name"
              required
              error={errors.name?.message}
              className="sm:col-span-4"
            >
              <Input
                id="p-name"
                {...register("name", {
                  onBlur: () => {
                    if (!watch("slug") && nameValue) setValue("slug", slugify(String(nameValue)));
                  },
                })}
              />
            </Field>

            <Field
              label="Slug (URL)"
              htmlFor="p-slug"
              required
              error={errors.slug?.message}
              className="sm:col-span-2"
              hint="Usado no endereço do produto."
            >
              <Input id="p-slug" {...register("slug")} />
            </Field>

            <Field
              label="Categoria"
              htmlFor="p-category"
              required
              error={errors.categorySlug?.message}
              className="sm:col-span-3"
            >
              <Select id="p-category" {...register("categorySlug")}>
                <option value="">Selecione</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Subcategoria" htmlFor="p-subcategory" className="sm:col-span-3">
              <Input id="p-subcategory" placeholder="Oversized, Feminino..." {...register("subcategory")} />
            </Field>

            <Field
              label="Descrição curta"
              htmlFor="p-short"
              required
              error={errors.shortDescription?.message}
              className="sm:col-span-6"
              hint="Aparece nos cards e no topo da página do produto."
            >
              <Input id="p-short" {...register("shortDescription")} />
            </Field>

            <Field
              label="Descrição completa"
              htmlFor="p-description"
              required
              error={errors.description?.message}
              className="sm:col-span-6"
            >
              <Textarea id="p-description" className="min-h-40" {...register("description")} />
            </Field>
          </div>
        </section>

        <section className="rounded-card border border-ink-700 bg-ink-900 p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
            Preços e códigos
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            <Field label="Preço (R$)" htmlFor="p-price" required error={errors.price?.message}>
              <Input id="p-price" type="number" step="0.01" min="0" {...register("price")} />
            </Field>
            <Field
              label="Preço promocional"
              htmlFor="p-sale"
              error={errors.salePrice?.message}
              hint="Deixe 0 para desativar."
            >
              <Input id="p-sale" type="number" step="0.01" min="0" {...register("salePrice")} />
            </Field>
            <Field label="Custo (opcional)" htmlFor="p-cost" error={errors.costPrice?.message}>
              <Input id="p-cost" type="number" step="0.01" min="0" {...register("costPrice")} />
            </Field>
            <Field label="SKU" htmlFor="p-sku" required error={errors.sku?.message}>
              <Input id="p-sku" {...register("sku")} />
            </Field>
            <Field label="Código de barras" htmlFor="p-barcode" className="sm:col-span-2">
              <Input id="p-barcode" {...register("barcode")} />
            </Field>
          </div>
        </section>

        <section className="rounded-card border border-ink-700 bg-ink-900 p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
            Grade, estoque e material
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-6">
            <Field
              label="Tamanhos"
              htmlFor="p-sizes"
              required
              error={errors.sizes?.message}
              className="sm:col-span-2"
              hint="Separados por vírgula. Ex.: P, M, G, GG"
            >
              <Input id="p-sizes" {...register("sizes")} />
            </Field>

            <Field
              label="Cores"
              htmlFor="p-colors"
              required
              error={errors.colors?.message}
              className="sm:col-span-2"
              hint="Ex.: Preto, Grafite, Verde Neon"
            >
              <Input id="p-colors" {...register("colors")} />
            </Field>

            <Field
              label="Estoque por variação"
              htmlFor="p-stock"
              required
              error={errors.stock?.message}
              className="sm:col-span-2"
            >
              <Input id="p-stock" type="number" min="0" {...register("stock")} />
            </Field>

            <Field
              label="Material"
              htmlFor="p-material"
              required
              error={errors.material?.message}
              className="sm:col-span-6"
            >
              <Input id="p-material" {...register("material")} />
            </Field>

            <Field
              label="Instruções de conservação"
              htmlFor="p-care"
              className="sm:col-span-6"
              hint="Uma instrução por linha."
            >
              <Textarea id="p-care" {...register("care")} />
            </Field>
          </div>
        </section>

        <section className="rounded-card border border-ink-700 bg-ink-900 p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
            Dimensões para envio
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            <Field label="Peso (g)" htmlFor="p-weight" error={errors.weightGrams?.message}>
              <Input id="p-weight" type="number" min="0" {...register("weightGrams")} />
            </Field>
            <Field label="Altura (cm)" htmlFor="p-height" error={errors.heightCm?.message}>
              <Input id="p-height" type="number" min="0" {...register("heightCm")} />
            </Field>
            <Field label="Largura (cm)" htmlFor="p-width" error={errors.widthCm?.message}>
              <Input id="p-width" type="number" min="0" {...register("widthCm")} />
            </Field>
            <Field label="Comprimento (cm)" htmlFor="p-length" error={errors.lengthCm?.message}>
              <Input id="p-length" type="number" min="0" {...register("lengthCm")} />
            </Field>
          </div>
        </section>

        <section className="rounded-card border border-ink-700 bg-ink-900 p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
            Vitrines e visibilidade
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { id: "isFeatured", label: "Produto em destaque" },
              { id: "isNew", label: "Lançamento" },
              { id: "isBestSeller", label: "Mais vendido" },
              { id: "isActive", label: "Produto ativo (visível na loja)" },
            ].map((flag) => (
              <label
                key={flag.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-ink-600 p-3.5 transition-colors hover:border-smoke-400"
              >
                <Checkbox {...register(flag.id as keyof ProductFormValues)} />
                <span className="text-sm text-smoke-200">{flag.label}</span>
              </label>
            ))}
          </div>
        </section>

        <Button type="submit" size="lg" disabled={isSubmitting}>
          <Save className="h-4 w-4" aria-hidden />
          {isSubmitting ? "Salvando..." : productId ? "Salvar alterações" : "Criar produto"}
        </Button>
      </form>

      {productId ? (
        <ProductImagesManager productId={productId} initialImages={product?.images ?? []} />
      ) : (
        <p className="rounded-card border border-dashed border-ink-600 bg-ink-900 p-5 text-sm text-smoke-300">
          Salve o produto para liberar o envio de imagens.
        </p>
      )}
    </div>
  );
}

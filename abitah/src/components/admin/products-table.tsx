"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Copy, Eye, EyeOff, Pencil, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { MediaFrame } from "@/components/ui/media-frame";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  adminDeleteProduct,
  adminDuplicateProduct,
  adminListProducts,
  adminToggleFlag,
} from "@/services/admin";
import { useAsyncData } from "@/hooks/use-async-data";
import { effectivePrice, formatCurrency } from "@/lib/utils";
import type { Product } from "@/types/catalog";

const flagColumns = [
  { key: "is_featured" as const, field: "isFeatured" as const, label: "Destaque" },
  { key: "is_new" as const, field: "isNew" as const, label: "Lançamento" },
  { key: "is_best_seller" as const, field: "isBestSeller" as const, label: "Mais vendido" },
];

export function ProductsTable() {
  const supabase = getSupabaseBrowserClient();
  const { notify } = useToast();
  const [search, setSearch] = useState("");

  const loader = useCallback(
    () => (supabase ? adminListProducts(supabase) : Promise.resolve([])),
    [supabase],
  );
  const { data: products, refresh: load } = useAsyncData<Product[]>(loader, []);

  const filtered = useMemo(() => {
    if (!products) return [];
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      `${product.name} ${product.sku} ${product.categoryName}`.toLowerCase().includes(term),
    );
  }, [products, search]);

  async function toggle(product: Product, key: (typeof flagColumns)[number]["key"] | "is_active", value: boolean) {
    if (!supabase) return;
    try {
      await adminToggleFlag(supabase, product.id, key, value);
      await load();
    } catch {
      notify("Não foi possível atualizar o produto.", "error");
    }
  }

  async function duplicate(product: Product) {
    if (!supabase) return;
    try {
      await adminDuplicateProduct(supabase, product);
      notify(`"${product.name}" duplicado como rascunho inativo.`);
      await load();
    } catch {
      notify("Não foi possível duplicar o produto.", "error");
    }
  }

  async function remove(product: Product) {
    if (!supabase) return;
    if (!window.confirm(`Excluir "${product.name}" definitivamente? Esta ação não pode ser desfeita.`))
      return;
    try {
      await adminDeleteProduct(supabase, product.id);
      notify("Produto excluído.", "info");
      await load();
    } catch {
      notify("Não foi possível excluir o produto.", "error");
    }
  }

  if (products === null) {
    return <div className="h-64 animate-pulse rounded-card bg-ink-900" />;
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-smoke-400"
          aria-hidden
        />
        <label htmlFor="admin-busca" className="sr-only">
          Buscar produtos
        </label>
        <Input
          id="admin-busca"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome, SKU ou categoria"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-card border border-dashed border-ink-600 bg-ink-900 px-6 py-14 text-center text-sm text-smoke-300">
          {products.length === 0
            ? "Nenhum produto cadastrado. Use o botão “Novo produto” para começar — ou rode o seed do Supabase para carregar a demonstração."
            : "Nenhum produto corresponde à busca."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-700">
          <table className="w-full min-w-250 text-left text-sm">
            <thead className="bg-ink-850 text-[11px] uppercase tracking-wider text-smoke-300">
              <tr>
                <th scope="col" className="px-4 py-3">Produto</th>
                <th scope="col" className="px-4 py-3">Categoria</th>
                <th scope="col" className="px-4 py-3">Preço</th>
                <th scope="col" className="px-4 py-3">Estoque</th>
                {flagColumns.map((flag) => (
                  <th key={flag.key} scope="col" className="px-3 py-3 text-center">
                    {flag.label}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 bg-ink-900">
              {filtered.map((product) => {
                const stock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
                const primary = product.images.find((image) => image.isPrimary) ?? product.images[0];
                return (
                  <tr key={product.id} className="text-smoke-300">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <MediaFrame
                          src={primary?.url}
                          alt={product.name}
                          label=""
                          className="aspect-3/4 w-10 shrink-0"
                          sizes="40px"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{product.name}</p>
                          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-smoke-400">
                            {product.sku}
                            {product.isDemo ? <Badge tone="muted">Demonstração</Badge> : null}
                            {!product.isActive ? <Badge tone="muted">Inativo</Badge> : null}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{product.categoryName || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-white">
                        {formatCurrency(effectivePrice(product.price, product.salePrice))}
                      </span>
                      {product.salePrice ? (
                        <span className="ml-1.5 text-[11px] line-through text-smoke-400">
                          {formatCurrency(product.price)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={stock === 0 ? "text-red-400" : ""}>{stock}</span>
                    </td>

                    {flagColumns.map((flag) => (
                      <td key={flag.key} className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={product[flag.field]}
                          onChange={(event) => toggle(product, flag.key, event.target.checked)}
                          aria-label={`${flag.label} — ${product.name}`}
                          className="h-4 w-4 accent-[#29E23D]"
                        />
                      </td>
                    ))}

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => toggle(product, "is_active", !product.isActive)}
                          aria-label={product.isActive ? "Desativar produto" : "Ativar produto"}
                          title={product.isActive ? "Desativar" : "Ativar"}
                          className="rounded p-2 text-smoke-400 transition-colors hover:text-neon-400"
                        >
                          {product.isActive ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicate(product)}
                          aria-label={`Duplicar ${product.name}`}
                          title="Duplicar"
                          className="rounded p-2 text-smoke-400 transition-colors hover:text-neon-400"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <Link
                          href={`/admin/produtos/${product.id}`}
                          aria-label={`Editar ${product.name}`}
                          title="Editar"
                          className="rounded p-2 text-smoke-400 transition-colors hover:text-neon-400"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => remove(product)}
                          aria-label={`Excluir ${product.name}`}
                          title="Excluir"
                          className="rounded p-2 text-smoke-400 transition-colors hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

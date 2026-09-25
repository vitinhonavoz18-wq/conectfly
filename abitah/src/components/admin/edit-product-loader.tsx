"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductForm } from "@/components/admin/product-form";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { adminGetProduct } from "@/services/admin";
import type { Product } from "@/types/catalog";

export function EditProductLoader({ productId }: { productId: string }) {
  const supabase = getSupabaseBrowserClient();
  const [product, setProduct] = useState<Product | null | "missing">(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    adminGetProduct(supabase, productId)
      .then((result) => {
        if (active) setProduct(result ?? "missing");
      })
      .catch(() => {
        if (active) setProduct("missing");
      });

    return () => {
      active = false;
    };
  }, [supabase, productId]);

  if (product === null) return <div className="h-96 animate-pulse rounded-card bg-ink-900" />;

  if (product === "missing") {
    return (
      <div className="rounded-card border border-ink-700 bg-ink-900 p-8 text-center">
        <p className="text-sm text-smoke-300">Produto não encontrado.</p>
        <Link href="/admin/produtos" className="mt-3 inline-block text-sm text-neon-400 hover:underline">
          Voltar para a lista
        </Link>
      </div>
    );
  }

  return <ProductForm product={product} />;
}

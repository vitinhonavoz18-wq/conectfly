import { NextResponse } from "next/server";
import { getAllProductSlugs, listProducts } from "@/services/catalog";

/**
 * Consulta pública de produtos usada por componentes de cliente
 * (vitrine "vistos recentemente" e favoritos).
 * Aceita ?slugs=a,b,c ou ?ids=1,2,3
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slugs = (url.searchParams.get("slugs") ?? "").split(",").filter(Boolean).slice(0, 24);
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 48);

  if (!slugs.length && !ids.length) {
    return NextResponse.json({ products: [] });
  }

  const { items } = await listProducts({ perPage: 500, page: 1 });

  const products = slugs.length
    ? slugs
        .map((slug) => items.find((product) => product.slug === slug))
        .filter((product) => Boolean(product))
    : ids
        .map((id) => items.find((product) => product.id === id))
        .filter((product) => Boolean(product));

  return NextResponse.json({ products });
}

export async function HEAD() {
  const slugs = await getAllProductSlugs();
  return new NextResponse(null, { headers: { "x-product-count": String(slugs.length) } });
}

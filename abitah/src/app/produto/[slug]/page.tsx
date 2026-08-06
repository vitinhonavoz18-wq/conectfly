import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProductGallery } from "@/components/product/product-gallery";
import { PurchasePanel } from "@/components/product/purchase-panel";
import { ProductDetails } from "@/components/product/product-details";
import { ProductGrid } from "@/components/product/product-grid";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { Section } from "@/components/ui/section";
import { getAllProductSlugs, getProductBySlug, getRelatedProducts } from "@/services/catalog";
import { absoluteUrl, discountPercent, effectivePrice } from "@/lib/utils";
import { siteConfig } from "@/config/site";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  const slugs = await getAllProductSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Produto não encontrado" };
  }

  return {
    title: product.name,
    description: product.shortDescription,
    alternates: { canonical: `/produto/${product.slug}` },
    openGraph: {
      type: "website",
      title: `${product.name} | ${siteConfig.name}`,
      description: product.shortDescription,
      url: absoluteUrl(`/produto/${product.slug}`),
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product || !product.isActive) notFound();

  const related = await getRelatedProducts(product, 4);
  const price = effectivePrice(product.price, product.salePrice);
  const discount = discountPercent(product.price, product.salePrice);
  const inStock = product.variants.some((variant) => variant.stock > 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription,
    sku: product.sku,
    category: product.categoryName,
    brand: { "@type": "Brand", name: siteConfig.name },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/produto/${product.slug}`),
      priceCurrency: siteConfig.commerce.currency,
      price: price.toFixed(2),
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Trilha de navegação" className="border-b border-ink-700 bg-ink-900">
        <ol className="container-page flex flex-wrap items-center gap-1 py-4 text-[11px] text-smoke-400">
          <li>
            <Link href="/" className="hover:text-neon-400">
              Início
            </Link>
          </li>
          <li className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" aria-hidden />
            <Link href="/loja" className="hover:text-neon-400">
              Loja
            </Link>
          </li>
          <li className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" aria-hidden />
            <Link href={`/loja?categoria=${product.categorySlug}`} className="hover:text-neon-400">
              {product.categoryName}
            </Link>
          </li>
          <li className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="text-smoke-200">{product.name}</span>
          </li>
        </ol>
      </nav>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-2 lg:gap-14 lg:py-14">
        <ProductGallery
          images={product.images}
          productName={product.name}
          badges={[
            ...(discount ? [{ label: `-${discount}%`, tone: "neon" as const }] : []),
            ...(product.isNew ? [{ label: "Lançamento", tone: "dark" as const }] : []),
            ...(!inStock ? [{ label: "Esgotado", tone: "muted" as const }] : []),
          ]}
        />
        <PurchasePanel product={product} />
      </div>

      <Section tone="graphite">
        <div className="container-page">
          <ProductDetails product={product} />
        </div>
      </Section>

      {related.length ? (
        <Section tone="black">
          <div className="container-page">
            <h2 className="section-rule mb-8 text-xl font-extrabold uppercase text-white">
              Você também pode gostar
            </h2>
            <ProductGrid products={related} animate={false} />
          </div>
        </Section>
      ) : null}

      <Section tone="graphite">
        <div className="container-page">
          <RecentlyViewed currentSlug={product.slug} />
        </div>
      </Section>
    </>
  );
}

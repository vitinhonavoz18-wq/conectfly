import type { MetadataRoute } from "next";
import { getAllProductSlugs, getCategories } from "@/services/catalog";
import { policies } from "@/data/policies";
import { absoluteUrl } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([getAllProductSlugs(), getCategories()]);
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/loja"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/lancamentos"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/sobre"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/contato"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  return [
    ...staticRoutes,
    ...categories.map((category) => ({
      url: absoluteUrl(`/loja?categoria=${category.slug}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(`/produto/${product.slug}`),
      lastModified: new Date(product.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...policies.map((policy) => ({
      url: absoluteUrl(`/politicas/${policy.slug}`),
      lastModified: new Date(policy.updatedAt),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}

import type { Metadata } from "next";
import { Hero } from "@/components/home/hero";
import { Benefits } from "@/components/home/benefits";
import { BrandStats } from "@/components/home/brand-stats";
import { CategoryCards } from "@/components/home/category-cards";
import { CommunityBanner } from "@/components/home/community-banner";
import { Newsletter } from "@/components/home/newsletter";
import { ProductGrid } from "@/components/product/product-grid";
import { Section, SectionHeading } from "@/components/ui/section";
import { getCategories, getShowcase } from "@/services/catalog";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [categories, novidades, maisVendidos, roupas, acessorios] = await Promise.all([
    getCategories(),
    getShowcase("novidades", 8),
    getShowcase("mais-vendidos", 8),
    getShowcase("roupas", 8),
    getShowcase("acessorios", 8),
  ]);

  return (
    <>
      <Hero />
      <Benefits />
      <BrandStats />

      <Section tone="graphite">
        <div className="container-page">
          <SectionHeading
            eyebrow="Recém-chegados"
            title="Últimos lançamentos"
            description="As peças mais novas da coleção, direto do nosso desenvolvimento."
            action={{ label: "Ver todos os lançamentos", href: "/lancamentos" }}
          />
          <ProductGrid products={novidades} priorityCount={2} />
        </div>
      </Section>

      <Section tone="black" id="categorias">
        <div className="container-page">
          <SectionHeading
            eyebrow="Navegue por categoria"
            title="Categorias principais"
            description="Do básico de treino ao acessório que completa a rotina — tudo com a assinatura da marca."
            action={{ label: "Ver loja completa", href: "/loja" }}
          />
          <CategoryCards categories={categories} />
        </div>
      </Section>

      <Section tone="graphite">
        <div className="container-page">
          <SectionHeading
            eyebrow="Escolha da comunidade"
            title="Mais vendidos"
            description="O que a academia inteira está vestindo neste momento."
            action={{ label: "Ver ranking completo", href: "/loja?ordenar=mais-vendidos" }}
          />
          <ProductGrid products={maisVendidos} />
        </div>
      </Section>

      <CommunityBanner />

      <Section tone="black">
        <div className="container-page">
          <SectionHeading
            eyebrow="Vestuário"
            title="Roupas"
            description="Camisetas, regatas, shorts, leggings e moletons feitos para performance."
            action={{ label: "Ver todas as roupas", href: "/loja?grupo=roupas" }}
          />
          <ProductGrid products={roupas} />
        </div>
      </Section>

      <Section tone="graphite">
        <div className="container-page">
          <SectionHeading
            eyebrow="Equipamento de apoio"
            title="Acessórios"
            description="Bonés, garrafas, coqueteleiras, mochilas e acessórios de treino."
            action={{ label: "Ver todos os acessórios", href: "/loja?grupo=acessorios" }}
          />
          <ProductGrid products={acessorios} />
        </div>
      </Section>

      <Newsletter />
    </>
  );
}

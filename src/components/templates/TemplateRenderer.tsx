import { lazy, Suspense } from "react";
import type { SiteData } from "@/lib/site/types";
import { BlackTemplate } from "./BlackTemplate";
import { WhiteTemplate } from "./WhiteTemplate";
import { PizzaRedTemplate } from "./PizzaRedTemplate";
import { BurgerTemplate } from "./BurgerTemplate";
import { FloatingCartButton } from "../site/FloatingCartButton";
import { InteractionProvider } from "@/lib/interaction";
import { ehLayoutConhecido } from "@/lib/site/menuLayout";

// O Bar Prime é o único modelo com estrutura própria de verdade (636 linhas,
// com modais e fluxo de comanda). Carregar esse peso no cardápio de quem não
// usa ele seria fazer todo cliente baixar um cardápio que não é o dele.
const BarPrimeTemplate = lazy(() =>
  import("./BarPrimeTemplate").then((m) => ({ default: m.BarPrimeTemplate })),
);

const SegmentedTemplate = lazy(() =>
  import("./SegmentedTemplate").then((m) => ({ default: m.SegmentedTemplate })),
);

interface TemplateRendererProps {
  data: SiteData;
}

/**
 * Decide qual cardápio montar.
 *
 * A REGRA, E POR QUE ELA É ASSIM
 *
 * Existe um sistema novo de layouts por segmento (pizzaria, farmácia, adega…)
 * e existem os cinco modelos antigos. Os dois convivem, e quem manda é a
 * escolha explícita do lojista:
 *
 * - escolheu um layout no painel  → cardápio novo, montado pelo segmento;
 * - não escolheu nada             → exatamente o cardápio que ele já tinha.
 *
 * Nenhuma loja que está no ar muda de cara sozinha. É a diferença entre
 * oferecer uma reforma e aparecer com o pedreiro na porta.
 */
export function TemplateRenderer({ data }: TemplateRendererProps) {
  const template = data.restaurant.selected_template || "black";
  const layoutEscolhido = data.restaurant.site_settings?.menu_layout;

  const rendered = (() => {
    if (ehLayoutConhecido(layoutEscolhido)) {
      return (
        <Suspense fallback={<EsqueletoDoCardapio />}>
          <SegmentedTemplate data={data} />
        </Suspense>
      );
    }

    switch (template) {
      case "white":
        return <WhiteTemplate data={data} />;
      case "pizza_hut_style":
        return <PizzaRedTemplate data={data} />;
      case "burger_style":
        return <BurgerTemplate data={data} />;
      case "bar_prime":
        return (
          <Suspense fallback={<EsqueletoDoCardapio />}>
            <BarPrimeTemplate data={data} />
          </Suspense>
        );
      case "black":
      default:
        return <BlackTemplate data={data} />;
    }
  })();

  return (
    <InteractionProvider>
      {rendered}
      {/* Universal floating cart — single instance for every template. */}
      <FloatingCartButton />
    </InteractionProvider>
  );
}

/** Enquanto o cardápio carrega, o fundo da loja — não uma tela branca. */
function EsqueletoDoCardapio() {
  return (
    <div className="min-h-screen bg-[hsl(var(--site-bg))]">
      <div className="mx-auto max-w-6xl animate-pulse space-y-4 p-4">
        <div className="h-48 rounded-2xl bg-[hsl(var(--site-card))]" />
        <div className="h-10 w-1/2 rounded-xl bg-[hsl(var(--site-card))]" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-32 rounded-2xl bg-[hsl(var(--site-card))]" />
          <div className="h-32 rounded-2xl bg-[hsl(var(--site-card))]" />
        </div>
      </div>
    </div>
  );
}

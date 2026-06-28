import type { SiteData } from "@/lib/site/types";
import { BlackTemplate } from "./BlackTemplate";
import { WhiteTemplate } from "./WhiteTemplate";
import { PizzaRedTemplate } from "./PizzaRedTemplate";
import { BurgerTemplate } from "./BurgerTemplate";
import { BarPrimeTemplate } from "./BarPrimeTemplate";
import { FloatingCartButton } from "../site/FloatingCartButton";

interface TemplateRendererProps {
  data: SiteData;
}

export function TemplateRenderer({ data }: TemplateRendererProps) {
  const template = data.restaurant.selected_template || "black";

  const rendered = (() => {
    switch (template) {
      case "white":
        return <WhiteTemplate data={data} />;
      case "pizza_hut_style":
        return <PizzaRedTemplate data={data} />;
      case "burger_style":
        return <BurgerTemplate data={data} />;
      case "bar_prime":
        return <BarPrimeTemplate data={data} />;
      case "black":
      default:
        return <BlackTemplate data={data} />;
    }
  })();

  return (
    <>
      {rendered}
      {/* Universal floating cart — single instance for every template. */}
      <FloatingCartButton />
    </>
  );
}

import type { SiteData } from "@/lib/site/types";
import { BlackTemplate } from "./BlackTemplate";
import { WhiteTemplate } from "./WhiteTemplate";
import { PizzaRedTemplate } from "./PizzaRedTemplate";
import { BurgerTemplate } from "./BurgerTemplate";
import { BarPrimeTemplate } from "./BarPrimeTemplate";

interface TemplateRendererProps {
  data: SiteData;
}

export function TemplateRenderer({ data }: TemplateRendererProps) {
  const template = data.restaurant.selected_template || "black";

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
}

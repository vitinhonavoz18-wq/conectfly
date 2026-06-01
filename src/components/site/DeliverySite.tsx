import { CartProvider } from "./CartContext";
import { SiteThemeWrapper } from "./SiteThemeWrapper";
import { TemplateRenderer } from "../templates/TemplateRenderer";
import type { SiteData } from "@/lib/site/types";

export function DeliverySite({ data }: { data: SiteData }) {
  const r = data.restaurant;
  const template = r.selected_template || "black";

  return (
    <SiteThemeWrapper 
      primaryColor={r.primary_color} 
      secondaryColor={r.secondary_color}
      template={template}
    >
      <CartProvider>
        <TemplateRenderer data={data} />
      </CartProvider>
    </SiteThemeWrapper>
  );
}

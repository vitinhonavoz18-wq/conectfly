import { CartProvider } from "./CartContext";
import { SiteThemeWrapper } from "./SiteThemeWrapper";
import { TemplateRenderer } from "../templates/TemplateRenderer";
import type { SiteData } from "@/lib/site/types";

export function DeliverySite({ data }: { data: SiteData }) {
  const r = data.restaurant;

  return (
    <SiteThemeWrapper primaryColor={r.primary_color} secondaryColor={r.secondary_color}>
      <CartProvider>
        <TemplateRenderer data={data} />
      </CartProvider>
    </SiteThemeWrapper>
  );
}

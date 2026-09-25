import { CartProvider } from "./CartContext";
import { SiteThemeWrapper } from "./SiteThemeWrapper";
import { SiteClosedBanner } from "./SiteClosedBanner";
import { TemplateRenderer } from "../templates/TemplateRenderer";
import type { SiteData } from "@/lib/site/types";

export function DeliverySite({ data }: { data: SiteData }) {
  const r = data.restaurant;
  const template = r.selected_template || "black";

  // Só fecha quando a resposta disser explicitamente que está fechada.
  //
  // Loja antiga, ou leitura que veio sem este campo, conta como ABERTA. O
  // erro de deixar passar um pedido com a loja fechada custa um pedido; o
  // erro contrário pendura "fechado" na porta de quem está vendendo e derruba
  // o faturamento do dia inteiro sem ninguém entender por quê.
  const fechada = r.is_open === false;

  return (
    <SiteThemeWrapper
      primaryColor={r.primary_color}
      secondaryColor={r.secondary_color}
      backgroundColor={r.site_settings?.background_color}
      template={template}
    >
      <CartProvider namespace={r.id || r.slug || "default"}>
        {fechada && <SiteClosedBanner hours={r.hours} />}
        <TemplateRenderer data={data} />
      </CartProvider>
    </SiteThemeWrapper>
  );
}

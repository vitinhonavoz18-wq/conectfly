import { lazy, Suspense } from "react";
import type { DeliveryZoneRow, RestaurantRow } from "@/lib/site/types";
import { checkoutLayoutOf } from "@/lib/site/checkoutLayout";
import { SiteCartDrawer } from "../SiteCartDrawer";

/**
 * O modelo central só é baixado pelo navegador quando a loja realmente usa
 * ele. Quem ficou no lateral não carrega esse peso à toa — é como não
 * mandar o segundo cardápio para a mesa que não pediu.
 */
const SiteCheckoutCentral = lazy(() =>
  import("./SiteCheckoutCentral").then((m) => ({ default: m.SiteCheckoutCentral })),
);

interface Props {
  open: boolean;
  onClose: () => void;
  whatsappNumber: string;
  restaurantName: string;
  deliveryZones?: DeliveryZoneRow[];
  restaurant?: RestaurantRow;
}

/**
 * Único lugar que decide QUAL checkout aparece.
 *
 * Os modelos de site não sabem que existem dois: todos montam este
 * componente, e a escolha do estabelecimento resolve o resto. Espalhar esse
 * "se" pelos cinco modelos garantiria que um dia um deles ficaria para trás.
 *
 * Quem não escolheu nada cai no lateral — ver `checkoutLayoutOf`.
 */
export function SiteCheckout(props: Props) {
  const layout = checkoutLayoutOf(props.restaurant);

  if (layout === "central") {
    return (
      <Suspense fallback={null}>
        <SiteCheckoutCentral {...props} />
      </Suspense>
    );
  }

  return <SiteCartDrawer {...props} />;
}

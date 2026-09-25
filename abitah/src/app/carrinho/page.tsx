import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = {
  title: "Carrinho",
  description: "Revise os itens do seu pedido antes de finalizar a compra.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/carrinho" },
};

export default function CartPage() {
  return (
    <>
      <PageHeader
        eyebrow="Seu pedido"
        title="Carrinho"
        description="Confira quantidades, tamanhos e cores. Você ainda pode aplicar cupom e estimar o frete."
        breadcrumbs={[{ label: "Carrinho" }]}
      />
      <CartView />
    </>
  );
}

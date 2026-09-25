import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { CheckoutView } from "@/components/checkout/checkout-view";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Finalize seu pedido com segurança.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/checkout" },
};

export default function CheckoutPage() {
  return (
    <>
      <PageHeader
        eyebrow="Última etapa"
        title="Finalizar pedido"
        description="Preencha seus dados de entrega. Ao confirmar, enviamos o resumo completo para o nosso atendimento."
        breadcrumbs={[{ label: "Carrinho", href: "/carrinho" }, { label: "Checkout" }]}
      />
      <CheckoutView />
    </>
  );
}

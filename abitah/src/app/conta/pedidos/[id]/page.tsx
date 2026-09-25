import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { AccountShell } from "@/components/account/account-shell";
import { OrderDetail } from "@/components/account/order-detail";

export const metadata: Metadata = {
  title: "Detalhes do pedido",
  robots: { index: false, follow: false },
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <PageHeader
        eyebrow="Área do cliente"
        title="Detalhes do pedido"
        breadcrumbs={[
          { label: "Minha conta", href: "/conta" },
          { label: "Pedidos", href: "/conta/pedidos" },
          { label: "Detalhes" },
        ]}
      />
      <AccountShell>
        <OrderDetail orderId={id} />
      </AccountShell>
    </>
  );
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { AccountShell } from "@/components/account/account-shell";
import { OrdersList } from "@/components/account/orders-list";

export const metadata: Metadata = {
  title: "Meus pedidos",
  robots: { index: false, follow: false },
};

export default function OrdersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Área do cliente"
        title="Meus pedidos"
        breadcrumbs={[{ label: "Minha conta", href: "/conta" }, { label: "Pedidos" }]}
      />
      <AccountShell>
        <OrdersList />
      </AccountShell>
    </>
  );
}

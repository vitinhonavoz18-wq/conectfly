import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { OrdersManager } from "@/components/admin/orders-manager";

export const metadata: Metadata = {
  title: "Pedidos",
  robots: { index: false, follow: false },
};

export default function AdminOrdersPage() {
  return (
    <AdminShell
      title="Pedidos"
      description="Consulte os pedidos recebidos e atualize o status de cada etapa."
    >
      <OrdersManager />
    </AdminShell>
  );
}

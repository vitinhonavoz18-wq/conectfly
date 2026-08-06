import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { CouponsManager } from "@/components/admin/coupons-manager";

export const metadata: Metadata = {
  title: "Cupons",
  robots: { index: false, follow: false },
};

export default function AdminCouponsPage() {
  return (
    <AdminShell
      title="Cupons"
      description="Crie e gerencie os códigos de desconto aceitos no carrinho e no checkout."
    >
      <CouponsManager />
    </AdminShell>
  );
}

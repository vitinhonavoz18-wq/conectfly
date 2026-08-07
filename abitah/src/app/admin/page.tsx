import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDashboard } from "@/components/admin/dashboard";

export const metadata: Metadata = {
  title: "Painel administrativo",
  robots: { index: false, follow: false },
};

export default function AdminHomePage() {
  return (
    <AdminShell
      title="Visão geral"
      description="Acompanhe o catálogo, os pedidos e a saúde da loja."
    >
      <AdminDashboard />
    </AdminShell>
  );
}

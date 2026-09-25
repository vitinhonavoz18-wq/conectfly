import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { CategoriesManager } from "@/components/admin/categories-manager";

export const metadata: Metadata = {
  title: "Categorias",
  robots: { index: false, follow: false },
};

export default function AdminCategoriesPage() {
  return (
    <AdminShell
      title="Categorias"
      description="Organize as categorias que aparecem na home, nos filtros e no menu da loja."
    >
      <CategoriesManager />
    </AdminShell>
  );
}

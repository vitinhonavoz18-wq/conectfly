import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProductsTable } from "@/components/admin/products-table";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Produtos",
  robots: { index: false, follow: false },
};

export default function AdminProductsPage() {
  return (
    <AdminShell
      title="Produtos"
      description="Cadastre, edite, duplique, ative e organize as vitrines da loja."
      action={
        <ButtonLink href="/admin/produtos/novo">
          <Plus className="h-4 w-4" aria-hidden />
          Novo produto
        </ButtonLink>
      }
    >
      <ProductsTable />
    </AdminShell>
  );
}

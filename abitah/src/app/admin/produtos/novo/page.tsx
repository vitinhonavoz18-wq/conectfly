import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = {
  title: "Novo produto",
  robots: { index: false, follow: false },
};

export default function NewProductPage() {
  return (
    <AdminShell
      title="Novo produto"
      description="Preencha as informações do produto. Depois de salvar, você poderá enviar as imagens."
    >
      <ProductForm />
    </AdminShell>
  );
}

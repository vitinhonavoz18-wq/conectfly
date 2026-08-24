import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { EditProductLoader } from "@/components/admin/edit-product-loader";

export const metadata: Metadata = {
  title: "Editar produto",
  robots: { index: false, follow: false },
};

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AdminShell title="Editar produto" description="Altere informações, grade, preços e imagens.">
      <EditProductLoader productId={id} />
    </AdminShell>
  );
}

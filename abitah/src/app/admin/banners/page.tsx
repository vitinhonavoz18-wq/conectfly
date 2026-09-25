import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { BannersManager } from "@/components/admin/banners-manager";

export const metadata: Metadata = {
  title: "Banners e vitrines",
  robots: { index: false, follow: false },
};

export default function AdminBannersPage() {
  return (
    <AdminShell
      title="Banners e vitrines"
      description="Edite os textos e imagens dos destaques da página inicial."
    >
      <BannersManager />
    </AdminShell>
  );
}

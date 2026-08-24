import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { AccountShell } from "@/components/account/account-shell";
import { FavoritesList } from "@/components/account/favorites-list";

export const metadata: Metadata = {
  title: "Favoritos",
  robots: { index: false, follow: false },
};

export default function FavoritesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Área do cliente"
        title="Favoritos"
        breadcrumbs={[{ label: "Minha conta", href: "/conta" }, { label: "Favoritos" }]}
      />
      <AccountShell requireAuth={false}>
        <FavoritesList />
      </AccountShell>
    </>
  );
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { AccountShell } from "@/components/account/account-shell";
import { AddressesManager } from "@/components/account/addresses-manager";

export const metadata: Metadata = {
  title: "Endereços",
  robots: { index: false, follow: false },
};

export default function AddressesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Área do cliente"
        title="Endereços"
        breadcrumbs={[{ label: "Minha conta", href: "/conta" }, { label: "Endereços" }]}
      />
      <AccountShell>
        <AddressesManager />
      </AccountShell>
    </>
  );
}

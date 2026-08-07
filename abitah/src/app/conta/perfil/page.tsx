import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { AccountShell } from "@/components/account/account-shell";
import { ProfileForm } from "@/components/account/profile-form";

export const metadata: Metadata = {
  title: "Perfil",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        eyebrow="Área do cliente"
        title="Meu perfil"
        breadcrumbs={[{ label: "Minha conta", href: "/conta" }, { label: "Perfil" }]}
      />
      <AccountShell>
        <ProfileForm />
      </AccountShell>
    </>
  );
}

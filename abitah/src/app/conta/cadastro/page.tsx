import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { SignUpForm } from "@/components/account/auth-forms";
import { AuthGate } from "@/components/account/auth-gate";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta na loja oficial ABITAH.",
  robots: { index: false, follow: true },
};

export default function SignUpPage() {
  return (
    <>
      <PageHeader
        eyebrow="Área do cliente"
        title="Criar conta"
        breadcrumbs={[{ label: "Minha conta", href: "/conta" }, { label: "Criar conta" }]}
      />
      <div className="container-page py-10 lg:py-14">
        <AuthGate>
          <SignUpForm />
        </AuthGate>
      </div>
    </>
  );
}

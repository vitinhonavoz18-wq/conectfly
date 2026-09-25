import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ForgotPasswordForm } from "@/components/account/auth-forms";
import { AuthGate } from "@/components/account/auth-gate";

export const metadata: Metadata = {
  title: "Recuperar senha",
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return (
    <>
      <PageHeader
        eyebrow="Área do cliente"
        title="Recuperar senha"
        breadcrumbs={[{ label: "Minha conta", href: "/conta" }, { label: "Recuperar senha" }]}
      />
      <div className="container-page py-10 lg:py-14">
        <AuthGate>
          <ForgotPasswordForm />
        </AuthGate>
      </div>
    </>
  );
}

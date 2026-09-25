import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ResetPasswordForm } from "@/components/account/auth-forms";
import { AuthGate } from "@/components/account/auth-gate";

export const metadata: Metadata = {
  title: "Definir nova senha",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <>
      <PageHeader
        eyebrow="Área do cliente"
        title="Definir nova senha"
        breadcrumbs={[{ label: "Minha conta", href: "/conta" }, { label: "Nova senha" }]}
      />
      <div className="container-page py-10 lg:py-14">
        <AuthGate>
          <ResetPasswordForm />
        </AuthGate>
      </div>
    </>
  );
}

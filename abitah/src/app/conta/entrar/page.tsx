import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { SignInForm } from "@/components/account/auth-forms";
import { AuthGate } from "@/components/account/auth-gate";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta ABITAH.",
  robots: { index: false, follow: true },
};

export default function SignInPage() {
  return (
    <>
      <PageHeader
        eyebrow="Área do cliente"
        title="Entrar"
        breadcrumbs={[{ label: "Minha conta", href: "/conta" }, { label: "Entrar" }]}
      />
      <div className="container-page py-10 lg:py-14">
        <AuthGate>
          <Suspense fallback={<div className="mx-auto h-96 max-w-md animate-pulse rounded-card bg-ink-900" />}>
            <SignInForm />
          </Suspense>
        </AuthGate>
      </div>
    </>
  );
}

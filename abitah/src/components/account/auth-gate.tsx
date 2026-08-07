"use client";

import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { useAuth } from "@/store/auth-context";

/** Mostra o formulário apenas quando a autenticação está disponível. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { authEnabled } = useAuth();

  if (authEnabled) return <>{children}</>;

  return (
    <div className="mx-auto max-w-md rounded-card border border-ink-700 bg-ink-900 p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neon-500/10 text-neon-500">
        <ShieldAlert className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="mt-5 text-base font-extrabold uppercase text-white">
        Autenticação não configurada
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-smoke-300">
        A loja está em modo demonstração. Configure o Supabase (veja o README) para habilitar
        cadastro e login de clientes.
      </p>
      <ButtonLink href="/loja" size="lg" className="mt-6">
        Continuar navegando
      </ButtonLink>
    </div>
  );
}

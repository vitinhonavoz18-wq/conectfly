/**
 * Moldura das telas do ZÉ CARRETO: cabeçalho com identidade, navegação
 * curta e o corpo da página. Mantém tudo com a mesma cara sem repetir
 * código em cada tela.
 */

import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface ZcShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  back?: { to: string; label: string };
  showSignOut?: boolean;
}

export function ZcShell({
  title,
  subtitle,
  children,
  action,
  back,
  showSignOut = true,
}: ZcShellProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/zecarreto" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 text-neutral-900">
              <Truck className="h-5 w-5" />
            </span>
            <span>ZÉ CARRETO</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {action}
            {showSignOut && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/zecarreto/entrar" });
                }}
                aria-label="Sair da conta"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {back && (
          <Link
            to={back.to}
            className="mb-4 inline-block text-sm text-neutral-500 hover:text-neutral-900"
          >
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>}
        <div className="mt-6 space-y-6">{children}</div>
      </main>
    </div>
  );
}

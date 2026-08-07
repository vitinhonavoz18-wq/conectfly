"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { accountNav } from "@/config/navigation";
import { useAuth } from "@/store/auth-context";
import { cn } from "@/lib/utils";

/** Casca da área do cliente: menu lateral, aviso de modo demo e proteção. */
export function AccountShell({
  children,
  requireAuth = true,
}: {
  children: ReactNode;
  requireAuth?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, authEnabled, signOut } = useAuth();

  const nav = [
    ...accountNav,
    ...(profile?.role === "admin" ? [{ label: "Painel administrativo", href: "/admin" }] : []),
  ];

  if (!authEnabled) {
    return (
      <div className="container-page py-14">
        <div className="mx-auto max-w-xl rounded-card border border-ink-700 bg-ink-900 p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neon-500/10 text-neon-500">
            <ShieldAlert className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-5 text-lg font-extrabold uppercase text-white">
            Área do cliente indisponível no modo demonstração
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-smoke-300">
            Cadastro, login e histórico de pedidos usam a autenticação do Supabase. Configure as
            variáveis <code className="text-neon-400">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
            <code className="text-neon-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> para ativar esta
            área. As instruções completas estão no README.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/loja" size="lg">
              Continuar navegando
            </ButtonLink>
            <ButtonLink href="/contato" variant="outline" size="lg">
              Falar com a equipe
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  if (requireAuth && loading) {
    return (
      <div className="container-page py-14">
        <div className="h-64 animate-pulse rounded-card bg-ink-900" />
      </div>
    );
  }

  if (requireAuth && !user) {
    return (
      <div className="container-page py-14">
        <div className="mx-auto max-w-md rounded-card border border-ink-700 bg-ink-900 p-8 text-center">
          <h2 className="text-lg font-extrabold uppercase text-white">Acesso restrito</h2>
          <p className="mt-3 text-sm text-smoke-300">
            Entre na sua conta para ver esta página.
          </p>
          <ButtonLink href={`/conta/entrar?redirect=${pathname}`} size="lg" className="mt-6">
            Entrar
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page grid gap-8 py-10 lg:grid-cols-[248px_1fr] lg:py-14">
      <aside aria-label="Menu da conta">
        <div className="rounded-card border border-ink-700 bg-ink-900 p-4">
          {profile ? (
            <div className="mb-4 border-b border-ink-700 pb-4">
              <p className="truncate text-sm font-bold text-white">{profile.fullName || "Cliente"}</p>
              <p className="mt-0.5 truncate text-xs text-smoke-400">{profile.email}</p>
            </div>
          ) : null}

          <nav>
            <ul className="space-y-1">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block rounded-md px-3 py-2.5 text-sm transition-colors",
                      pathname === item.href
                        ? "bg-neon-500/10 font-semibold text-neon-400"
                        : "text-smoke-300 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {user ? (
            <Button
              variant="ghost"
              fullWidth
              className="mt-4 justify-start"
              onClick={async () => {
                await signOut();
                router.push("/");
                router.refresh();
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sair da conta
            </Button>
          ) : null}
        </div>
      </aside>

      <div>{children}</div>
    </div>
  );
}

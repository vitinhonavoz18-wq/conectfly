"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { LogoLink } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { adminNav } from "@/config/navigation";
import { useAuth } from "@/store/auth-context";
import { cn } from "@/lib/utils";

export function AdminShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { authEnabled, loading, user, profile } = useAuth();

  if (!authEnabled) {
    return <AdminNotice title="Painel indisponível no modo demonstração" />;
  }

  if (loading) {
    return (
      <div className="container-page py-14">
        <div className="h-72 animate-pulse rounded-card bg-ink-900" />
      </div>
    );
  }

  if (!user || profile?.role !== "admin") {
    return (
      <AdminNotice
        title="Acesso restrito a administradores"
        body="Entre com uma conta administradora para acessar o painel. Veja no README como promover o primeiro administrador."
        loginHref
      />
    );
  }

  return (
    <div className="container-page grid gap-8 py-8 lg:grid-cols-[240px_1fr] lg:py-12">
      <aside aria-label="Menu do painel">
        <div className="sticky top-24 rounded-card border border-ink-700 bg-ink-900 p-4">
          <LogoLink width={170} height={39} className="mb-4 h-7" />
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-neon-500">
            Painel administrativo
          </p>

          <nav>
            <ul className="space-y-1">
              {adminNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block rounded-md px-3 py-2.5 text-sm transition-colors",
                      pathname === item.href ||
                        (item.href !== "/admin" && pathname.startsWith(item.href))
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

          <Link
            href="/"
            className="mt-4 flex items-center gap-2 border-t border-ink-700 pt-4 text-xs text-smoke-400 hover:text-neon-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Voltar para a loja
          </Link>
        </div>
      </aside>

      <div>
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-ink-700 pb-5">
          <div>
            <h1 className="text-2xl font-black uppercase text-white">{title}</h1>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm text-smoke-300">{description}</p>
            ) : null}
          </div>
          {action}
        </header>

        {children}
      </div>
    </div>
  );
}

function AdminNotice({
  title,
  body,
  loginHref,
}: {
  title: string;
  body?: string;
  loginHref?: boolean;
}) {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-xl rounded-card border border-ink-700 bg-ink-900 p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neon-500/10 text-neon-500">
          <ShieldAlert className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-5 text-lg font-extrabold uppercase text-white">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-smoke-300">
          {body ??
            "O painel administrativo grava os dados no Supabase. Configure as variáveis de ambiente do projeto (veja o README) para habilitar o cadastro de produtos, pedidos e cupons."}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          {loginHref ? (
            <ButtonLink href="/conta/entrar?redirect=/admin" size="lg">
              Entrar
            </ButtonLink>
          ) : null}
          <ButtonLink href="/" variant="outline" size="lg">
            Voltar para a loja
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Heart, MapPin, Package, User } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Minha conta",
  description: "Acesse seus pedidos, endereços e favoritos.",
  robots: { index: false, follow: true },
};

const shortcuts = [
  { icon: User, label: "Perfil", href: "/conta/perfil", text: "Seus dados pessoais" },
  { icon: Package, label: "Pedidos", href: "/conta/pedidos", text: "Histórico e status" },
  { icon: MapPin, label: "Endereços", href: "/conta/enderecos", text: "Locais de entrega" },
  { icon: Heart, label: "Favoritos", href: "/conta/favoritos", text: "Peças que você salvou" },
];

export default function AccountHomePage() {
  return (
    <>
      <PageHeader
        eyebrow="Área do cliente"
        title="Minha conta"
        description="Gerencie seus dados, acompanhe pedidos e revisite seus favoritos."
        breadcrumbs={[{ label: "Minha conta" }]}
      />

      <div className="container-page py-10 lg:py-14">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map((shortcut) => (
            <li key={shortcut.href}>
              <Link
                href={shortcut.href}
                className="flex h-full flex-col gap-3 rounded-card border border-ink-700 bg-ink-900 p-5 transition-all hover:-translate-y-1 hover:border-neon-500/45"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-neon-500/25 bg-neon-500/8 text-neon-500">
                  <shortcut.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                    {shortcut.label}
                  </h2>
                  <p className="mt-1 text-xs text-smoke-400">{shortcut.text}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/conta/entrar"
            className="text-sm font-semibold text-neon-400 hover:underline"
          >
            Entrar na conta
          </Link>
          <span className="text-smoke-500">·</span>
          <Link
            href="/conta/cadastro"
            className="text-sm font-semibold text-neon-400 hover:underline"
          >
            Criar cadastro
          </Link>
        </div>
      </div>
    </>
  );
}

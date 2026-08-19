import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MapPin, Package, ShieldCheck, Truck, User } from "lucide-react";
import { ZcShell } from "@/components/zecarreto/ZcShell";
import { useZcSession } from "@/components/zecarreto/useZcSession";
import { zcApi } from "@/lib/zecarreto/client";

export const Route = createFileRoute("/zecarreto/")({ component: HubPage });

interface Snapshot {
  profile: { full_name: string } | null;
  roles: string[];
  checklist: { percent: number; canSubmitForReview: boolean };
}

function HubPage() {
  const navigate = useNavigate();
  const { session, loading } = useZcSession({ required: true });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!session) return;
    zcApi<Snapshot>("/profile/me")
      .then(setSnapshot)
      .catch(() => undefined);
  }, [session]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const isAdmin = snapshot?.roles.includes("admin");
  const firstName = snapshot?.profile?.full_name?.split(" ")[0];

  return (
    <ZcShell
      title={firstName ? `Olá, ${firstName}` : "Bem-vindo"}
      subtitle="O que você quer fazer agora?"
    >
      <div className="grid gap-3">
        <HubCard
          to="/zecarreto/pedir"
          icon={<Package className="h-5 w-5" />}
          title="Pedir um carreto"
          description="Escolha o veículo, os endereços e veja o preço na hora."
        />
        <HubCard
          to="/zecarreto/conta"
          icon={<User className="h-5 w-5" />}
          title="Sou cliente"
          description="Meus dados e endereços favoritos para pedir carreto."
        />
        <HubCard
          to="/zecarreto/motorista"
          icon={<Truck className="h-5 w-5" />}
          title="Sou carreteiro"
          description="Cadastro, documentos, veículos e o botão de ficar online."
        />
        <HubCard
          to="/zecarreto/enderecos"
          icon={<MapPin className="h-5 w-5" />}
          title="Meus endereços"
          description="Casa, depósito, loja — salve para não digitar de novo."
        />
        {isAdmin && (
          <HubCard
            to="/zecarreto/admin"
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Administração"
            description="Aprovar motoristas, documentos e veículos."
          />
        )}
      </div>
    </ZcShell>
  );
}

function HubCard({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:shadow-sm"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-900">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-neutral-600">{description}</span>
      </span>
    </Link>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ZcShell } from "@/components/zecarreto/ZcShell";
import { ZcChecklist } from "@/components/zecarreto/ZcStatus";
import { ZcUpload } from "@/components/zecarreto/ZcUpload";
import { useZcSession } from "@/components/zecarreto/useZcSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zcApi, zcErrorMessage } from "@/lib/zecarreto/client";

export const Route = createFileRoute("/zecarreto/conta")({ component: ContaPage });

interface Snapshot {
  profile: {
    full_name: string;
    phone: string | null;
    email: string | null;
    document_number: string | null;
    avatar_url: string | null;
  } | null;
  terms: { current_version: string; accepted: boolean };
  checklist: {
    steps: { key: string; label: string; done: boolean; hint?: string }[];
    percent: number;
  };
}

/**
 * Tela do cliente — de propósito curta: nome, telefone, e-mail, CPF, foto
 * (opcional) e o aceite dos termos. Nada mais é pedido para poder chamar
 * um carreto.
 */
function ContaPage() {
  const { session, loading } = useZcSession({ required: true });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", document_number: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await zcApi<Snapshot>("/profile/me");
    setSnapshot(data);
    setForm({
      full_name: data.profile?.full_name ?? "",
      phone: data.profile?.phone ?? "",
      email: data.profile?.email ?? session?.user.email ?? "",
      document_number: data.profile?.document_number ?? "",
    });
  }

  useEffect(() => {
    if (!session) return;
    // Entrou pela primeira vez? Já registra que é cliente.
    zcApi("/profile/role", { method: "POST", body: { role: "client" } }).catch(() => undefined);
    load().catch((error) => toast.error(zcErrorMessage(error)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await zcApi("/profile/me", { method: "PUT", body: form });
      await load();
      toast.success("Dados salvos.");
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleAcceptTerms() {
    try {
      await zcApi("/profile/terms", { method: "POST", body: { audience: "client" } });
      await load();
      toast.success("Termos aceitos.");
    } catch (error) {
      toast.error(zcErrorMessage(error));
    }
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <ZcShell
      title="Meus dados"
      subtitle="É o mínimo para pedir um carreto e receber o recibo."
      back={{ to: "/zecarreto", label: "Início" }}
    >
      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Nome completo</Label>
          <Input
            id="full_name"
            value={form.full_name}
            onChange={(event) => setForm({ ...form, full_name: event.target.value })}
            placeholder="Maria Souza"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone com DDD</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="(11) 99999-0000"
              inputMode="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="document_number">CPF</Label>
            <Input
              id="document_number"
              value={form.document_number}
              onChange={(event) => setForm({ ...form, document_number: event.target.value })}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </div>

        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </form>

      <ZcUpload
        label="Foto (opcional)"
        hint="Ajuda o carreteiro a te reconhecer na entrega."
        bucket="zc-avatars"
        purpose="avatar"
        accept="image/jpeg,image/png,image/webp,image/heic"
        done={!!snapshot?.profile?.avatar_url}
        currentUrl={snapshot?.profile?.avatar_url}
        onUploaded={async (result) => {
          await zcApi("/profile/me", { method: "PUT", body: { avatar_url: result.publicUrl } });
          await load();
        }}
      />

      {snapshot && !snapshot.terms.accepted && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Falta aceitar os termos de uso</p>
          <p className="mt-1 text-sm text-amber-800">
            Versão {snapshot.terms.current_version}. Guardamos a data do seu aceite.
          </p>
          <Button className="mt-3" size="sm" onClick={handleAcceptTerms}>
            Li e aceito
          </Button>
        </div>
      )}

      {snapshot && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold">
            Cadastro {snapshot.checklist.percent}% completo
          </p>
          <ZcChecklist steps={snapshot.checklist.steps} />
        </div>
      )}
    </ZcShell>
  );
}

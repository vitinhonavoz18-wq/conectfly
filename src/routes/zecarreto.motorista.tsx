import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Power, Truck } from "lucide-react";
import { toast } from "sonner";
import { ZcShell } from "@/components/zecarreto/ZcShell";
import { ZcChecklist, ZcRejectionNote, ZcStatusBadge } from "@/components/zecarreto/ZcStatus";
import { ZcUpload } from "@/components/zecarreto/ZcUpload";
import { useZcSession } from "@/components/zecarreto/useZcSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { zcApi, zcErrorMessage } from "@/lib/zecarreto/client";

export const Route = createFileRoute("/zecarreto/motorista")({ component: MotoristaPage });

interface DriverSnapshot {
  driver: {
    id: string;
    status: string;
    availability: string;
    cnh_number: string | null;
    cnh_category: string | null;
    cnh_expires_at: string | null;
    pix_key: string | null;
    pix_key_type: string | null;
    rejection_reason: string | null;
  } | null;
  profile: { full_name: string; phone: string | null; document_number: string | null } | null;
  documents: { id: string; type: string; status: string }[];
  vehicles: { id: string; status: string; plate: string }[];
  terms: { current_version: string; accepted: boolean };
  checklist: {
    steps: { key: string; label: string; done: boolean; hint?: string }[];
    percent: number;
    canSubmitForReview: boolean;
    pending: string[];
  } | null;
  canGoOnline: boolean;
  onlineBlockReason: string | null;
}

function MotoristaPage() {
  const { session, loading } = useZcSession({ required: true });
  const [snapshot, setSnapshot] = useState<DriverSnapshot | null>(null);
  const [form, setForm] = useState({
    cnh_number: "",
    cnh_category: "",
    cnh_expires_at: "",
    pix_key: "",
    pix_key_type: "cpf",
  });
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function load() {
    const data = await zcApi<DriverSnapshot>("/drivers/me");
    setSnapshot(data);
    if (data.driver) {
      setForm({
        cnh_number: data.driver.cnh_number ?? "",
        cnh_category: data.driver.cnh_category ?? "",
        cnh_expires_at: data.driver.cnh_expires_at ?? "",
        pix_key: data.driver.pix_key ?? "",
        pix_key_type: data.driver.pix_key_type ?? "cpf",
      });
    }
  }

  useEffect(() => {
    if (!session) return;
    load().catch((error) => toast.error(zcErrorMessage(error)));
  }, [session]);

  async function abrirCadastro() {
    try {
      await zcApi("/drivers/me", { method: "POST", body: {} });
      await load();
      toast.success("Cadastro de carreteiro aberto. Agora é só preencher.");
    } catch (error) {
      toast.error(zcErrorMessage(error));
    }
  }

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await zcApi("/drivers/me", { method: "PATCH", body: form });
      await load();
      toast.success("Dados salvos.");
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function aceitarTermos() {
    try {
      await zcApi("/profile/terms", { method: "POST", body: { audience: "driver" } });
      await load();
    } catch (error) {
      toast.error(zcErrorMessage(error));
    }
  }

  async function enviarParaAnalise() {
    try {
      await zcApi("/drivers/me/submit", { method: "POST", body: {} });
      await load();
      toast.success("Cadastro enviado! Avisaremos assim que a análise terminar.");
    } catch (error) {
      toast.error(zcErrorMessage(error));
    }
  }

  async function alternarOnline() {
    if (!snapshot?.driver) return;
    const indoParaOnline = snapshot.driver.availability === "offline";
    setToggling(true);
    try {
      await zcApi("/drivers/me/availability", {
        method: "POST",
        body: { availability: indoParaOnline ? "online" : "offline" },
      });
      await load();
      toast.success(indoParaOnline ? "Você está ONLINE." : "Você saiu do ar.");
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setToggling(false);
    }
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (snapshot && !snapshot.driver) {
    return (
      <ZcShell title="Virar carreteiro" back={{ to: "/zecarreto", label: "Início" }}>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center">
          <Truck className="mx-auto h-10 w-10 text-amber-500" />
          <p className="mt-3 font-semibold">Trabalhe com o ZÉ CARRETO</p>
          <p className="mt-1 text-sm text-neutral-600">
            Cadastre seus dados, envie a CNH e um veículo. A análise costuma sair rápido.
          </p>
          <Button className="mt-4" onClick={abrirCadastro}>
            Abrir meu cadastro
          </Button>
        </div>
      </ZcShell>
    );
  }

  const driver = snapshot?.driver;
  const online = driver?.availability !== "offline";

  return (
    <ZcShell
      title="Área do carreteiro"
      subtitle="Seu cadastro, seus documentos e seus veículos."
      back={{ to: "/zecarreto", label: "Início" }}
      action={driver ? <ZcStatusBadge status={driver.status} /> : undefined}
    >
      {/* Botão grande de ficar online — é o que o motorista mais usa. */}
      <button
        type="button"
        onClick={alternarOnline}
        disabled={toggling || (!snapshot?.canGoOnline && !online)}
        className={cn(
          "flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-6 text-lg font-bold transition",
          online
            ? "bg-emerald-500 text-white hover:bg-emerald-600"
            : snapshot?.canGoOnline
              ? "bg-neutral-900 text-white hover:bg-neutral-800"
              : "cursor-not-allowed bg-neutral-200 text-neutral-500",
        )}
      >
        {toggling ? <Loader2 className="h-6 w-6 animate-spin" /> : <Power className="h-6 w-6" />}
        {online ? "VOCÊ ESTÁ ONLINE — tocar para sair" : "FICAR ONLINE"}
      </button>

      {!snapshot?.canGoOnline && snapshot?.onlineBlockReason && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {snapshot.onlineBlockReason}
        </p>
      )}

      <ZcRejectionNote reason={driver?.rejection_reason} />

      <Link
        to="/zecarreto/motorista/veiculos"
        className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-300"
      >
        <Truck className="h-5 w-5 text-neutral-500" />
        <span className="flex-1">
          <span className="block font-semibold">Meus veículos</span>
          <span className="block text-sm text-neutral-600">
            {snapshot?.vehicles.length
              ? `${snapshot.vehicles.length} cadastrado(s) · ${snapshot.vehicles.filter((v) => v.status === "approved").length} aprovado(s)`
              : "Nenhum veículo cadastrado ainda"}
          </span>
        </span>
        <span className="text-neutral-400">→</span>
      </Link>

      <form
        onSubmit={salvar}
        className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <p className="font-semibold">CNH e recebimento</p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cnh_number">Número da CNH</Label>
            <Input
              id="cnh_number"
              value={form.cnh_number}
              onChange={(event) => setForm({ ...form, cnh_number: event.target.value })}
              inputMode="numeric"
              placeholder="11 dígitos"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cnh_category">Categoria</Label>
            <Input
              id="cnh_category"
              value={form.cnh_category}
              onChange={(event) =>
                setForm({ ...form, cnh_category: event.target.value.toUpperCase() })
              }
              maxLength={5}
              placeholder="B, C, D..."
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cnh_expires_at">Validade da CNH</Label>
          <Input
            id="cnh_expires_at"
            type="date"
            value={form.cnh_expires_at}
            onChange={(event) => setForm({ ...form, cnh_expires_at: event.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <div className="space-y-1.5">
            <Label htmlFor="pix_key_type">Tipo da chave PIX</Label>
            <select
              id="pix_key_type"
              value={form.pix_key_type}
              onChange={(event) => setForm({ ...form, pix_key_type: event.target.value })}
              className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
            >
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="random">Aleatória</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pix_key">Chave PIX (onde você recebe)</Label>
            <Input
              id="pix_key"
              value={form.pix_key}
              onChange={(event) => setForm({ ...form, pix_key: event.target.value })}
            />
          </div>
        </div>

        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </form>

      <div className="space-y-3">
        <p className="font-semibold">Documentos</p>
        <ZcUpload
          label="Foto da CNH"
          bucket="zc-documents"
          purpose="cnh"
          done={snapshot?.documents.some((doc) => doc.type === "cnh")}
          onUploaded={async (result) => {
            await zcApi("/drivers/me/documents", {
              method: "POST",
              body: { owner_kind: "driver", type: "cnh", storage_path: result.path },
            });
            await load();
          }}
        />
        <ZcUpload
          label="Selfie segurando a CNH"
          hint="É a nossa conferência de que é você mesmo."
          bucket="zc-documents"
          purpose="selfie"
          accept="image/jpeg,image/png,image/webp,image/heic"
          done={snapshot?.documents.some((doc) => doc.type === "selfie")}
          onUploaded={async (result) => {
            await zcApi("/drivers/me/documents", {
              method: "POST",
              body: { owner_kind: "driver", type: "selfie", storage_path: result.path },
            });
            await load();
          }}
        />
        <ZcUpload
          label="Comprovante de endereço"
          bucket="zc-documents"
          purpose="comprovante-endereco"
          done={snapshot?.documents.some((doc) => doc.type === "proof_of_address")}
          onUploaded={async (result) => {
            await zcApi("/drivers/me/documents", {
              method: "POST",
              body: { owner_kind: "driver", type: "proof_of_address", storage_path: result.path },
            });
            await load();
          }}
        />
      </div>

      {snapshot && !snapshot.terms.accepted && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Aceite os termos do carreteiro</p>
          <Button className="mt-3" size="sm" onClick={aceitarTermos}>
            Li e aceito
          </Button>
        </div>
      )}

      {snapshot?.checklist && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold">
            Cadastro {snapshot.checklist.percent}% completo
          </p>
          <ZcChecklist steps={snapshot.checklist.steps} />
          {driver?.status !== "approved" && driver?.status !== "under_review" && (
            <Button
              className="mt-4 w-full"
              disabled={!snapshot.checklist.canSubmitForReview}
              onClick={enviarParaAnalise}
            >
              Enviar cadastro para análise
            </Button>
          )}
          {driver?.status === "under_review" && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Cadastro em análise. Avisaremos assim que terminar.
            </p>
          )}
        </div>
      )}
    </ZcShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Loader2, ShieldCheck, Truck, User } from "lucide-react";
import { toast } from "sonner";
import { ZcShell } from "@/components/zecarreto/ZcShell";
import { ZcStatusBadge } from "@/components/zecarreto/ZcStatus";
import { useZcSession } from "@/components/zecarreto/useZcSession";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { zcApi, zcErrorMessage } from "@/lib/zecarreto/client";

export const Route = createFileRoute("/zecarreto/admin")({ component: AdminPage });

interface DriverRow {
  id: string;
  profile_id: string;
  status: string;
  cnh_number: string | null;
  created_at: string;
}

interface VehicleRow {
  id: string;
  driver_id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  status: string;
  photos: string[];
}

interface DocumentRow {
  id: string;
  type: string;
  status: string;
  owner_kind: string;
  created_at: string;
  view_url: string | null;
}

type Tab = "motoristas" | "veiculos" | "documentos";

const DOC_LABELS: Record<string, string> = {
  cnh: "Foto da CNH",
  crlv: "Documento do veículo (CRLV)",
  selfie: "Selfie de verificação",
  proof_of_address: "Comprovante de endereço",
  profile_photo: "Foto de perfil",
  vehicle_photo: "Foto do veículo",
  criminal_record: "Certidão de antecedentes",
  bank_proof: "Comprovante bancário",
  other: "Outro documento",
};

/**
 * Painel de aprovação. Recusar SEMPRE pede o motivo — o motorista precisa
 * saber o que corrigir, senão ele volta para a fila com o mesmo problema.
 */
function AdminPage() {
  const { session, loading } = useZcSession({ required: true });
  const [tab, setTab] = useState<Tab>("motoristas");
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  async function load() {
    try {
      const [driverList, vehicleList, documentList] = await Promise.all([
        zcApi<DriverRow[]>("/admin/drivers?status=under_review"),
        zcApi<VehicleRow[]>("/admin/vehicles?status=pending"),
        zcApi<DocumentRow[]>("/admin/documents?status=pending"),
      ]);
      setDrivers(driverList);
      setVehicles(vehicleList);
      setDocuments(documentList);
    } catch (error) {
      const message = zcErrorMessage(error);
      if (message.includes("administrador") || message.includes("perfil")) setDenied(true);
      else toast.error(message);
    }
  }

  useEffect(() => {
    if (!session) return;
    load();
  }, [session]);

  async function revisarMotorista(id: string, status: "approved" | "rejected") {
    const reason = reasons[id]?.trim();
    if (status === "rejected" && !reason) {
      toast.error("Escreva o motivo da recusa.");
      return;
    }
    setBusyId(id);
    try {
      await zcApi(`/admin/drivers/${id}/review`, { method: "POST", body: { status, reason } });
      toast.success(status === "approved" ? "Motorista aprovado." : "Motorista recusado.");
      await load();
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function revisarVeiculo(id: string, status: "approved" | "rejected") {
    const reason = reasons[id]?.trim();
    if (status === "rejected" && !reason) {
      toast.error("Escreva o motivo da recusa.");
      return;
    }
    setBusyId(id);
    try {
      await zcApi(`/admin/vehicles/${id}/review`, { method: "POST", body: { status, reason } });
      toast.success(status === "approved" ? "Veículo aprovado." : "Veículo recusado.");
      await load();
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function revisarDocumento(id: string, status: "approved" | "rejected") {
    const reason = reasons[id]?.trim();
    if (status === "rejected" && !reason) {
      toast.error("Escreva o motivo da recusa.");
      return;
    }
    setBusyId(id);
    try {
      await zcApi(`/admin/documents/${id}/review`, {
        method: "POST",
        body: { status, rejection_reason: reason },
      });
      toast.success(status === "approved" ? "Documento aprovado." : "Documento recusado.");
      await load();
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (denied) {
    return (
      <ZcShell title="Administração" back={{ to: "/zecarreto", label: "Início" }}>
        <p className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-600">
          Esta área é só do administrador da plataforma.
        </p>
      </ZcShell>
    );
  }

  return (
    <ZcShell
      title="Aprovações"
      subtitle="Cadastros e veículos esperando análise."
      back={{ to: "/zecarreto", label: "Início" }}
      action={<ShieldCheck className="h-5 w-5 text-neutral-400" />}
    >
      <div className="flex gap-2">
        <Button
          variant={tab === "motoristas" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("motoristas")}
        >
          <User className="mr-1 h-4 w-4" />
          Motoristas ({drivers.length})
        </Button>
        <Button
          variant={tab === "veiculos" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("veiculos")}
        >
          <Truck className="mr-1 h-4 w-4" />
          Veículos ({vehicles.length})
        </Button>
        <Button
          variant={tab === "documentos" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("documentos")}
        >
          <FileText className="mr-1 h-4 w-4" />
          Documentos ({documents.length})
        </Button>
      </div>

      {tab === "motoristas" &&
        (drivers.length === 0 ? (
          <EmptyState text="Nenhum cadastro esperando análise." />
        ) : (
          drivers.map((driver) => (
            <div
              key={driver.id}
              className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Motorista {driver.id.slice(0, 8)}</p>
                  <p className="text-sm text-neutral-600">
                    CNH {driver.cnh_number ?? "—"} · enviado em{" "}
                    {new Date(driver.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    Os dados aparecem mascarados. Para conferir o número inteiro, use a opção de
                    revelar — fica registrado quem consultou.
                  </p>
                </div>
                <ZcStatusBadge status={driver.status} />
              </div>

              <Textarea
                placeholder="Motivo (obrigatório para recusar)"
                value={reasons[driver.id] ?? ""}
                onChange={(event) => setReasons({ ...reasons, [driver.id]: event.target.value })}
                rows={2}
              />

              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busyId === driver.id}
                  onClick={() => revisarMotorista(driver.id, "approved")}
                >
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === driver.id}
                  onClick={() => revisarMotorista(driver.id, "rejected")}
                >
                  Recusar
                </Button>
              </div>
            </div>
          ))
        ))}

      {tab === "veiculos" &&
        (vehicles.length === 0 ? (
          <EmptyState text="Nenhum veículo esperando análise." />
        ) : (
          vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Veículo"}{" "}
                    <span className="font-mono text-sm text-neutral-500">{vehicle.plate}</span>
                  </p>
                  <p className="text-sm text-neutral-600">
                    {vehicle.photos?.length ?? 0} foto(s) enviada(s)
                  </p>
                </div>
                <ZcStatusBadge status={vehicle.status} kind="vehicle" />
              </div>

              {!!vehicle.photos?.length && (
                <div className="flex gap-2 overflow-x-auto">
                  {vehicle.photos.slice(0, 6).map((photo) => (
                    <img
                      key={photo}
                      src={photo}
                      alt="Foto do veículo"
                      className="h-20 w-28 shrink-0 rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}

              <Textarea
                placeholder="Motivo (obrigatório para recusar)"
                value={reasons[vehicle.id] ?? ""}
                onChange={(event) => setReasons({ ...reasons, [vehicle.id]: event.target.value })}
                rows={2}
              />

              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busyId === vehicle.id}
                  onClick={() => revisarVeiculo(vehicle.id, "approved")}
                >
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === vehicle.id}
                  onClick={() => revisarVeiculo(vehicle.id, "rejected")}
                >
                  Recusar
                </Button>
              </div>
            </div>
          ))
        ))}
      {tab === "documentos" &&
        (documents.length === 0 ? (
          <EmptyState text="Nenhum documento esperando análise." />
        ) : (
          documents.map((document) => (
            <div
              key={document.id}
              className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{DOC_LABELS[document.type] ?? document.type}</p>
                  <p className="text-sm text-neutral-600">
                    Enviado em {new Date(document.created_at).toLocaleDateString("pt-BR")} ·{" "}
                    {document.owner_kind === "vehicle" ? "do veículo" : "do motorista"}
                  </p>
                </div>
                <ZcStatusBadge status={document.status} kind="document" />
              </div>

              {document.view_url ? (
                <a
                  href={document.view_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-sm font-medium text-neutral-900 underline"
                >
                  Abrir arquivo para conferir
                </a>
              ) : (
                <p className="text-sm text-neutral-500">
                  Não foi possível gerar o link do arquivo.
                </p>
              )}

              <Textarea
                placeholder="Motivo (obrigatório para recusar)"
                value={reasons[document.id] ?? ""}
                onChange={(event) => setReasons({ ...reasons, [document.id]: event.target.value })}
                rows={2}
              />

              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busyId === document.id}
                  onClick={() => revisarDocumento(document.id, "approved")}
                >
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === document.id}
                  onClick={() => revisarDocumento(document.id, "rejected")}
                >
                  Recusar
                </Button>
              </div>
            </div>
          ))
        ))}
    </ZcShell>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
      {text}
    </p>
  );
}

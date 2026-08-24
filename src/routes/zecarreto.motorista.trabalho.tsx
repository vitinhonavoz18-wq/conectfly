import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Loader2,
  MapPin,
  Navigation,
  Package,
  Power,
  ShieldAlert,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ZcShell } from "@/components/zecarreto/ZcShell";
import { ZcMap } from "@/components/zecarreto/ZcMap";
import { ZcChat } from "@/components/zecarreto/ZcChat";
import { useZcSession } from "@/components/zecarreto/useZcSession";
import { useDriverLocation } from "@/components/zecarreto/useDriverLocation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { zcApi, zcErrorMessage } from "@/lib/zecarreto/client";
import { formatBRL } from "@/lib/zecarreto/domain/money";
import { STATUS_LABELS } from "@/lib/zecarreto/domain/ride-status";
import type { ZcRideStatus } from "@/lib/zecarreto/domain/enums";

export const Route = createFileRoute("/zecarreto/motorista/trabalho")({ component: TrabalhoPage });

interface OfferCard {
  offerId: string;
  rideId: string;
  rideCode: string;
  expiresAt: string;
  categoryName: string | null;
  modality: string;
  scheduledFor: string | null;
  distanceToPickupMeters: number | null;
  serviceDistanceMeters: number;
  durationSeconds: number;
  helpersCount: number;
  addons: { code: string; name: string; quantity: number }[];
  earningsCents: number;
  pickup: {
    lat: number | null;
    lng: number | null;
    district: string | null;
    city: string;
    state: string;
    street?: string;
    approximate: boolean;
  } | null;
  dropoff: { district: string | null; city: string; state: string } | null;
  itemsDescription: string | null;
}

interface Stop {
  id: string;
  sequence: number;
  kind: string;
  street: string;
  number: string | null;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  contact_name: string | null;
  instructions: string | null;
}

interface Ride {
  id: string;
  code: string;
  status: ZcRideStatus;
  helpers_count: number;
  items_description: string | null;
  notes: string | null;
  driver_earnings_cents: number;
  stops: Stop[];
}

interface Snapshot {
  ride: Ride | null;
  offers: OfferCard[];
  tracking: { position: { lat: number; lng: number } | null } | null;
}

interface DriverSnapshot {
  driver: { id: string; availability: string } | null;
  vehicles: {
    id: string;
    plate: string;
    brand: string | null;
    model: string | null;
    status: string;
  }[];
  canGoOnline: boolean;
  onlineBlockReason: string | null;
}

/** A ordem em que o carreteiro empurra a corrida. */
const PROXIMA_ETAPA: Partial<Record<ZcRideStatus, { to: ZcRideStatus; label: string }>> = {
  driver_assigned: { to: "driver_to_pickup", label: "Estou a caminho da retirada" },
  driver_to_pickup: { to: "driver_arrived", label: "Cheguei no local" },
  driver_arrived: { to: "loading", label: "Começar a carregar" },
  loading: { to: "in_transit", label: "Carregado, seguindo viagem" },
  in_transit: { to: "unloading", label: "Cheguei no destino" },
  unloading: { to: "completed", label: "Entrega concluída" },
};

function TrabalhoPage() {
  const { session, loading } = useZcSession({ required: true });
  const [driverInfo, setDriverInfo] = useState<DriverSnapshot | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [releaseReason, setReleaseReason] = useState("");
  const [showRelease, setShowRelease] = useState(false);

  const online = driverInfo?.driver?.availability !== "offline";
  const rideAtual = snapshot?.ride ?? null;

  const localizacao = useDriverLocation({
    enabled: !!driverInfo?.driver && (online || !!rideAtual),
    rideId: rideAtual?.id ?? null,
  });

  const carregar = useCallback(async () => {
    const [info, atual] = await Promise.all([
      zcApi<DriverSnapshot>("/drivers/me"),
      zcApi<Snapshot>("/drivers/me/current").catch(() => ({
        ride: null,
        offers: [],
        tracking: null,
      })),
    ]);
    setDriverInfo(info);
    setSnapshot(atual);
  }, []);

  useEffect(() => {
    if (!session) return;
    carregar().catch((error) => toast.error(zcErrorMessage(error)));
    // Enquanto está trabalhando, a tela se atualiza sozinha.
    const timer = setInterval(() => {
      carregar().catch(() => undefined);
    }, 10_000);
    return () => clearInterval(timer);
  }, [session, carregar]);

  async function alternarOnline() {
    setBusy("online");
    try {
      await zcApi("/drivers/me/availability", {
        method: "POST",
        body: { availability: online ? "offline" : "online" },
      });
      if (!online) await localizacao.request();
      await carregar();
      toast.success(online ? "Você saiu do ar." : "Você está ONLINE.");
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function responderOferta(offerId: string, action: "accept" | "decline") {
    setBusy(offerId);
    try {
      await zcApi(`/offers/${offerId}/respond`, { method: "POST", body: { action } });
      await carregar();
      toast.success(action === "accept" ? "Carreto aceito! Bom trabalho." : "Oferta recusada.");
    } catch (error) {
      toast.error(zcErrorMessage(error));
      await carregar();
    } finally {
      setBusy(null);
    }
  }

  async function avancar(to: ZcRideStatus) {
    if (!rideAtual) return;
    setBusy("status");
    try {
      await zcApi(`/rides/${rideAtual.id}/status`, { method: "POST", body: { to } });
      await carregar();
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function desistir() {
    if (!rideAtual || releaseReason.trim().length < 3) {
      toast.error("Conte o motivo — o cliente vai ler.");
      return;
    }
    setBusy("release");
    try {
      await zcApi(`/rides/${rideAtual.id}/release`, {
        method: "POST",
        body: { reason: releaseReason.trim() },
      });
      setShowRelease(false);
      setReleaseReason("");
      await carregar();
      toast.success("Carreto devolvido para a fila.");
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  if (loading || !session || !driverInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const veiculosAprovados = driverInfo.vehicles?.filter((v) => v.status === "approved") ?? [];
  const proxima = rideAtual ? PROXIMA_ETAPA[rideAtual.status] : undefined;

  return (
    <ZcShell
      title="Trabalhar"
      subtitle={
        rideAtual ? `Carreto ${rideAtual.code} em andamento` : "Fique online para receber carretos."
      }
      back={{ to: "/zecarreto/motorista", label: "Área do carreteiro" }}
      showSignOut={false}
    >
      {/* --- botão de ficar online --- */}
      {!rideAtual && (
        <>
          <button
            type="button"
            onClick={alternarOnline}
            disabled={busy === "online" || (!driverInfo.canGoOnline && !online)}
            className={cn(
              "flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-6 text-lg font-bold transition",
              online
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : driverInfo.canGoOnline
                  ? "bg-neutral-900 text-white hover:bg-neutral-800"
                  : "cursor-not-allowed bg-neutral-200 text-neutral-500",
            )}
          >
            {busy === "online" ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Power className="h-6 w-6" />
            )}
            {online ? "VOCÊ ESTÁ ONLINE — tocar para sair" : "FICAR ONLINE"}
          </button>

          {!driverInfo.canGoOnline && driverInfo.onlineBlockReason && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {driverInfo.onlineBlockReason}
            </p>
          )}

          {veiculosAprovados.length > 1 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="mb-2 text-sm font-semibold">Veículo em uso</p>
              <div className="flex flex-wrap gap-2">
                {veiculosAprovados.map((veiculo) => (
                  <Button
                    key={veiculo.id}
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await zcApi(`/drivers/me/vehicles/${veiculo.id}`, {
                          method: "POST",
                          body: {},
                        });
                        await carregar();
                        toast.success("Veículo selecionado.");
                      } catch (error) {
                        toast.error(zcErrorMessage(error));
                      }
                    }}
                  >
                    <Truck className="mr-1 h-4 w-4" />
                    {[veiculo.brand, veiculo.model].filter(Boolean).join(" ")} · {veiculo.plate}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* --- permissão de localização --- */}
      {online && localizacao.permission !== "granted" && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900">
              {localizacao.permission === "denied"
                ? "A localização está bloqueada"
                : "Precisamos da sua localização"}
            </p>
            <p className="text-sm text-amber-800">
              {localizacao.permission === "denied"
                ? "Libere a localização nas configurações do navegador para receber carretos perto de você."
                : "É por ela que mandamos os carretos mais próximos e o cliente acompanha a entrega. Só usamos enquanto você está online."}
            </p>
            {localizacao.permission !== "denied" && (
              <Button size="sm" className="mt-2" onClick={() => localizacao.request()}>
                Liberar localização
              </Button>
            )}
          </div>
        </div>
      )}

      {/* --- ofertas --- */}
      {!rideAtual &&
        snapshot?.offers.map((oferta) => (
          <div
            key={oferta.offerId}
            className="space-y-3 rounded-xl border-2 border-amber-300 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-amber-700">
                  {oferta.modality === "immediate" ? "Imediato" : "Agendado"}
                  {oferta.scheduledFor
                    ? ` · ${new Date(oferta.scheduledFor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                    : ""}
                </p>
                <p className="text-lg font-bold">{oferta.categoryName}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-neutral-500">você recebe</p>
                <p className="text-xl font-bold text-emerald-700">
                  {formatBRL(oferta.earningsCents)}
                </p>
              </div>
            </div>

            <div className="grid gap-2 text-sm">
              <p className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-neutral-400" />
                {oferta.distanceToPickupMeters !== null
                  ? `${(oferta.distanceToPickupMeters / 1000).toFixed(1)} km até a retirada`
                  : "distância até a retirada não calculada"}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-amber-500" />
                Retirada: {oferta.pickup?.district ? `${oferta.pickup.district}, ` : ""}
                {oferta.pickup?.city}/{oferta.pickup?.state}
                {oferta.pickup?.approximate && (
                  <span className="text-xs text-neutral-500">(endereço exato após aceitar)</span>
                )}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                Entrega: {oferta.dropoff?.district ? `${oferta.dropoff.district}, ` : ""}
                {oferta.dropoff?.city}/{oferta.dropoff?.state}
              </p>
              <p className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-neutral-400" />
                {(oferta.serviceDistanceMeters / 1000).toFixed(1)} km de serviço ·{" "}
                {Math.round(oferta.durationSeconds / 60)} min
              </p>
              {oferta.helpersCount > 0 && (
                <p className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-neutral-400" />
                  {oferta.helpersCount} ajudante(s) contratado(s)
                </p>
              )}
              {oferta.addons.length > 0 && (
                <p className="text-neutral-600">
                  Adicionais:{" "}
                  {oferta.addons
                    .map((a) => (a.quantity > 1 ? `${a.name} (${a.quantity}x)` : a.name))
                    .join(", ")}
                </p>
              )}
              {oferta.itemsDescription && (
                <p className="text-neutral-600">Carga: {oferta.itemsDescription}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={busy === oferta.offerId}
                onClick={() => responderOferta(oferta.offerId, "accept")}
              >
                {busy === oferta.offerId ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1 h-4 w-4" />
                )}
                ACEITAR
              </Button>
              <Button
                variant="outline"
                disabled={busy === oferta.offerId}
                onClick={() => responderOferta(oferta.offerId, "decline")}
              >
                <X className="mr-1 h-4 w-4" />
                RECUSAR
              </Button>
            </div>
          </div>
        ))}

      {!rideAtual && online && (snapshot?.offers.length ?? 0) === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
          <p className="text-sm">Você está no ar. Assim que surgir um carreto, ele aparece aqui.</p>
        </div>
      )}

      {/* --- corrida em andamento --- */}
      {rideAtual && (
        <>
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Etapa atual</p>
            <p className="text-lg font-bold">{STATUS_LABELS[rideAtual.status]}</p>
            <p className="mt-1 text-sm text-neutral-600">
              Você recebe {formatBRL(rideAtual.driver_earnings_cents)}
              {rideAtual.helpers_count > 0 ? ` · ${rideAtual.helpers_count} ajudante(s)` : ""}
            </p>
          </div>

          {rideAtual.stops.some((stop) => stop.lat !== null) && (
            <ZcMap
              points={[
                ...(snapshot?.tracking?.position
                  ? [{ ...snapshot.tracking.position, label: "Você" }]
                  : []),
                ...rideAtual.stops
                  .filter((stop) => stop.lat !== null && stop.lng !== null)
                  .map((stop) => ({
                    lat: stop.lat as number,
                    lng: stop.lng as number,
                    label: stop.kind === "pickup" ? "Retirada" : "Entrega",
                  })),
              ]}
            />
          )}

          <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
            {rideAtual.stops.map((stop) => (
              <div key={stop.id} className="flex items-start gap-3">
                <MapPin
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    stop.kind === "pickup" ? "text-amber-500" : "text-emerald-600",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    {stop.kind === "pickup"
                      ? "Retirada"
                      : stop.kind === "dropoff"
                        ? "Entrega"
                        : "Parada"}
                  </p>
                  <p className="text-sm">
                    {stop.street}
                    {stop.number ? `, ${stop.number}` : ""} — {stop.city}/{stop.state}
                  </p>
                  {stop.contact_name && (
                    <p className="text-xs text-neutral-500">Procurar por {stop.contact_name}</p>
                  )}
                  {stop.instructions && (
                    <p className="text-xs text-neutral-500">{stop.instructions}</p>
                  )}
                </div>
              </div>
            ))}
            {rideAtual.notes && (
              <p className="rounded-lg bg-neutral-50 p-3 text-sm">
                <strong>Observações:</strong> {rideAtual.notes}
              </p>
            )}
          </div>

          {proxima && (
            <Button
              className="w-full"
              size="lg"
              disabled={busy === "status"}
              onClick={() => avancar(proxima.to)}
            >
              {busy === "status" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              {proxima.label}
            </Button>
          )}

          <ZcChat rideId={rideAtual.id} myProfileId={session.user.id} />

          {!showRelease ? (
            <Button variant="ghost" className="w-full" onClick={() => setShowRelease(true)}>
              Não vou conseguir fazer este carreto
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-900">
                O carreto volta para a fila e outro carreteiro é chamado. Conte o motivo:
              </p>
              <Textarea
                value={releaseReason}
                onChange={(event) => setReleaseReason(event.target.value)}
                rows={2}
                placeholder="Ex.: quebrei o veículo no caminho"
              />
              <div className="flex gap-2">
                <Button variant="destructive" disabled={busy === "release"} onClick={desistir}>
                  {busy === "release" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Devolver o carreto
                </Button>
                <Button variant="ghost" onClick={() => setShowRelease(false)}>
                  Voltar
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </ZcShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, MapPin, Share2, Star, Truck } from "lucide-react";
import { toast } from "sonner";
import { ZcShell } from "@/components/zecarreto/ZcShell";
import { ZcMap } from "@/components/zecarreto/ZcMap";
import { ZcChat } from "@/components/zecarreto/ZcChat";
import { useZcSession } from "@/components/zecarreto/useZcSession";
import { Button } from "@/components/ui/button";
import { zcApi, zcErrorMessage } from "@/lib/zecarreto/client";
import { formatBRL } from "@/lib/zecarreto/domain/money";
import { STATUS_LABELS } from "@/lib/zecarreto/domain/ride-status";
import type { ZcRideStatus } from "@/lib/zecarreto/domain/enums";

export const Route = createFileRoute("/zecarreto/pedido/$rideId")({ component: PedidoPage });

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
}

interface Ride {
  id: string;
  code: string;
  status: ZcRideStatus;
  modality: "immediate" | "scheduled";
  scheduled_for: string | null;
  distance_meters: number;
  total_cents: number;
  subtotal_cents: number;
  surcharge_cents: number;
  service_fee_cents: number;
  toll_cents: number;
  helpers_count: number;
  items_description: string | null;
  notes: string | null;
  price_breakdown: { lines?: { code: string; label: string; amountCents: number }[] };
  stops: Stop[];
}

interface Tracking {
  driver: {
    name: string;
    photoUrl: string | null;
    ratingAvg: number;
    ridesCount: number;
    phone: string | null;
    vehicle: {
      brand: string | null;
      model: string | null;
      color: string | null;
      plate: string;
      categoryName: string | null;
    } | null;
  } | null;
  position: { lat: number; lng: number; recordedAt: string; stale: boolean } | null;
  eta: { seconds: number | null; label: string | null };
  path: { lat: number; lng: number }[];
}

function PedidoPage() {
  const { rideId } = Route.useParams();
  const { session, loading } = useZcSession({ required: true });
  const [ride, setRide] = useState<Ride | null>(null);
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  async function load() {
    const atual = await zcApi<Ride>(`/rides/${rideId}`);
    setRide(atual);
    // Só busca o acompanhamento quando já existe um carreteiro na jogada.
    if (
      [
        "driver_assigned",
        "driver_to_pickup",
        "driver_arrived",
        "loading",
        "in_transit",
        "unloading",
      ].includes(atual.status)
    ) {
      setTracking(await zcApi<Tracking>(`/rides/${rideId}/track`).catch(() => null));
    }
  }

  useEffect(() => {
    if (!session) return;
    load().catch((error) => toast.error(zcErrorMessage(error)));
    // A tela se atualiza sozinha enquanto o carreto está andando.
    const timer = setInterval(() => {
      load().catch(() => undefined);
    }, 10_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, rideId]);

  async function compartilhar() {
    try {
      const link = await zcApi<{ url: string }>(`/rides/${rideId}/share`, {
        method: "POST",
        body: {},
      });
      const url = `${window.location.origin}${link.url}`;
      setShareUrl(url);
      // No celular abre a folha de compartilhamento; no computador, copia.
      if (navigator.share) {
        await navigator.share({ title: "Acompanhe meu carreto", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado! É só colar para quem está esperando.");
      }
    } catch (error) {
      toast.error(zcErrorMessage(error));
    }
  }

  /**
   * Confirma o pedido e libera a busca por motorista.
   * O carreto imediato só entra na fila DEPOIS deste passo — antes disso
   * nenhum carreteiro é chamado.
   */
  async function confirmar(method: "pix" | "cash") {
    setBusy(true);
    try {
      if (ride?.status === "draft") {
        await zcApi(`/rides/${rideId}/status`, {
          method: "POST",
          body: { to: "awaiting_payment" },
        });
      }
      await zcApi(`/rides/${rideId}/payment`, { method: "POST", body: { method } });
      await load();
      toast.success("Pedido confirmado! Já estamos procurando um carreteiro.");
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session || !ride) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const pontos = [
    ...(tracking?.position
      ? [{ lat: tracking.position.lat, lng: tracking.position.lng, label: "Carreteiro" }]
      : []),
    ...ride.stops
      .filter((stop) => stop.lat !== null && stop.lng !== null)
      .map((stop) => ({
        lat: stop.lat as number,
        lng: stop.lng as number,
        label: stop.kind === "pickup" ? "Retirada" : stop.kind === "dropoff" ? "Entrega" : "Parada",
      })),
  ];

  const aguardandoConfirmacao = ride.status === "draft" || ride.status === "awaiting_payment";

  return (
    <ZcShell
      title={`Carreto ${ride.code}`}
      subtitle={STATUS_LABELS[ride.status]}
      back={{ to: "/zecarreto", label: "Início" }}
    >
      {pontos.length > 0 && <ZcMap points={pontos} />}

      {tracking?.driver && (
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-3">
            {tracking.driver.photoUrl ? (
              <img
                src={tracking.driver.photoUrl}
                alt={`Foto de ${tracking.driver.name}`}
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
                <Truck className="h-6 w-6 text-neutral-500" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{tracking.driver.name}</p>
              <p className="flex items-center gap-1 text-sm text-neutral-600">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {tracking.driver.ratingAvg.toFixed(1).replace(".", ",")}
                <span className="text-neutral-400">·</span>
                {tracking.driver.ridesCount} carretos
              </p>
              {tracking.driver.vehicle && (
                <p className="text-sm text-neutral-600">
                  {[tracking.driver.vehicle.brand, tracking.driver.vehicle.model]
                    .filter(Boolean)
                    .join(" ")}
                  {tracking.driver.vehicle.color ? ` ${tracking.driver.vehicle.color}` : ""} ·{" "}
                  <span className="font-mono font-semibold">{tracking.driver.vehicle.plate}</span>
                </p>
              )}
            </div>
          </div>

          {tracking.eta.label && (
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
              <Clock className="h-4 w-4" />
              Chega em aproximadamente <strong>{tracking.eta.label}</strong>
            </p>
          )}

          {tracking.position?.stale && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Perdemos o sinal do carreteiro há alguns minutos. Se não voltar, procuramos outro para
              você automaticamente.
            </p>
          )}

          <Button variant="outline" className="w-full" onClick={compartilhar}>
            <Share2 className="mr-2 h-4 w-4" />
            Compartilhar acompanhamento
          </Button>
          {shareUrl && <p className="break-all text-xs text-neutral-500">{shareUrl}</p>}
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
        {ride.stops.map((stop) => (
          <div key={stop.id} className="flex items-start gap-3">
            <MapPin
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                stop.kind === "pickup"
                  ? "text-amber-500"
                  : stop.kind === "dropoff"
                    ? "text-emerald-600"
                    : "text-neutral-400"
              }`}
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
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
        <p className="font-semibold">Valor do carreto</p>
        {(ride.price_breakdown?.lines ?? []).map((line) => (
          <div key={line.code} className="flex justify-between text-sm">
            <span className="text-neutral-600">{line.label}</span>
            <span>{formatBRL(line.amountCents)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 text-lg font-bold">
          <span>Total</span>
          <span>{formatBRL(ride.total_cents)}</span>
        </div>
        <p className="text-xs text-neutral-500">
          {(ride.distance_meters / 1000).toFixed(1)} km ·{" "}
          {ride.modality === "immediate" ? "imediato" : "agendado"}
          {ride.scheduled_for
            ? ` para ${new Date(ride.scheduled_for).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}`
            : ""}
          {ride.helpers_count > 0 ? ` · ${ride.helpers_count} ajudante(s)` : ""}
        </p>
      </div>

      {(ride.items_description || ride.notes) && (
        <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
          {ride.items_description && (
            <p>
              <span className="text-neutral-500">O que vai: </span>
              {ride.items_description}
            </p>
          )}
          {ride.notes && (
            <p>
              <span className="text-neutral-500">Observações: </span>
              {ride.notes}
            </p>
          )}
        </div>
      )}

      {aguardandoConfirmacao && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">Falta confirmar</p>
          <p className="text-sm text-amber-900">
            Enquanto você não confirmar, nenhum carreteiro é chamado. Escolha como quer pagar:
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => confirmar("pix")}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar e pagar no PIX
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => confirmar("cash")}>
              Pagar direto ao carreteiro
            </Button>
          </div>
          <p className="text-xs text-amber-800">
            O pagamento pelo aplicativo entra numa fase seguinte. Por enquanto o acerto é combinado
            com o carreteiro.
          </p>
        </div>
      )}

      {tracking?.driver && session && <ZcChat rideId={ride.id} myProfileId={session.user.id} />}

      {ride.status === "searching_driver" && (
        <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
          <p className="text-sm">Procurando um carreteiro perto de você...</p>
        </div>
      )}

      {ride.status === "completed" && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <p className="text-sm text-emerald-900">Carreto concluído. Obrigado!</p>
        </div>
      )}

      <Link
        to="/zecarreto/pedir"
        className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white p-4 text-sm font-medium hover:border-neutral-300"
      >
        <Truck className="h-4 w-4" />
        Pedir outro carreto
      </Link>
    </ZcShell>
  );
}

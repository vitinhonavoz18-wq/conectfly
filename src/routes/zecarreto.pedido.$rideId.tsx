import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Truck } from "lucide-react";
import { toast } from "sonner";
import { ZcShell } from "@/components/zecarreto/ZcShell";
import { ZcMap } from "@/components/zecarreto/ZcMap";
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

function PedidoPage() {
  const { rideId } = Route.useParams();
  const { session, loading } = useZcSession({ required: true });
  const [ride, setRide] = useState<Ride | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setRide(await zcApi<Ride>(`/rides/${rideId}`));
  }

  useEffect(() => {
    if (!session) return;
    load().catch((error) => toast.error(zcErrorMessage(error)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, rideId]);

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

  const pontos = ride.stops
    .filter((stop) => stop.lat !== null && stop.lng !== null)
    .map((stop) => ({
      lat: stop.lat as number,
      lng: stop.lng as number,
      label: stop.kind === "pickup" ? "Retirada" : stop.kind === "dropoff" ? "Entrega" : "Parada",
    }));

  const aguardandoConfirmacao = ride.status === "draft" || ride.status === "awaiting_payment";

  return (
    <ZcShell
      title={`Carreto ${ride.code}`}
      subtitle={STATUS_LABELS[ride.status]}
      back={{ to: "/zecarreto", label: "Início" }}
    >
      {pontos.length > 0 && <ZcMap points={pontos} />}

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

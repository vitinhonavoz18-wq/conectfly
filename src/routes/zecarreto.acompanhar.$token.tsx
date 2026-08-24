import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, Loader2, MapPin, Star, Truck } from "lucide-react";
import { ZcMap } from "@/components/zecarreto/ZcMap";
import { zcApi, zcErrorMessage } from "@/lib/zecarreto/client";

export const Route = createFileRoute("/zecarreto/acompanhar/$token")({ component: AcompanharPage });

interface Tracking {
  ride: { code: string; statusLabel: string; distanceMeters: number };
  driver: {
    name: string;
    photoUrl: string | null;
    ratingAvg: number;
    vehicle: { brand: string | null; model: string | null; plate: string } | null;
  } | null;
  position: { lat: number; lng: number; stale: boolean } | null;
  eta: { label: string | null };
  stops: {
    id: string;
    kind: string;
    city: string;
    state: string;
    lat: number | null;
    lng: number | null;
  }[];
}

/**
 * Acompanhamento por link — sem login.
 *
 * É a tela que o cliente manda para quem está esperando a carga do outro
 * lado. Mostra onde o carreteiro está e quanto falta, mas não mostra
 * telefone nem valor: acompanhar não é entrar na conta de ninguém.
 */
function AcompanharPage() {
  const { token } = Route.useParams();
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        setTracking(await zcApi<Tracking>(`/track/${token}`));
        setErro(null);
      } catch (error) {
        setErro(zcErrorMessage(error));
      }
    }
    carregar();
    const timer = setInterval(carregar, 15_000);
    return () => clearInterval(timer);
  }, [token]);

  if (erro) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-sm rounded-xl border border-neutral-200 bg-white p-6 text-center">
          <Truck className="mx-auto h-10 w-10 text-neutral-300" />
          <p className="mt-3 font-semibold">Acompanhamento indisponível</p>
          <p className="mt-1 text-sm text-neutral-600">{erro}</p>
        </div>
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const pontos = [
    ...(tracking.position
      ? [{ lat: tracking.position.lat, lng: tracking.position.lng, label: "Carreteiro" }]
      : []),
    ...tracking.stops
      .filter((stop) => stop.lat !== null && stop.lng !== null)
      .map((stop) => ({
        lat: stop.lat as number,
        lng: stop.lng as number,
        label: stop.kind === "pickup" ? "Retirada" : "Entrega",
      })),
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3 font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 text-neutral-900">
            <Truck className="h-5 w-5" />
          </span>
          ZÉ CARRETO
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carreto {tracking.ride.code}</h1>
          <p className="text-sm text-neutral-600">{tracking.ride.statusLabel}</p>
        </div>

        {pontos.length > 0 && <ZcMap points={pontos} height={260} />}

        {tracking.eta.label && (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
            <Clock className="h-4 w-4" />
            Chega em aproximadamente <strong>{tracking.eta.label}</strong>
          </p>
        )}

        {tracking.position?.stale && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            O sinal do carreteiro está fora do ar há alguns minutos.
          </p>
        )}

        {tracking.driver && (
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
            {tracking.driver.photoUrl ? (
              <img
                src={tracking.driver.photoUrl}
                alt={`Foto de ${tracking.driver.name}`}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
                <Truck className="h-5 w-5 text-neutral-500" />
              </span>
            )}
            <div>
              <p className="font-semibold">{tracking.driver.name}</p>
              <p className="flex items-center gap-1 text-sm text-neutral-600">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {tracking.driver.ratingAvg.toFixed(1).replace(".", ",")}
              </p>
              {tracking.driver.vehicle && (
                <p className="text-sm text-neutral-600">
                  {[tracking.driver.vehicle.brand, tracking.driver.vehicle.model]
                    .filter(Boolean)
                    .join(" ")}{" "}
                  · <span className="font-mono">{tracking.driver.vehicle.plate}</span>
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
          {tracking.stops.map((stop) => (
            <p key={stop.id} className="flex items-center gap-2 text-sm">
              <MapPin
                className={`h-4 w-4 ${stop.kind === "pickup" ? "text-amber-500" : "text-emerald-600"}`}
              />
              {stop.kind === "pickup" ? "Retirada" : stop.kind === "dropoff" ? "Entrega" : "Parada"}
              : {stop.city}/{stop.state}
            </p>
          ))}
        </div>

        <p className="text-center text-xs text-neutral-400">
          Este link mostra apenas o andamento do carreto.
        </p>
      </main>
    </div>
  );
}

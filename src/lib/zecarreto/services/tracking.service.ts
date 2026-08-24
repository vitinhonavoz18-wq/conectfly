/**
 * Rastreamento do carreto.
 *
 * Recebe o sinal de posição do carreteiro, decide o que vale a pena
 * guardar e monta o que o cliente vê na tela: onde o motorista está,
 * quanto falta e qual a etapa.
 */

import { zcAdmin } from "../db/client";
import { fromPostgresError, zcError } from "../errors";
import {
  decidePing,
  isSignalStale,
  approximateLocation,
  type TrackingPolicy,
} from "../domain/tracking";
import { estimateEta, formatEta } from "../domain/eta";
import { maskPhone } from "../domain/masking";
import type { LatLng } from "../domain/geo";
import { ZC_RIDE_ACTIVE_WITH_DRIVER, type ZcRideStatus } from "../domain/enums";
import { STATUS_LABELS } from "../domain/ride-status";
import type { ZcRideRow, ZcRideStopRow } from "../db/types";
import type { LocationPingInput } from "../validation";
import { getNumberSetting } from "./settings.service";

async function loadPolicy(): Promise<TrackingPolicy> {
  const [minSecondsBetweenPings, minDistanceMeters, maxSecondsBetweenPoints] = await Promise.all([
    getNumberSetting("tracking.min_seconds_between_pings"),
    getNumberSetting("tracking.min_distance_meters"),
    getNumberSetting("tracking.max_seconds_between_points"),
  ]);
  return { minSecondsBetweenPings, minDistanceMeters, maxSecondsBetweenPoints };
}

export interface PingResult {
  accepted: boolean;
  storedBreadcrumb: boolean;
  movedMeters: number | null;
  reason: string;
  etaSeconds?: number | null;
}

/**
 * Registra a posição do carreteiro.
 *
 * Guarda a posição atual (uma linha por motorista, sobrescrita) e, durante
 * a corrida, um ponto na trilha só quando ele realmente andou. Assim o
 * cliente vê o carro se mexendo sem que o banco cresça sem controle.
 */
export async function handleLocationPing(
  driverId: string,
  input: LocationPingInput,
): Promise<PingResult> {
  const db = zcAdmin();
  const policy = await loadPolicy();
  const recordedAt = input.recorded_at ? new Date(input.recorded_at) : new Date();
  const point: LatLng = { lat: input.lat, lng: input.lng };

  const { data: current } = await db
    .from("zc_driver_locations")
    .select("lat, lng, recorded_at, ride_id")
    .eq("driver_id", driverId)
    .maybeSingle();

  // A corrida ativa manda: mesmo que o aplicativo não informe, o servidor
  // sabe em qual carreto o motorista está.
  const { data: activeRide } = await db
    .from("zc_rides")
    .select("id, status, driver_id")
    .eq("driver_id", driverId)
    .in("status", [...ZC_RIDE_ACTIVE_WITH_DRIVER])
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rideId = activeRide?.id ?? null;

  const { data: lastPoint } = rideId
    ? await db
        .from("zc_ride_tracking")
        .select("lat, lng, recorded_at")
        .eq("ride_id", rideId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const decision = decidePing({
    now: { ...point, recordedAt },
    lastCurrent: current
      ? {
          lat: Number(current.lat),
          lng: Number(current.lng),
          recordedAt: new Date(current.recorded_at),
        }
      : null,
    lastBreadcrumb: lastPoint
      ? {
          lat: Number(lastPoint.lat),
          lng: Number(lastPoint.lng),
          recordedAt: new Date(lastPoint.recorded_at),
        }
      : null,
    onRide: !!rideId,
    policy,
  });

  if (!decision.updateCurrent) {
    return {
      accepted: false,
      storedBreadcrumb: false,
      movedMeters: decision.movedMeters,
      reason: decision.reason,
    };
  }

  const { data: driver } = await db
    .from("zc_drivers")
    .select("availability")
    .eq("id", driverId)
    .maybeSingle();

  const { error } = await db.from("zc_driver_locations").upsert(
    {
      driver_id: driverId,
      ride_id: rideId,
      lat: input.lat,
      lng: input.lng,
      heading: input.heading ?? null,
      speed_kmh: input.speed_kmh ?? null,
      accuracy_m: input.accuracy_m ?? null,
      availability: driver?.availability ?? "online",
      app_state: input.app_state ?? "unknown",
      battery_pct: input.battery_pct ?? null,
      recorded_at: recordedAt.toISOString(),
    },
    { onConflict: "driver_id" },
  );
  if (error) throw fromPostgresError(error);

  if (decision.storeBreadcrumb && rideId) {
    await db.from("zc_ride_tracking").insert({
      ride_id: rideId,
      driver_id: driverId,
      lat: input.lat,
      lng: input.lng,
      heading: input.heading ?? null,
      speed_kmh: input.speed_kmh ?? null,
      distance_from_previous_m:
        decision.movedMeters === null ? null : Math.round(decision.movedMeters),
      recorded_at: recordedAt.toISOString(),
    });
  }

  let etaSeconds: number | null = null;
  if (rideId && activeRide) {
    etaSeconds = await refreshEta(rideId, point, input.speed_kmh ?? null);
  }

  return {
    accepted: true,
    storedBreadcrumb: decision.storeBreadcrumb,
    movedMeters: decision.movedMeters,
    reason: decision.reason,
    etaSeconds,
  };
}

/** Recalcula quanto falta para o carreteiro chegar ao próximo ponto. */
export async function refreshEta(
  rideId: string,
  driverPoint: LatLng,
  speedKmh: number | null,
): Promise<number | null> {
  const db = zcAdmin();
  const { data: ride } = await db
    .from("zc_rides")
    .select("id, status, eta_updated_at")
    .eq("id", rideId)
    .maybeSingle();
  if (!ride) return null;

  const refreshSeconds = await getNumberSetting("eta.refresh_seconds");
  if (
    ride.eta_updated_at &&
    Date.now() - new Date(ride.eta_updated_at).getTime() < refreshSeconds * 1000
  ) {
    return null; // recalculado há pouco: não precisa de novo
  }

  const target = await nextStopPoint(rideId, ride.status as ZcRideStatus);
  if (!target) return null;

  const [averageSpeedKmh, minimumSeconds] = await Promise.all([
    getNumberSetting("eta.avg_speed_kmh"),
    getNumberSetting("eta.min_seconds"),
  ]);

  const eta = estimateEta(driverPoint, target, {
    averageSpeedKmh,
    minimumSeconds,
    currentSpeedKmh: speedKmh,
  });

  await db
    .from("zc_rides")
    .update({
      eta_seconds: eta.seconds,
      eta_updated_at: new Date().toISOString(),
      last_driver_ping_at: new Date().toISOString(),
    })
    .eq("id", rideId);

  return eta.seconds;
}

/** Para onde o carreteiro está indo agora, conforme a etapa da corrida. */
async function nextStopPoint(rideId: string, status: ZcRideStatus): Promise<LatLng | null> {
  const { data: stops } = await zcAdmin()
    .from("zc_ride_stops")
    .select("sequence, kind, lat, lng, status")
    .eq("ride_id", rideId)
    .order("sequence");
  if (!stops?.length) return null;

  const withPoint = stops.filter((stop) => stop.lat !== null && stop.lng !== null);
  if (!withPoint.length) return null;

  // Antes de carregar, o destino é a retirada. Depois, a próxima parada
  // que ainda não foi concluída.
  if (["driver_assigned", "driver_to_pickup", "driver_arrived", "loading"].includes(status)) {
    const pickup = withPoint[0];
    return { lat: Number(pickup.lat), lng: Number(pickup.lng) };
  }
  const pending = withPoint.find((stop) => stop.status !== "completed" && stop.sequence > 0);
  const target = pending ?? withPoint[withPoint.length - 1];
  return { lat: Number(target.lat), lng: Number(target.lng) };
}

export interface TrackingPayload {
  ride: {
    id: string;
    code: string;
    status: ZcRideStatus;
    statusLabel: string;
    modality: string;
    scheduledFor: string | null;
    totalCents: number;
    distanceMeters: number;
  };
  driver: {
    name: string;
    firstName: string;
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
  position: {
    lat: number;
    lng: number;
    heading: number | null;
    recordedAt: string;
    stale: boolean;
  } | null;
  eta: { seconds: number | null; label: string | null; updatedAt: string | null };
  stops: Pick<
    ZcRideStopRow,
    "id" | "sequence" | "kind" | "street" | "number" | "city" | "state" | "lat" | "lng" | "status"
  >[];
  /** Trilha simplificada, para desenhar o caminho já percorrido. */
  path: { lat: number; lng: number; recordedAt: string }[];
}

/**
 * O que o cliente vê enquanto acompanha.
 *
 * `publicView` liga o modo "link compartilhado": quem recebeu o link vê o
 * carreto andando, mas não vê telefone nem valor — acompanhar não é o
 * mesmo que ter acesso à conta de outra pessoa.
 */
export async function getTrackingPayload(
  rideId: string,
  options: { publicView?: boolean } = {},
): Promise<TrackingPayload> {
  const db = zcAdmin();
  const { data: ride } = await db.from("zc_rides").select("*").eq("id", rideId).maybeSingle();
  if (!ride) throw zcError.notFound("Carreto não encontrado.");

  const { data: stops } = await db
    .from("zc_ride_stops")
    .select("id, sequence, kind, street, number, city, state, lat, lng, status")
    .eq("ride_id", rideId)
    .order("sequence");

  let driver: TrackingPayload["driver"] = null;
  let position: TrackingPayload["position"] = null;
  let path: TrackingPayload["path"] = [];

  if (ride.driver_id) {
    const [{ data: driverRow }, { data: location }, { data: breadcrumbs }] = await Promise.all([
      db
        .from("zc_drivers")
        .select("id, profile_id, rating_avg, rides_count, current_vehicle_id")
        .eq("id", ride.driver_id)
        .maybeSingle(),
      db
        .from("zc_driver_locations")
        .select("lat, lng, heading, recorded_at")
        .eq("driver_id", ride.driver_id)
        .maybeSingle(),
      db
        .from("zc_ride_tracking")
        .select("lat, lng, recorded_at")
        .eq("ride_id", rideId)
        .order("recorded_at")
        .limit(300),
    ]);

    if (driverRow) {
      const [{ data: profile }, { data: vehicle }] = await Promise.all([
        db
          .from("zc_profiles")
          .select("full_name, phone, avatar_url")
          .eq("id", driverRow.profile_id)
          .maybeSingle(),
        ride.vehicle_id
          ? db
              .from("zc_vehicles")
              .select("brand, model, color, plate, category_id")
              .eq("id", ride.vehicle_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      let categoryName: string | null = null;
      if (vehicle?.category_id) {
        const { data: category } = await db
          .from("zc_vehicle_categories")
          .select("name")
          .eq("id", vehicle.category_id)
          .maybeSingle();
        categoryName = category?.name ?? null;
      }

      const fullName = profile?.full_name ?? "Carreteiro";
      driver = {
        name: options.publicView ? fullName.split(" ")[0] : fullName,
        firstName: fullName.split(" ")[0],
        photoUrl: profile?.avatar_url ?? null,
        ratingAvg: Number(driverRow.rating_avg),
        ridesCount: driverRow.rides_count,
        // No link compartilhado o telefone não aparece de jeito nenhum.
        phone: options.publicView ? null : maskPhone(profile?.phone ?? null),
        vehicle: vehicle
          ? {
              brand: vehicle.brand,
              model: vehicle.model,
              color: vehicle.color,
              plate: vehicle.plate,
              categoryName,
            }
          : null,
      };
    }

    if (location) {
      const graceSeconds = await getNumberSetting("tracking.offline_grace_seconds");
      position = {
        lat: Number(location.lat),
        lng: Number(location.lng),
        heading: location.heading === null ? null : Number(location.heading),
        recordedAt: location.recorded_at,
        stale: isSignalStale(new Date(location.recorded_at), graceSeconds),
      };
    }

    path = (breadcrumbs ?? []).map((point) => ({
      lat: Number(point.lat),
      lng: Number(point.lng),
      recordedAt: point.recorded_at,
    }));
  }

  return {
    ride: {
      id: ride.id,
      code: ride.code,
      status: ride.status,
      statusLabel: STATUS_LABELS[ride.status],
      modality: ride.modality,
      scheduledFor: ride.scheduled_for,
      totalCents: options.publicView ? 0 : ride.total_cents,
      distanceMeters: ride.distance_meters,
    },
    driver,
    position,
    eta: {
      seconds: ride.eta_seconds,
      label: ride.eta_seconds === null ? null : formatEta(ride.eta_seconds),
      updatedAt: ride.eta_updated_at,
    },
    stops: (stops ?? []) as TrackingPayload["stops"],
    path,
  };
}

/**
 * Endereço aproximado da retirada, para o carreteiro decidir se vale a
 * pena ir. O ponto exato só aparece depois do aceite.
 */
export async function approximatePickup(ride: ZcRideRow): Promise<{
  lat: number;
  lng: number;
  district: string | null;
  city: string;
  state: string;
} | null> {
  const { data: pickup } = await zcAdmin()
    .from("zc_ride_stops")
    .select("lat, lng, district, city, state")
    .eq("ride_id", ride.id)
    .order("sequence")
    .limit(1)
    .maybeSingle();
  if (!pickup || pickup.lat === null || pickup.lng === null) return null;

  const radius = await getNumberSetting("privacy.approximate_pickup_meters");
  const rounded = approximateLocation({ lat: Number(pickup.lat), lng: Number(pickup.lng) }, radius);
  return {
    lat: rounded.lat,
    lng: rounded.lng,
    district: pickup.district,
    city: pickup.city,
    state: pickup.state,
  };
}

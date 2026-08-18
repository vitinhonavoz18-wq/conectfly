/**
 * Despacho — como o carreto chega até os motoristas.
 *
 * Funciona por rodadas, igual a chamar mesa por mesa: primeiro os
 * motoristas mais perto; se ninguém aceitar no tempo combinado, aumenta o
 * raio e chama a próxima leva. O primeiro que aceitar leva a corrida — e o
 * banco garante que só um leva.
 */

import { zcAdmin } from "../db/client";
import { fromPostgresError, zcError, ZcError } from "../errors";
import { boundingBox, haversineMeters, type LatLng } from "../domain/geo";
import type { ZcRideOfferRow, ZcRideRow } from "../db/types";
import { getNumberSetting } from "./settings.service";
import { notify } from "./notifications.service";

export interface EligibleDriver {
  driverId: string;
  profileId: string;
  distanceMeters: number;
  ratingAvg: number;
}

/** Onde o carreto começa (a primeira parada). */
export async function getRidePickupPoint(rideId: string): Promise<LatLng | null> {
  const { data } = await zcAdmin()
    .from("zc_ride_stops")
    .select("lat, lng")
    .eq("ride_id", rideId)
    .order("sequence")
    .limit(1)
    .maybeSingle();
  if (!data || data.lat === null || data.lng === null) return null;
  return { lat: Number(data.lat), lng: Number(data.lng) };
}

/**
 * Acha os motoristas que podem receber a oferta:
 * aprovados, online, com sinal recente, com veículo da categoria pedida,
 * com nota acima do mínimo e dentro do raio da rodada.
 */
export async function findEligibleDrivers(params: {
  pickup: LatLng;
  categoryId: string;
  regionId: string | null;
  radiusKm: number;
  excludeDriverIds?: string[];
  limit?: number;
}): Promise<EligibleDriver[]> {
  const db = zcAdmin();
  const box = boundingBox(params.pickup, params.radiusKm);
  const staleSeconds = await getNumberSetting("tracking.stale_after_seconds");
  const minRating = await getNumberSetting("driver.min_rating");
  const freshSince = new Date(Date.now() - staleSeconds * 1000).toISOString();

  const { data: locations, error } = await db
    .from("zc_driver_locations")
    .select("driver_id, lat, lng, availability, recorded_at")
    .eq("availability", "online")
    .gte("recorded_at", freshSince)
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lng", box.minLng)
    .lte("lng", box.maxLng)
    .limit(300);
  if (error) throw fromPostgresError(error);
  if (!locations?.length) return [];

  const candidateIds = locations
    .map((row) => row.driver_id)
    .filter((id) => !params.excludeDriverIds?.includes(id));
  if (!candidateIds.length) return [];

  const { data: drivers, error: driversError } = await db
    .from("zc_drivers")
    .select("id, profile_id, status, availability, rating_avg, current_vehicle_id")
    .in("id", candidateIds)
    .eq("status", "approved")
    .is("deleted_at", null)
    .gte("rating_avg", minRating);
  if (driversError) throw fromPostgresError(driversError);
  if (!drivers?.length) return [];

  // O veículo ativo do motorista precisa ser da categoria pedida.
  const { data: vehicles } = await db
    .from("zc_vehicles")
    .select("id, driver_id, category_id")
    .in(
      "driver_id",
      drivers.map((driver) => driver.id),
    )
    .eq("category_id", params.categoryId)
    .eq("active", true)
    .is("deleted_at", null);
  const driversWithVehicle = new Set((vehicles ?? []).map((vehicle) => vehicle.driver_id));

  const byDriver = new Map(locations.map((row) => [row.driver_id, row]));
  const radiusMeters = params.radiusKm * 1000;

  return drivers
    .filter((driver) => driversWithVehicle.has(driver.id))
    .map((driver) => {
      const location = byDriver.get(driver.id)!;
      return {
        driverId: driver.id,
        profileId: driver.profile_id,
        ratingAvg: Number(driver.rating_avg),
        distanceMeters: haversineMeters(params.pickup, {
          lat: Number(location.lat),
          lng: Number(location.lng),
        }),
      };
    })
    .filter((driver) => driver.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, params.limit ?? 5);
}

/**
 * Dispara uma rodada de ofertas. Devolve quantas foram enviadas.
 * Chamada de novo a cada rodada (por tarefa agendada, na FASE 2).
 */
export async function startDriverSearch(
  rideId: string,
  round = 1,
): Promise<{
  round: number;
  offersSent: number;
  radiusKm: number;
}> {
  const db = zcAdmin();
  const { data: ride } = await db.from("zc_rides").select("*").eq("id", rideId).maybeSingle();
  if (!ride) throw zcError.notFound("Carreto não encontrado.");
  if (ride.status !== "searching_driver") {
    return { round, offersSent: 0, radiusKm: 0 };
  }

  const pickup = await getRidePickupPoint(rideId);
  if (!pickup) {
    console.warn(`[ZC] carreto ${rideId} sem coordenada de retirada — busca não pôde rodar.`);
    return { round, offersSent: 0, radiusKm: 0 };
  }

  const [initial, step, max, batch, ttl] = await Promise.all([
    getNumberSetting("dispatch.radius_initial_km"),
    getNumberSetting("dispatch.radius_step_km"),
    getNumberSetting("dispatch.radius_max_km"),
    getNumberSetting("dispatch.batch_size"),
    getNumberSetting("dispatch.offer_ttl_seconds"),
  ]);
  const radiusKm = Math.min(initial + step * (round - 1), max);

  const { data: previous } = await db
    .from("zc_ride_offers")
    .select("driver_id")
    .eq("ride_id", rideId);
  const alreadyOffered = (previous ?? []).map((offer) => offer.driver_id);

  const drivers = await findEligibleDrivers({
    pickup,
    categoryId: ride.category_id,
    regionId: ride.region_id,
    radiusKm,
    excludeDriverIds: alreadyOffered,
    limit: batch,
  });
  if (!drivers.length) return { round, offersSent: 0, radiusKm };

  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  const { data: offers, error } = await db
    .from("zc_ride_offers")
    .insert(
      drivers.map((driver) => ({
        ride_id: rideId,
        driver_id: driver.driverId,
        round,
        distance_meters: driver.distanceMeters,
        payout_cents: ride.driver_earnings_cents,
        expires_at: expiresAt,
      })),
    )
    .select();
  if (error) throw fromPostgresError(error);

  await Promise.all(
    drivers.map((driver) =>
      notify({
        profileId: driver.profileId,
        rideId,
        type: "offer.new",
        title: "Novo carreto para você",
        body: `Retirada a ${(driver.distanceMeters / 1000).toFixed(1)} km. Você recebe ${(ride.driver_earnings_cents / 100).toFixed(2).replace(".", ",")} reais.`,
        channel: "push",
        dedupeKey: `${rideId}:offer:${driver.driverId}:${round}`,
      }).catch((error) => console.error("[ZC] aviso de oferta falhou:", error)),
    ),
  );

  return { round, offersSent: offers?.length ?? 0, radiusKm };
}

/** Ofertas do motorista que ainda estão valendo. */
export async function listDriverOffers(driverId: string): Promise<ZcRideOfferRow[]> {
  const { data, error } = await zcAdmin()
    .from("zc_ride_offers")
    .select("*")
    .eq("driver_id", driverId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw fromPostgresError(error);
  return data ?? [];
}

/**
 * Motorista aceita. A decisão de quem leva é do BANCO (função
 * `zc_accept_ride_offer`), que tranca a corrida enquanto decide — assim
 * dois motoristas apertando junto não bagunçam nada.
 */
export async function acceptOffer(
  offerId: string,
  driverId: string,
  vehicleId?: string | null,
): Promise<ZcRideRow> {
  const { data, error } = await zcAdmin().rpc("zc_accept_ride_offer", {
    _offer_id: offerId,
    _driver_id: driverId,
    _vehicle_id: vehicleId ?? null,
  });
  if (error) throw fromPostgresError(error);
  if (!data) throw new ZcError("ZC_RIDE_TAKEN", "Outro motorista aceitou este carreto primeiro.");
  return data as ZcRideRow;
}

export async function declineOffer(
  offerId: string,
  driverId: string,
  reason?: string,
): Promise<ZcRideOfferRow> {
  const { data, error } = await zcAdmin()
    .from("zc_ride_offers")
    .update({
      status: "declined",
      responded_at: new Date().toISOString(),
      decline_reason: reason ?? null,
    })
    .eq("id", offerId)
    .eq("driver_id", driverId)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) throw zcError.conflict("Esta oferta já não está mais disponível.");
  return data;
}

/** Marca como vencidas as ofertas que passaram do prazo. */
export async function expireStaleOffers(): Promise<number> {
  const { data, error } = await zcAdmin()
    .from("zc_ride_offers")
    .update({ status: "expired", responded_at: new Date().toISOString() })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select("id");
  if (error) throw fromPostgresError(error);
  return data?.length ?? 0;
}

export async function cancelPendingOffers(rideId: string): Promise<void> {
  await zcAdmin()
    .from("zc_ride_offers")
    .update({ status: "cancelled", responded_at: new Date().toISOString() })
    .eq("ride_id", rideId)
    .eq("status", "pending");
}

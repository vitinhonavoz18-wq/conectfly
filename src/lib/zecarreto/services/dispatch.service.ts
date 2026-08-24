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
import { approximatePickup } from "./tracking.service";
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
 * Acha os carreteiros que podem receber a oferta.
 *
 * Os critérios, na ordem em que são conferidos:
 *  1. está ONLINE e com sinal recente (não sumiu do mapa);
 *  2. cadastro APROVADO e nota acima do mínimo;
 *  3. tem VEÍCULO APROVADO da categoria pedida;
 *  4. está na REGIÃO do carreto (ou sem região definida);
 *  5. está PERTO o bastante da retirada;
 *  6. não tem CONFLITO — nem outro carreto rolando, nem compromisso
 *     marcado que cruze com este horário.
 *
 * É a mesma conferência que um despachante experiente faria antes de
 * ligar para alguém: "está trabalhando? tem o carro certo? está por
 * perto? não está com outro serviço marcado?"
 */
export async function findEligibleDrivers(params: {
  pickup: LatLng;
  categoryId: string;
  regionId: string | null;
  radiusKm: number;
  excludeDriverIds?: string[];
  limit?: number;
  /** Janela do compromisso — para agendados, a hora marcada. */
  window?: { startsAt: Date; endsAt: Date };
  rideId?: string;
}): Promise<EligibleDriver[]> {
  const db = zcAdmin();
  const box = boundingBox(params.pickup, params.radiusKm);
  const staleSeconds = await getNumberSetting("tracking.stale_after_seconds");
  const minRating = await getNumberSetting("driver.min_rating");
  const freshSince = new Date(Date.now() - staleSeconds * 1000).toISOString();

  // 1. quem está online e com sinal recente, dentro do quadrado de busca
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

  // 2. cadastro aprovado, nota mínima e disponibilidade livre
  const { data: drivers, error: driversError } = await db
    .from("zc_drivers")
    .select("id, profile_id, status, availability, rating_avg, current_vehicle_id, region_id")
    .in("id", candidateIds)
    .eq("status", "approved")
    .eq("availability", "online")
    .is("deleted_at", null)
    .gte("rating_avg", minRating);
  if (driversError) throw fromPostgresError(driversError);
  if (!drivers?.length) return [];

  // 4. região: a do carreto, ou motorista sem região amarrada
  const inRegion = drivers.filter(
    (driver) => !params.regionId || !driver.region_id || driver.region_id === params.regionId,
  );
  if (!inRegion.length) return [];

  // 3. veículo APROVADO da categoria pedida (não basta estar cadastrado)
  const { data: vehicles } = await db
    .from("zc_vehicles")
    .select("id, driver_id, category_id")
    .in(
      "driver_id",
      inRegion.map((driver) => driver.id),
    )
    .eq("category_id", params.categoryId)
    .eq("status", "approved")
    .eq("active", true)
    .is("deleted_at", null);
  const driversWithVehicle = new Set((vehicles ?? []).map((vehicle) => vehicle.driver_id));

  const byDriver = new Map(locations.map((row) => [row.driver_id, row]));
  const radiusMeters = params.radiusKm * 1000;

  // 5. distância real até a retirada
  const nearby = inRegion
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
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  if (!params.window) return nearby.slice(0, params.limit ?? 5);

  // 6. conflito de agenda — quem já tem compromisso no horário sai da lista
  const livres: EligibleDriver[] = [];
  for (const driver of nearby) {
    if (livres.length >= (params.limit ?? 5)) break;
    const { data: busy } = await db.rpc("zc_driver_has_conflict", {
      _driver_id: driver.driverId,
      _starts_at: params.window.startsAt.toISOString(),
      _ends_at: params.window.endsAt.toISOString(),
      _exclude_ride: params.rideId ?? null,
    });
    if (!busy) livres.push(driver);
  }
  return livres;
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

  // Janela do compromisso: agendado usa a hora marcada; imediato, agora.
  const startsAt = ride.scheduled_for ? new Date(ride.scheduled_for) : new Date();
  const endsAt = new Date(startsAt.getTime() + ((ride.duration_seconds || 3600) + 1800) * 1000);

  const drivers = await findEligibleDrivers({
    pickup,
    categoryId: ride.category_id,
    regionId: ride.region_id,
    radiusKm,
    excludeDriverIds: alreadyOffered,
    limit: batch,
    window: { startsAt, endsAt },
    rideId: ride.id,
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

/**
 * O que o carreteiro vê ANTES de aceitar.
 *
 * Mostra o suficiente para ele decidir se vale a pena — categoria, quanto
 * vai ganhar, para onde vai, quanto tempo leva — mas o endereço exato da
 * retirada só aparece depois do aceite. É o anúncio de imóvel: você vê a
 * região antes de marcar a visita, não o número da casa.
 */
export interface OfferCard {
  offerId: string;
  rideId: string;
  rideCode: string;
  expiresAt: string;
  status: string;
  categoryName: string | null;
  modality: string;
  scheduledFor: string | null;
  /** Distância entre o carreteiro e o local de retirada. */
  distanceToPickupMeters: number | null;
  /** Distância do serviço em si (retirada → entrega). */
  serviceDistanceMeters: number;
  durationSeconds: number;
  helpersCount: number;
  addons: { code: string; name: string; quantity: number }[];
  earningsCents: number;
  /** Aproximado antes do aceite; exato depois. */
  pickup: {
    lat: number | null;
    lng: number | null;
    district: string | null;
    city: string;
    state: string;
    street?: string;
    number?: string | null;
    approximate: boolean;
  } | null;
  dropoff: { district: string | null; city: string; state: string } | null;
  itemsDescription: string | null;
}

export async function buildOfferCard(offer: ZcRideOfferRow): Promise<OfferCard | null> {
  const db = zcAdmin();
  const { data: ride } = await db
    .from("zc_rides")
    .select("*")
    .eq("id", offer.ride_id)
    .maybeSingle();
  if (!ride) return null;

  const [{ data: stops }, { data: category }] = await Promise.all([
    db
      .from("zc_ride_stops")
      .select("sequence, kind, street, number, district, city, state, lat, lng")
      .eq("ride_id", ride.id)
      .order("sequence"),
    db.from("zc_vehicle_categories").select("name").eq("id", ride.category_id).maybeSingle(),
  ]);

  const pickupStop = stops?.[0] ?? null;
  const dropoffStop = stops?.[stops.length - 1] ?? null;
  const accepted = offer.status === "accepted";

  let pickup: OfferCard["pickup"] = null;
  if (pickupStop) {
    if (accepted) {
      pickup = {
        lat: pickupStop.lat === null ? null : Number(pickupStop.lat),
        lng: pickupStop.lng === null ? null : Number(pickupStop.lng),
        district: pickupStop.district,
        city: pickupStop.city,
        state: pickupStop.state,
        street: pickupStop.street,
        number: pickupStop.number,
        approximate: false,
      };
    } else {
      const rounded = await approximatePickup(ride);
      pickup = {
        lat: rounded?.lat ?? null,
        lng: rounded?.lng ?? null,
        district: pickupStop.district,
        city: pickupStop.city,
        state: pickupStop.state,
        approximate: true,
      };
    }
  }

  const addons = Array.isArray(ride.addons)
    ? (ride.addons as { code: string; name: string; quantity: number }[])
    : [];

  return {
    offerId: offer.id,
    rideId: ride.id,
    rideCode: ride.code,
    expiresAt: offer.expires_at,
    status: offer.status,
    categoryName: category?.name ?? null,
    modality: ride.modality,
    scheduledFor: ride.scheduled_for,
    distanceToPickupMeters: offer.distance_meters,
    serviceDistanceMeters: ride.distance_meters,
    durationSeconds: ride.duration_seconds,
    helpersCount: ride.helpers_count,
    addons,
    earningsCents: offer.payout_cents ?? ride.driver_earnings_cents,
    pickup,
    dropoff: dropoffStop
      ? { district: dropoffStop.district, city: dropoffStop.city, state: dropoffStop.state }
      : null,
    itemsDescription: ride.items_description,
  };
}

/** As ofertas do carreteiro, prontas para a tela. */
export async function listDriverOfferCards(driverId: string): Promise<OfferCard[]> {
  const offers = await listDriverOffers(driverId);
  const cards = await Promise.all(offers.map((offer) => buildOfferCard(offer)));
  return cards.filter((card): card is OfferCard => card !== null);
}

/**
 * O carreteiro desiste depois de ter aceitado.
 *
 * A corrida NÃO é cancelada: ela volta para a fila e outro carreteiro é
 * chamado. O cliente é avisado, e a desistência entra na ficha de quem
 * desistiu — desistir de vez em quando acontece; desistir sempre é outro
 * assunto.
 */
export async function releaseRide(
  rideId: string,
  reason: string,
  blameDriver = true,
): Promise<ZcRideRow> {
  const { data, error } = await zcAdmin().rpc("zc_release_ride", {
    _ride_id: rideId,
    _reason: reason,
    _blame_driver: blameDriver,
  });
  if (error) throw fromPostgresError(error);

  const ride = data as ZcRideRow;
  await notify({
    profileId: ride.customer_profile_id,
    rideId,
    type: "ride.reassigning",
    title: "Procurando outro carreteiro",
    body: reason,
    dedupeKey: `${rideId}:reassign:${ride.reassignment_count}`,
  }).catch(() => undefined);

  const maxReassignments = await getNumberSetting("dispatch.max_reassignments");
  if (ride.reassignment_count >= maxReassignments) {
    console.warn(
      `[ZC] carreto ${ride.code} já voltou para a fila ${ride.reassignment_count} vezes — o suporte precisa olhar.`,
    );
  } else {
    await startDriverSearch(rideId, 1).catch((error) =>
      console.error("[ZC] falha ao reabrir a busca:", error),
    );
  }
  return ride;
}

/**
 * Faxina periódica: tira do ar quem sumiu e devolve para a fila os
 * carretos cujo carreteiro não dá mais sinal.
 */
export async function recoverStaleState(): Promise<{
  driversTakenOffline: number;
  ridesReleased: number;
  offersExpired: number;
}> {
  const db = zcAdmin();
  const [staleSeconds, graceSeconds] = await Promise.all([
    getNumberSetting("tracking.stale_after_seconds"),
    getNumberSetting("tracking.offline_grace_seconds"),
  ]);

  const offersExpired = await expireStaleOffers();

  // A ORDEM importa. Primeiro devolvemos para a fila os carretos cujo
  // carreteiro sumiu — isso também o solta do "ocupado". Só depois é que
  // tiramos do ar quem continua sem dar sinal.
  //
  // Fazendo ao contrário, o carreteiro ocupado nunca sairia do ar: ele não
  // está "online", está "ocupado", e a faxina passaria batido por ele.
  const { data: ridesReleased, error: recoverError } = await db.rpc("zc_recover_abandoned_rides", {
    _grace_seconds: graceSeconds,
  });
  if (recoverError) throw fromPostgresError(recoverError);

  const { data: driversTakenOffline, error: offlineError } = await db.rpc(
    "zc_expire_stale_drivers",
    { _stale_seconds: staleSeconds },
  );
  if (offlineError) throw fromPostgresError(offlineError);

  return {
    driversTakenOffline: Number(driversTakenOffline ?? 0),
    ridesReleased: Number(ridesReleased ?? 0),
    offersExpired,
  };
}

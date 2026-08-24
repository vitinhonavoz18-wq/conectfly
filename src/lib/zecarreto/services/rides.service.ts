/**
 * Corridas (carretos) — do rascunho até a conclusão.
 *
 * Este serviço é o dono da esteira: ele decide se a corrida pode andar de
 * uma etapa para a outra, quem pode empurrar, e o que acontece de
 * importante em cada passo (liberar motorista, creditar carteira, avisar
 * as partes).
 */

import { zcAdmin } from "../db/client";
import { ZcError, zcError, fromPostgresError } from "../errors";
import { ZC_RIDE_ACTIVE_WITH_DRIVER, type ZcCancelActor, type ZcRideStatus } from "../domain/enums";
import { actorCanTransition, canTransition, describeTransitionError } from "../domain/ride-status";
import { computeCancellationFee } from "../domain/pricing";
import type { Json, ZcRideRow, ZcRideStopRow } from "../db/types";
import type { ZcCaller } from "../http/auth";
import { primaryRole } from "../http/auth";
import type { CreateRideInput } from "../validation";
import { consumeQuote, markQuoteConsumed, priceRide } from "./pricing.service";
import { getNumberSetting } from "./settings.service";
import { recordAudit } from "./audit.service";
import { notify } from "./notifications.service";
import { creditRideEarnings, reverseRideEarnings } from "./wallet.service";
import { cancelPendingOffers, startDriverSearch } from "./dispatch.service";
import { sendSystemMessage } from "./messages.service";

export interface RideWithStops extends ZcRideRow {
  stops: ZcRideStopRow[];
}

/** Garante que o cliente tem ficha de cliente (cria na primeira corrida). */
export async function ensureCustomer(profileId: string): Promise<string> {
  const db = zcAdmin();
  const { data: existing } = await db
    .from("zc_customers")
    .select("id")
    .eq("profile_id", profileId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await db
    .from("zc_customers")
    .insert({ profile_id: profileId })
    .select("id")
    .single();
  if (error) throw fromPostgresError(error);
  return data.id;
}

/**
 * Cria a solicitação de carreto (nasce como rascunho).
 * O preço é congelado aqui: o que o cliente viu é o que vai pagar.
 */
export async function createRide(caller: ZcCaller, input: CreateRideInput): Promise<RideWithStops> {
  if (!caller.profileId) throw zcError.unauthenticated();
  const db = zcAdmin();
  const customerId = await ensureCustomer(caller.profileId);

  // Repetiu o mesmo pedido (botão apertado duas vezes)? Devolve o mesmo.
  if (input.idempotency_key) {
    const { data: existing } = await db
      .from("zc_rides")
      .select("*")
      .eq("customer_profile_id", caller.profileId)
      .eq("idempotency_key", input.idempotency_key)
      .maybeSingle();
    if (existing) return withStops(existing);
  }

  await assertScheduleWindow(input);
  await assertStopsLimit(input.stops.length);

  interface PricedForRide {
    regionId: string | null;
    tariffId: string | null;
    snapshot: Json;
    lines: unknown;
    addons: Json;
    distanceMeters: number;
    durationSeconds: number;
    subtotalCents: number;
    surchargeCents: number;
    tollCents: number;
    serviceFeeCents: number;
    totalCents: number;
    platformFeeCents: number;
    driverNetCents: number;
    currency: string;
  }

  let priced: PricedForRide;
  let quoteId: string | null = null;

  if (input.quote_id) {
    // Orçamento na mão: o preço é O DO ORÇAMENTO, ponto. Nada é
    // recalculado — nem se a tabela de preços mudou no meio do caminho.
    // É o cupom impresso no caixa: enquanto vale, vale aquele valor.
    const quote = await consumeQuote(input.quote_id, caller.profileId);
    quoteId = quote.id;
    priced = {
      regionId: quote.region_id,
      tariffId: quote.tariff_id,
      snapshot: quote.tariff_snapshot,
      lines: (quote.breakdown as { lines?: unknown[] })?.lines ?? [],
      addons: quote.addons,
      distanceMeters: quote.distance_meters,
      durationSeconds: quote.duration_seconds,
      subtotalCents: quote.subtotal_cents,
      surchargeCents: quote.surcharge_cents,
      tollCents: quote.toll_cents,
      serviceFeeCents: quote.service_fee_cents,
      totalCents: quote.total_cents,
      platformFeeCents: quote.platform_fee_cents,
      driverNetCents: quote.driver_net_cents,
      currency: quote.currency,
    };
  } else {
    const fresh = await priceRide(input);
    priced = {
      regionId: fresh.regionId,
      tariffId: fresh.tariff.id,
      snapshot: fresh.snapshot as unknown as Json,
      lines: fresh.quote.lines,
      addons: fresh.quote.addons as unknown as Json,
      distanceMeters: fresh.distanceMeters,
      durationSeconds: fresh.durationSeconds,
      subtotalCents: fresh.quote.subtotalCents,
      surchargeCents: fresh.quote.surchargeCents,
      tollCents: fresh.quote.tollCents,
      serviceFeeCents: fresh.quote.serviceFeeCents,
      totalCents: fresh.quote.totalCents,
      platformFeeCents: fresh.quote.platformFeeCents,
      driverNetCents: fresh.quote.driverNetCents,
      currency: fresh.quote.currency,
    };
  }

  const { data: ride, error } = await db
    .from("zc_rides")
    .insert({
      customer_id: customerId,
      customer_profile_id: caller.profileId,
      region_id: priced.regionId,
      category_id: input.category_id,
      tariff_id: priced.tariffId,
      quote_id: quoteId,
      modality: input.modality,
      scheduled_for: input.scheduled_for ?? null,
      cargo_description: input.cargo_description ?? null,
      cargo_photos: (input.cargo_photos ?? []) as unknown as Json,
      helpers_count: input.helpers_count ?? 0,
      notes: input.notes ?? null,
      distance_meters: priced.distanceMeters,
      duration_seconds: priced.durationSeconds,
      price_breakdown: { lines: priced.lines } as unknown as Json,
      tariff_snapshot: priced.snapshot,
      addons: priced.addons,
      items: (input.items ?? []) as unknown as Json,
      items_description: input.items_description ?? null,
      toll_cents: priced.tollCents,
      service_fee_cents: priced.serviceFeeCents,
      subtotal_cents: priced.subtotalCents,
      surcharge_cents: priced.surchargeCents,
      total_cents: priced.totalCents,
      platform_fee_cents: priced.platformFeeCents,
      driver_earnings_cents: priced.driverNetCents,
      currency: priced.currency,
      requested_at: new Date().toISOString(),
      idempotency_key: input.idempotency_key ?? null,
    })
    .select()
    .single();
  if (error) throw fromPostgresError(error);

  const stopsPayload = input.stops.map((stop, index) => ({
    ride_id: ride.id,
    sequence: index,
    kind: stop.kind,
    street: stop.street,
    number: stop.number ?? null,
    complement: stop.complement ?? null,
    district: stop.district ?? null,
    city: stop.city,
    state: stop.state,
    postal_code: stop.postal_code ?? null,
    country: stop.country ?? "BR",
    lat: stop.lat ?? null,
    lng: stop.lng ?? null,
    reference: stop.reference ?? null,
    contact_name: stop.contact_name ?? null,
    contact_phone: stop.contact_phone ?? null,
    instructions: stop.instructions ?? null,
    floor_number: stop.floor_number ?? null,
    has_elevator: stop.has_elevator ?? null,
  }));

  const { error: stopsError } = await db.from("zc_ride_stops").insert(stopsPayload);
  if (stopsError) {
    // Corrida sem paradas não serve para nada: desfaz para não deixar lixo.
    await db.from("zc_rides").delete().eq("id", ride.id);
    throw fromPostgresError(stopsError);
  }

  if (quoteId) await markQuoteConsumed(quoteId);

  await recordAudit({
    caller,
    action: "ride.create",
    entityTable: "zc_rides",
    entityId: ride.id,
    after: ride,
  });

  return withStops(ride);
}

async function withStops(ride: ZcRideRow): Promise<RideWithStops> {
  const { data } = await zcAdmin()
    .from("zc_ride_stops")
    .select("*")
    .eq("ride_id", ride.id)
    .order("sequence");
  return { ...ride, stops: data ?? [] };
}

export async function getRide(caller: ZcCaller, rideId: string): Promise<RideWithStops> {
  const { data, error } = await zcAdmin()
    .from("zc_rides")
    .select("*")
    .eq("id", rideId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) throw zcError.notFound("Carreto não encontrado.");
  assertCanSeeRide(caller, data);
  return withStops(data);
}

export function assertCanSeeRide(caller: ZcCaller, ride: ZcRideRow) {
  if (caller.isAdmin) return;
  if (ride.customer_profile_id === caller.profileId) return;
  if (caller.driverId && ride.driver_id === caller.driverId) return;
  throw zcError.forbidden("Este carreto não é seu.");
}

export async function listRides(
  caller: ZcCaller,
  params: {
    status?: ZcRideStatus;
    limit?: number;
    offset?: number;
    scope?: "client" | "driver";
  } = {},
) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  let query = zcAdmin()
    .from("zc_rides")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const scope = params.scope ?? (caller.driverId && !caller.isClient ? "driver" : "client");
  if (!caller.isAdmin) {
    if (scope === "driver") {
      if (!caller.driverId) throw zcError.forbidden("Você não tem cadastro de motorista.");
      query = query.eq("driver_id", caller.driverId);
    } else {
      query = query.eq("customer_profile_id", caller.profileId);
    }
  }
  if (params.status) query = query.eq("status", params.status);

  const { data, error } = await query;
  if (error) throw fromPostgresError(error);
  return data ?? [];
}

/**
 * Muda a etapa da corrida.
 * Confere três coisas, nesta ordem: a etapa existe na esteira, o perfil
 * pode empurrar, e a regra específica da etapa (ex.: só o motorista da
 * corrida marca "cheguei").
 */
export async function transitionRide(
  caller: ZcCaller,
  rideId: string,
  to: ZcRideStatus,
  reason?: string,
): Promise<RideWithStops> {
  const db = zcAdmin();
  const { data: ride, error } = await db
    .from("zc_rides")
    .select("*")
    .eq("id", rideId)
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!ride) throw zcError.notFound("Carreto não encontrado.");

  assertCanSeeRide(caller, ride);
  const actor = primaryRole(caller);

  if (!canTransition(ride.status, to)) {
    throw new ZcError("ZC_INVALID_TRANSITION", describeTransitionError(ride.status, to));
  }
  if (!actorCanTransition(actor, ride.status, to)) {
    throw zcError.forbidden(describeTransitionError(ride.status, to));
  }
  // Etapas de execução só o motorista designado pode marcar.
  const driverStages: ZcRideStatus[] = [
    "driver_to_pickup",
    "driver_arrived",
    "loading",
    "in_transit",
    "unloading",
    "completed",
  ];
  if (driverStages.includes(to) && !caller.isAdmin) {
    if (!caller.driverId || ride.driver_id !== caller.driverId) {
      throw zcError.forbidden("Só o motorista deste carreto pode marcar esta etapa.");
    }
  }

  const updated = await applyStatus(db, ride, to, { reason });

  if (to === "completed") await finalizeRide(updated);
  if (to === "searching_driver" && ride.status !== "awaiting_payment") {
    // Motorista soltou a corrida: volta para a fila de busca.
    await cancelPendingOffers(rideId);
    await startDriverSearch(updated.id);
  }

  await recordAudit({
    caller,
    action: `ride.status.${to}`,
    entityTable: "zc_rides",
    entityId: rideId,
    before: { status: ride.status },
    after: { status: to },
  });

  await notifyRideParties(updated, to);
  return withStops(updated);
}

async function applyStatus(
  db: ReturnType<typeof zcAdmin>,
  ride: ZcRideRow,
  to: ZcRideStatus,
  extra: { reason?: string; cancelledBy?: ZcCancelActor; cancellationFeeCents?: number } = {},
): Promise<ZcRideRow> {
  const patch: Partial<ZcRideRow> = { status: to };
  if (to === "cancelled") {
    patch.cancelled_by = extra.cancelledBy ?? "system";
    patch.cancellation_reason = extra.reason ?? null;
    patch.cancelled_at = new Date().toISOString();
    if (extra.cancellationFeeCents !== undefined) {
      patch.cancellation_fee_cents = extra.cancellationFeeCents;
    }
  }
  const { data, error } = await db
    .from("zc_rides")
    .update(patch)
    .eq("id", ride.id)
    .eq("status", ride.status) // trava contra duas mudanças ao mesmo tempo
    .select()
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) {
    throw zcError.conflict("O carreto mudou de etapa enquanto você respondia. Atualize a tela.");
  }
  return data;
}

/** Pagamento aprovado: a corrida sai da espera e vai procurar motorista. */
export async function markRidePaid(rideId: string): Promise<ZcRideRow> {
  const db = zcAdmin();
  const { data: ride } = await db.from("zc_rides").select("*").eq("id", rideId).maybeSingle();
  if (!ride) throw zcError.notFound("Carreto não encontrado.");
  if (ride.status === "searching_driver") return ride;
  if (ride.status !== "awaiting_payment") {
    throw zcError.conflict("Este carreto não está aguardando pagamento.");
  }

  await db.from("zc_rides").update({ paid_at: new Date().toISOString() }).eq("id", rideId);
  const updated = await applyStatus(db, ride, "searching_driver");
  await startDriverSearch(rideId);
  await notifyRideParties(updated, "searching_driver");
  return updated;
}

/** Coloca a corrida em "aguardando pagamento" (o cliente confirmou). */
export async function confirmRide(caller: ZcCaller, rideId: string): Promise<RideWithStops> {
  return transitionRide(caller, rideId, "awaiting_payment");
}

export async function cancelRide(
  caller: ZcCaller,
  rideId: string,
  reason: string,
  by?: ZcCancelActor,
): Promise<RideWithStops> {
  const db = zcAdmin();
  const { data: ride } = await db.from("zc_rides").select("*").eq("id", rideId).maybeSingle();
  if (!ride) throw zcError.notFound("Carreto não encontrado.");
  assertCanSeeRide(caller, ride);

  if (!canTransition(ride.status, "cancelled")) {
    throw zcError.conflict("Este carreto não pode mais ser cancelado.");
  }

  const actor: ZcCancelActor =
    by ??
    (caller.isAdmin
      ? "admin"
      : caller.driverId && ride.driver_id === caller.driverId
        ? "driver"
        : "client");

  let feeCents = 0;
  if (ride.tariff_id) {
    const { data: tariff } = await db
      .from("zc_tariffs")
      .select("*")
      .eq("id", ride.tariff_id)
      .maybeSingle();
    if (tariff) {
      feeCents = computeCancellationFee({
        tariff,
        by: actor,
        status: ride.status,
        secondsSinceAssigned: ride.assigned_at
          ? Math.floor((Date.now() - new Date(ride.assigned_at).getTime()) / 1000)
          : null,
      });
    }
  }

  const updated = await applyStatus(db, ride, "cancelled", {
    reason,
    cancelledBy: actor,
    cancellationFeeCents: feeCents,
  });

  await cancelPendingOffers(rideId);
  if (ride.driver_id) {
    await db.from("zc_drivers").update({ availability: "online" }).eq("id", ride.driver_id);
    await reverseRideEarnings(rideId).catch((error) =>
      console.error("[ZC] falha ao estornar ganhos do carreto cancelado:", error),
    );
  }

  await recordAudit({
    caller,
    action: "ride.cancel",
    entityTable: "zc_rides",
    entityId: rideId,
    before: { status: ride.status },
    after: { status: "cancelled", by: actor, fee_cents: feeCents },
  });

  await notifyRideParties(updated, "cancelled");
  return withStops(updated);
}

/** Fecho da corrida: libera o motorista e credita a carteira dele. */
async function finalizeRide(ride: ZcRideRow): Promise<void> {
  const db = zcAdmin();
  if (ride.driver_id) {
    await db.from("zc_drivers").update({ availability: "online" }).eq("id", ride.driver_id);
    const { data: driver } = await db
      .from("zc_drivers")
      .select("rides_count")
      .eq("id", ride.driver_id)
      .maybeSingle();
    if (driver) {
      await db
        .from("zc_drivers")
        .update({ rides_count: (driver.rides_count ?? 0) + 1 })
        .eq("id", ride.driver_id);
    }
    await creditRideEarnings(ride).catch((error) =>
      console.error("[ZC] falha ao creditar carteira:", error),
    );
  }
  const { data: customer } = await db
    .from("zc_customers")
    .select("rides_count")
    .eq("id", ride.customer_id)
    .maybeSingle();
  if (customer) {
    await db
      .from("zc_customers")
      .update({ rides_count: (customer.rides_count ?? 0) + 1 })
      .eq("id", ride.customer_id);
  }
}

const STATUS_MESSAGES: Partial<Record<ZcRideStatus, { title: string; body: string }>> = {
  searching_driver: {
    title: "Procurando motorista",
    body: "Já estamos chamando os carreteiros perto de você.",
  },
  driver_assigned: { title: "Motorista encontrado!", body: "Um carreteiro aceitou o seu carreto." },
  driver_arrived: { title: "O motorista chegou", body: "O carreteiro está no local da retirada." },
  in_transit: { title: "Carga a caminho", body: "Sua carga saiu para a entrega." },
  completed: { title: "Carreto concluído", body: "Que tal avaliar o carreteiro?" },
  cancelled: { title: "Carreto cancelado", body: "Este carreto foi cancelado." },
};

const CHAT_UPDATES: Partial<Record<ZcRideStatus, string>> = {
  driver_assigned: "Carreteiro a caminho! Você já pode conversar por aqui.",
  driver_arrived: "O carreteiro chegou ao local de retirada.",
  loading: "Carregando o veículo.",
  in_transit: "A carga saiu para a entrega.",
  unloading: "Chegamos ao destino, descarregando.",
  completed: "Carreto concluído. Obrigado!",
};

async function notifyRideParties(ride: ZcRideRow, status: ZcRideStatus): Promise<void> {
  const chatUpdate = CHAT_UPDATES[status];
  if (chatUpdate) {
    await sendSystemMessage(ride.id, chatUpdate).catch(() => undefined);
  }

  const message = STATUS_MESSAGES[status];
  if (!message) return;
  await notify({
    profileId: ride.customer_profile_id,
    rideId: ride.id,
    type: `ride.${status}`,
    title: message.title,
    body: message.body,
    dedupeKey: `${ride.id}:${status}:client`,
  }).catch((error) => console.error("[ZC] notificação falhou:", error));

  if (ride.driver_id && (status === "cancelled" || status === "completed")) {
    const { data: driver } = await zcAdmin()
      .from("zc_drivers")
      .select("profile_id")
      .eq("id", ride.driver_id)
      .maybeSingle();
    if (driver) {
      await notify({
        profileId: driver.profile_id,
        rideId: ride.id,
        type: `ride.${status}`,
        title: message.title,
        body: message.body,
        dedupeKey: `${ride.id}:${status}:driver`,
      }).catch((error) => console.error("[ZC] notificação falhou:", error));
    }
  }
}

/**
 * Confere a janela de agendamento.
 * Agendar para daqui a dez minutos não dá tempo de achar motorista; e
 * agendar para daqui a um ano não faz sentido — o preço de hoje não vale
 * para o ano que vem.
 */
async function assertScheduleWindow(input: { modality: string; scheduled_for?: string }) {
  if (input.modality !== "scheduled") return;
  if (!input.scheduled_for) {
    throw zcError.validation("Carreto agendado precisa de data e hora.");
  }

  const [minLeadMinutes, maxLeadDays] = await Promise.all([
    getNumberSetting("order.min_lead_minutes"),
    getNumberSetting("order.max_lead_days"),
  ]);

  const scheduled = new Date(input.scheduled_for).getTime();
  const now = Date.now();

  if (scheduled < now + minLeadMinutes * 60_000) {
    throw zcError.validation(
      `Agende com pelo menos ${minLeadMinutes} minutos de antecedência. Para agora, escolha "imediato".`,
    );
  }
  if (scheduled > now + maxLeadDays * 86_400_000) {
    throw zcError.validation(`Só dá para agendar com até ${maxLeadDays} dias de antecedência.`);
  }
}

async function assertStopsLimit(stopsCount: number) {
  const maxStops = await getNumberSetting("order.max_stops");
  if (stopsCount > maxStops) {
    throw zcError.validation(`Um carreto pode ter no máximo ${maxStops} paradas.`);
  }
}

/**
 * Link de acompanhamento para compartilhar.
 *
 * Quem recebe o link vê o carreto andando no mapa, mas não vê telefone,
 * nem valor, nem o resto da conta do cliente. É como mandar a localização
 * ao vivo no WhatsApp: a pessoa acompanha, não entra na sua casa.
 *
 * O link vence sozinho depois de algumas horas.
 */
export async function createShareLink(
  caller: ZcCaller,
  rideId: string,
): Promise<{ token: string; expiresAt: string; url: string }> {
  const db = zcAdmin();
  const { data: ride } = await db.from("zc_rides").select("*").eq("id", rideId).maybeSingle();
  if (!ride) throw zcError.notFound("Carreto não encontrado.");
  assertCanSeeRide(caller, ride);

  const ttlHours = await getNumberSetting("share.tracking_ttl_hours");
  const expiresAt = new Date(Date.now() + ttlHours * 3_600_000).toISOString();

  // Reaproveita o link enquanto ele ainda vale — mandar dois links para a
  // mesma pessoa só confunde.
  if (ride.share_token && ride.share_expires_at && new Date(ride.share_expires_at) > new Date()) {
    return {
      token: ride.share_token,
      expiresAt: ride.share_expires_at,
      url: `/zecarreto/acompanhar/${ride.share_token}`,
    };
  }

  const token = generateShareToken();
  const { error } = await db
    .from("zc_rides")
    .update({ share_token: token, share_expires_at: expiresAt })
    .eq("id", rideId);
  if (error) throw fromPostgresError(error);

  await recordAudit({
    caller,
    action: "ride.share_link",
    entityTable: "zc_rides",
    entityId: rideId,
    after: { expires_at: expiresAt },
  });

  return { token, expiresAt, url: `/zecarreto/acompanhar/${token}` };
}

export async function revokeShareLink(caller: ZcCaller, rideId: string): Promise<void> {
  const db = zcAdmin();
  const { data: ride } = await db.from("zc_rides").select("*").eq("id", rideId).maybeSingle();
  if (!ride) throw zcError.notFound("Carreto não encontrado.");
  assertCanSeeRide(caller, ride);

  await db.from("zc_rides").update({ share_token: null, share_expires_at: null }).eq("id", rideId);
  await recordAudit({
    caller,
    action: "ride.share_revoke",
    entityTable: "zc_rides",
    entityId: rideId,
  });
}

/** Encontra a corrida pelo link compartilhado, se ele ainda vale. */
export async function findRideByShareToken(token: string): Promise<ZcRideRow> {
  const { data, error } = await zcAdmin()
    .from("zc_rides")
    .select("*")
    .eq("share_token", token)
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) throw zcError.notFound("Este link de acompanhamento não existe mais.");
  if (data.share_expires_at && new Date(data.share_expires_at) < new Date()) {
    throw zcError.notFound("Este link de acompanhamento venceu.");
  }
  return data;
}

function generateShareToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

/** A corrida que o carreteiro está tocando agora. */
export async function getDriverCurrentRide(driverId: string): Promise<RideWithStops | null> {
  const { data, error } = await zcAdmin()
    .from("zc_rides")
    .select("*")
    .eq("driver_id", driverId)
    .in("status", [...ZC_RIDE_ACTIVE_WITH_DRIVER])
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) return null;
  return withStops(data);
}

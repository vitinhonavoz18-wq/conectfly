/**
 * Preço do carreto, do jeito que o cliente vê.
 *
 * Junta três coisas: a rota (quantos km e minutos), a tarifa cadastrada e
 * a modalidade (agendado ou imediato). O cálculo em si mora em
 * `domain/pricing.ts`, que não conhece banco nenhum — por isso dá para
 * testá-lo sozinho, com números na mão.
 */

import { zcAdmin } from "../db/client";
import { zcError, ZcError } from "../errors";
import { computeQuote, type QuoteResult, type TariffLike } from "../domain/pricing";
import { straightLineRouteProvider, type LatLng, type RouteProvider } from "../domain/geo";
import type { ZcQuoteRow, Json } from "../db/types";
import type { QuoteRequestInput } from "../validation";
import { getRegion, resolveTariff } from "./catalog.service";
import { getNumberSetting } from "./settings.service";

let routeProvider: RouteProvider = straightLineRouteProvider;

/** Troca o cálculo de rota (ex.: entrar um serviço de mapas na FASE 2). */
export function setRouteProvider(provider: RouteProvider) {
  routeProvider = provider;
}

export interface PricedQuote extends QuoteResult {
  quoteId: string;
  tariffId: string;
  regionId: string | null;
  categoryId: string;
  expiresAt: string;
  scheduledFor: string | null;
}

/** Calcula o preço SEM gravar nada — usado para simulação. */
export async function priceRide(input: QuoteRequestInput): Promise<{
  quote: QuoteResult;
  tariff: TariffLike & { id: string };
  regionId: string | null;
  distanceMeters: number;
  durationSeconds: number;
  timezone: string;
  demandMultiplier: number;
}> {
  const region = await getRegion(input.region_id ?? null);
  const tariff = await resolveTariff(input.category_id, region?.id ?? null);

  let distanceMeters = input.distance_meters;
  let durationSeconds = input.duration_seconds;

  if (distanceMeters === undefined || durationSeconds === undefined) {
    const points: LatLng[] = input.stops
      .filter((stop) => typeof stop.lat === "number" && typeof stop.lng === "number")
      .map((stop) => ({ lat: stop.lat as number, lng: stop.lng as number }));
    if (points.length < 2) {
      throw zcError.validation(
        "Precisamos das coordenadas da retirada e da entrega para calcular o preço.",
      );
    }
    const route = await routeProvider.estimate(points);
    distanceMeters = distanceMeters ?? route.distanceMeters;
    durationSeconds = durationSeconds ?? route.durationSeconds;
  }

  const roundingCents = await getNumberSetting("pricing.rounding_cents");
  const referenceDate = input.scheduled_for ? new Date(input.scheduled_for) : new Date();

  const quote = computeQuote({
    tariff,
    distanceMeters,
    durationSeconds,
    stopsCount: input.stops.length,
    helpersCount: input.helpers_count ?? 0,
    modality: input.modality,
    demandMultiplier: region?.demand_multiplier ?? 1,
    referenceDate,
    timezone: region?.timezone,
    roundingCents,
  });

  return {
    quote,
    tariff,
    regionId: region?.id ?? null,
    distanceMeters,
    durationSeconds,
    timezone: region?.timezone ?? "America/Sao_Paulo",
    demandMultiplier: region?.demand_multiplier ?? 1,
  };
}

/** Calcula e GRAVA o orçamento, congelando o preço por alguns minutos. */
export async function createQuote(
  input: QuoteRequestInput,
  profileId: string | null,
): Promise<PricedQuote> {
  const priced = await priceRide(input);
  const ttlSeconds = await getNumberSetting("pricing.quote_ttl_seconds");
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const { data, error } = await zcAdmin()
    .from("zc_quotes")
    .insert({
      profile_id: profileId,
      region_id: priced.regionId,
      category_id: input.category_id,
      tariff_id: priced.tariff.id,
      modality: input.modality,
      scheduled_for: input.scheduled_for ?? null,
      distance_meters: priced.distanceMeters,
      duration_seconds: priced.durationSeconds,
      stops_count: input.stops.length,
      helpers_count: input.helpers_count ?? 0,
      breakdown: { lines: priced.quote.lines } as unknown as Json,
      subtotal_cents: priced.quote.subtotalCents,
      surcharge_cents: priced.quote.surchargeCents,
      total_cents: priced.quote.totalCents,
      platform_fee_cents: priced.quote.platformFeeCents,
      driver_net_cents: priced.quote.driverNetCents,
      currency: priced.quote.currency,
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (error) throw error;

  return {
    ...priced.quote,
    quoteId: data.id,
    tariffId: priced.tariff.id,
    regionId: priced.regionId,
    categoryId: input.category_id,
    expiresAt,
    scheduledFor: input.scheduled_for ?? null,
  };
}

/** Recupera um orçamento ainda válido (não vencido, não usado). */
export async function consumeQuote(quoteId: string, profileId: string): Promise<ZcQuoteRow> {
  const { data, error } = await zcAdmin()
    .from("zc_quotes")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw zcError.notFound("Orçamento não encontrado.");
  if (data.profile_id && data.profile_id !== profileId) {
    throw zcError.forbidden("Este orçamento é de outra pessoa.");
  }
  if (data.consumed_at) {
    throw new ZcError("ZC_QUOTE_EXPIRED", "Este orçamento já virou um carreto.");
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new ZcError(
      "ZC_QUOTE_EXPIRED",
      "O preço estimado venceu. Peça uma nova estimativa para continuar.",
    );
  }
  return data;
}

export async function markQuoteConsumed(quoteId: string): Promise<void> {
  await zcAdmin()
    .from("zc_quotes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", quoteId);
}

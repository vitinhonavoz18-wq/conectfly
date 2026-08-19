/**
 * Preço do carreto, do jeito que o cliente vê.
 *
 * Junta quatro coisas: a rota (quantos km e minutos), a tarifa cadastrada,
 * os adicionais escolhidos e a modalidade (agendado ou imediato).
 *
 * REGRA DE OURO: nenhum valor vindo da tela é usado no cálculo. O
 * aplicativo diz "quero escada e 2 ajudantes"; quanto isso custa quem
 * decide é o cadastro. É o porteiro conferindo a lista, e não aceitando
 * quem diz "pode deixar, eu sou convidado".
 */

import { zcAdmin } from "../db/client";
import { zcError, ZcError } from "../errors";
import {
  computeQuote,
  type AddonDefinition,
  type AddonSelection,
  type QuoteResult,
  type TariffLike,
} from "../domain/pricing";
import { recommendCategory, type Recommendation } from "../domain/recommendation";
import { straightLineRouteProvider, type LatLng, type RouteProvider } from "../domain/geo";
import type { Json, ZcQuoteRow, ZcTariffRow } from "../db/types";
import type { QuoteRequestInput } from "../validation";
import {
  getRegion,
  listAddons,
  listItemPresets,
  listVehicleCategories,
  resolveTariff,
} from "./catalog.service";
import { getNumberSetting } from "./settings.service";

let routeProvider: RouteProvider = straightLineRouteProvider;

/** Troca o cálculo de rota (ex.: entrar um serviço de mapas de verdade). */
export function setRouteProvider(provider: RouteProvider) {
  routeProvider = provider;
}

export function getRouteProvider(): RouteProvider {
  return routeProvider;
}

/**
 * A fotografia da tarifa e dos adicionais usados no orçamento.
 * Guardada junto do pedido para que mudar a tabela de preços amanhã não
 * mude o valor de um carreto fechado ontem.
 */
export interface TariffSnapshot {
  taken_at: string;
  tariff: ZcTariffRow | TariffLike;
  addons: AddonDefinition[];
  region: { id: string | null; timezone: string; demand_multiplier: number } | null;
  route_provider: string;
  rounding_cents: number;
}

export interface PricedQuote extends QuoteResult {
  quoteId: string;
  tariffId: string;
  regionId: string | null;
  categoryId: string;
  expiresAt: string;
  scheduledFor: string | null;
  snapshot: TariffSnapshot;
}

function toAddonDefinition(row: {
  id: string;
  code: string;
  name: string;
  pricing_mode: AddonDefinition["pricing_mode"];
  amount_cents: number;
  percent: number;
  max_quantity: number;
  requires_quantity: boolean;
}): AddonDefinition {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    pricing_mode: row.pricing_mode,
    amount_cents: row.amount_cents,
    percent: Number(row.percent),
    max_quantity: row.max_quantity,
    requires_quantity: row.requires_quantity,
  };
}

export interface PriceRideResult {
  quote: QuoteResult;
  tariff: ZcTariffRow;
  regionId: string | null;
  distanceMeters: number;
  durationSeconds: number;
  timezone: string;
  demandMultiplier: number;
  snapshot: TariffSnapshot;
}

/** Calcula o preço SEM gravar nada — usado para simular na tela. */
export async function priceRide(input: QuoteRequestInput): Promise<PriceRideResult> {
  const region = await getRegion(input.region_id ?? null);
  const tariff = await resolveTariff(input.category_id, region?.id ?? null);
  const addonRows = await listAddons({
    categoryId: input.category_id,
    regionId: region?.id ?? null,
  });
  const addonDefinitions = addonRows.map(toAddonDefinition);

  let distanceMeters = input.distance_meters;
  let durationSeconds = input.duration_seconds;
  let routeTollCents: number | undefined;

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
    routeTollCents = route.tollCents;
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
    addons: (input.addons ?? []) as AddonSelection[],
    addonDefinitions,
    routeTollCents,
    demandMultiplier: region?.demand_multiplier ?? 1,
    referenceDate,
    timezone: region?.timezone,
    roundingCents,
  });

  const snapshot: TariffSnapshot = {
    taken_at: new Date().toISOString(),
    tariff,
    addons: addonDefinitions,
    region: region
      ? {
          id: region.id,
          timezone: region.timezone,
          demand_multiplier: Number(region.demand_multiplier),
        }
      : null,
    route_provider: routeProvider.name,
    rounding_cents: roundingCents,
  };

  return {
    quote,
    tariff,
    regionId: region?.id ?? null,
    distanceMeters,
    durationSeconds,
    timezone: region?.timezone ?? "America/Sao_Paulo",
    demandMultiplier: Number(region?.demand_multiplier ?? 1),
    snapshot,
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
      tariff_snapshot: priced.snapshot as unknown as Json,
      addons: priced.quote.addons as unknown as Json,
      items: (input.items ?? []) as unknown as Json,
      toll_cents: priced.quote.tollCents,
      service_fee_cents: priced.quote.serviceFeeCents,
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
    snapshot: priced.snapshot,
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

/**
 * Recalcula um orçamento a partir da FOTOGRAFIA guardada.
 * Serve para o suporte conferir uma conta antiga: mesmo que a tabela de
 * preços tenha mudado dez vezes, a conta sai igualzinha à do dia.
 */
export function recomputeFromSnapshot(
  snapshot: TariffSnapshot,
  input: {
    distanceMeters: number;
    durationSeconds: number;
    stopsCount: number;
    helpersCount: number;
    modality: QuoteRequestInput["modality"];
    addons?: AddonSelection[];
    referenceDate?: Date;
  },
): QuoteResult {
  return computeQuote({
    tariff: snapshot.tariff as TariffLike,
    distanceMeters: input.distanceMeters,
    durationSeconds: input.durationSeconds,
    stopsCount: input.stopsCount,
    helpersCount: input.helpersCount,
    modality: input.modality,
    addons: input.addons ?? [],
    addonDefinitions: snapshot.addons,
    demandMultiplier: snapshot.region?.demand_multiplier ?? 1,
    referenceDate: input.referenceDate ?? new Date(snapshot.taken_at),
    timezone: snapshot.region?.timezone,
    roundingCents: snapshot.rounding_cents,
  });
}

/** "Não sei qual escolher": sugere a categoria pelos itens marcados. */
export async function recommendCategoryForItems(
  selections: { code: string; quantity: number }[],
): Promise<Recommendation> {
  const [presets, categories, slack] = await Promise.all([
    listItemPresets(),
    listVehicleCategories(),
    getNumberSetting("pricing.packing_slack_pct"),
  ]);

  return recommendCategory({
    selections,
    presets: presets.map((preset) => ({
      code: preset.code,
      name: preset.name,
      volume_m3: Number(preset.volume_m3),
      weight_kg: Number(preset.weight_kg),
      is_heavy: preset.is_heavy,
      needs_two_people: preset.needs_two_people,
    })),
    categories: categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      max_weight_kg: category.max_weight_kg,
      max_volume_m3: category.max_volume_m3 === null ? null : Number(category.max_volume_m3),
      sort_order: category.sort_order,
    })),
    packingSlackPct: slack,
  });
}

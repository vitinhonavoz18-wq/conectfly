/**
 * Cálculo do preço do carreto.
 *
 * Nenhum valor está escrito aqui dentro: tudo vem da tarifa e dos
 * adicionais cadastrados no admin. Esta função só sabe SOMAR — quanto
 * custa cada coisa é decisão do dono da plataforma, e ele muda isso pela
 * tela, sem programador.
 *
 * A ordem da conta importa e é sempre esta:
 *   1. bandeirada + km excedente + tempo + paradas extras + ajudantes +
 *      adicionais de valor fixo;
 *   2. se der menos que a tarifa mínima, cobra a mínima (o piso);
 *   3. adicionais em percentual, calculados sobre o valor até aqui;
 *   4. acréscimos: imediato (+35%), noturno, fim de semana e demanda;
 *   5. pedágio — entra por fora, porque é repasse: não leva os 35% nem
 *      entra na comissão;
 *   6. taxa de serviço da plataforma;
 *   7. arredondamento final.
 */

import { clampPositive, pctOf, roundCents, roundToStep, type Cents } from "./money";
import type { ZcRideModality } from "./enums";

export interface TariffLike {
  id?: string;
  base_fare_cents: number;
  /** Quilômetros já inclusos na bandeirada. */
  included_km?: number;
  /** Valor de cada quilômetro EXCEDENTE. */
  price_per_km_cents: number;
  price_per_minute_cents: number;
  minimum_fare_cents: number;
  extra_stop_cents: number;
  helper_cents: number;
  waiting_per_minute_cents: number;
  free_waiting_minutes: number;
  immediate_surcharge_pct: number;
  night_surcharge_pct: number;
  night_start: string; // "22:00:00"
  night_end: string; // "06:00:00"
  weekend_surcharge_pct: number;
  platform_commission_pct: number;
  cancellation_fee_cents: number;
  cancellation_free_seconds: number;
  service_fee_cents?: number;
  service_fee_pct?: number;
  toll_policy?: "none" | "fixed" | "route";
  toll_fixed_cents?: number;
  toll_applies_above_km?: number;
  currency?: string;
}

export type AddonPricingMode = "fixed" | "per_unit" | "per_floor" | "percent";

export interface AddonDefinition {
  id?: string;
  code: string;
  name: string;
  pricing_mode: AddonPricingMode;
  amount_cents: number;
  percent: number;
  max_quantity: number;
  requires_quantity?: boolean;
}

/** O que o cliente marcou: o código do adicional e quantas unidades. */
export interface AddonSelection {
  code: string;
  quantity?: number;
}

export interface ComputedAddon {
  code: string;
  name: string;
  quantity: number;
  pricing_mode: AddonPricingMode;
  amountCents: Cents;
}

export interface QuoteInput {
  tariff: TariffLike;
  distanceMeters: number;
  durationSeconds: number;
  /** Total de paradas, contando retirada e entrega. Mínimo 2. */
  stopsCount: number;
  helpersCount: number;
  modality: ZcRideModality;
  /** Adicionais escolhidos pelo cliente. */
  addons?: AddonSelection[];
  /** Definições vindas do banco (preço e regra de cada adicional). */
  addonDefinitions?: AddonDefinition[];
  /** Pedágio informado pelo serviço de rotas, quando houver. */
  routeTollCents?: number;
  /** Multiplicador de demanda da região (1 = normal). */
  demandMultiplier?: number;
  /** Momento de referência: agora, ou a data do agendamento. */
  referenceDate?: Date;
  /** Fuso da região, para saber se é horário noturno. */
  timezone?: string;
  /** Arredondamento final, em centavos (0 = não arredonda). */
  roundingCents?: number;
}

export interface QuoteBreakdownLine {
  code: string;
  label: string;
  amountCents: Cents;
}

export interface QuoteResult {
  currency: string;
  distanceMeters: number;
  billableKm: number;
  durationSeconds: number;
  stopsCount: number;
  helpersCount: number;
  modality: ZcRideModality;
  subtotalCents: Cents;
  addonsCents: Cents;
  surchargeCents: Cents;
  tollCents: Cents;
  serviceFeeCents: Cents;
  /** Valor do serviço (sem pedágio e sem taxa) — é sobre ele que incide a comissão. */
  fareCents: Cents;
  totalCents: Cents;
  platformFeeCents: Cents;
  driverNetCents: Cents;
  minimumApplied: boolean;
  addons: ComputedAddon[];
  lines: QuoteBreakdownLine[];
}

/** Lê "22:00:00" e devolve minutos desde a meia-noite. */
function timeToMinutes(time: string): number {
  const [h = "0", m = "0"] = String(time).split(":");
  return Number(h) * 60 + Number(m);
}

/** Hora e dia da semana no fuso da região (não no fuso do servidor). */
export function localClock(date: Date, timezone = "America/Sao_Paulo") {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const weekday = get("weekday");
  return {
    minutesOfDay: hour * 60 + minute,
    weekday,
    isWeekend: weekday === "Sat" || weekday === "Sun",
  };
}

export function isNightTime(date: Date, tariff: TariffLike, timezone?: string): boolean {
  const { minutesOfDay } = localClock(date, timezone);
  const start = timeToMinutes(tariff.night_start);
  const end = timeToMinutes(tariff.night_end);
  // Janela que atravessa a meia-noite (ex.: 22h -> 6h).
  if (start > end) return minutesOfDay >= start || minutesOfDay < end;
  return minutesOfDay >= start && minutesOfDay < end;
}

/** Quilômetros que realmente entram na conta, depois da franquia. */
export function billableKilometers(distanceMeters: number, includedKm = 0): number {
  const km = distanceMeters / 1000;
  return Math.max(0, km - Math.max(0, includedKm));
}

/**
 * Calcula cada adicional escolhido.
 * Os de valor fixo entram direto na soma; os percentuais só podem ser
 * calculados depois que se sabe o subtotal — por isso vêm marcados.
 */
export function computeAddons(
  selections: AddonSelection[],
  definitions: AddonDefinition[],
): { fixed: ComputedAddon[]; percent: ComputedAddon[] } {
  const byCode = new Map(definitions.map((definition) => [definition.code, definition]));
  const fixed: ComputedAddon[] = [];
  const percent: ComputedAddon[] = [];

  for (const selection of selections) {
    const definition = byCode.get(selection.code);
    // Adicional que não está no catálogo é ignorado — o preço é sempre do
    // cadastro, nunca do que o aplicativo mandou.
    if (!definition) continue;

    const requested = Math.floor(selection.quantity ?? 1);
    if (requested <= 0) continue;
    const quantity = Math.min(requested, Math.max(1, definition.max_quantity));

    if (definition.pricing_mode === "percent") {
      percent.push({
        code: definition.code,
        name: definition.name,
        quantity: 1,
        pricing_mode: "percent",
        amountCents: 0, // preenchido depois, sobre o subtotal
      });
      continue;
    }

    const multiplier = definition.pricing_mode === "fixed" ? 1 : quantity;
    fixed.push({
      code: definition.code,
      name: definition.name,
      quantity: definition.pricing_mode === "fixed" ? 1 : quantity,
      pricing_mode: definition.pricing_mode,
      amountCents: definition.amount_cents * multiplier,
    });
  }

  return { fixed, percent };
}

/** Pedágio, conforme a política da tarifa. */
export function computeToll(
  tariff: TariffLike,
  distanceMeters: number,
  routeTollCents?: number,
): Cents {
  const policy = tariff.toll_policy ?? "none";
  if (policy === "none") return 0;
  if (policy === "route") return Math.max(0, Math.round(routeTollCents ?? 0));
  // "fixed": cobra o valor cadastrado quando a viagem passa da distância
  // combinada — é a praça de pedágio que só aparece em viagem mais longa.
  const km = distanceMeters / 1000;
  const threshold = tariff.toll_applies_above_km ?? 0;
  return km > threshold ? (tariff.toll_fixed_cents ?? 0) : 0;
}

export function computeQuote(input: QuoteInput): QuoteResult {
  const {
    tariff,
    distanceMeters,
    durationSeconds,
    stopsCount,
    helpersCount,
    modality,
    addons = [],
    addonDefinitions = [],
    routeTollCents,
    demandMultiplier = 1,
    referenceDate = new Date(),
    timezone,
    roundingCents = 0,
  } = input;

  if (distanceMeters < 0 || durationSeconds < 0) {
    throw new RangeError("Distância e duração não podem ser negativas.");
  }
  if (stopsCount < 2) {
    throw new RangeError("Um carreto precisa de pelo menos retirada e entrega.");
  }
  if (helpersCount < 0) {
    throw new RangeError("Número de ajudantes não pode ser negativo.");
  }

  const lines: QuoteBreakdownLine[] = [];
  const push = (code: string, label: string, amountCents: Cents) => {
    if (amountCents !== 0) lines.push({ code, label, amountCents });
  };

  // --- 1. soma do serviço ------------------------------------------------
  const includedKm = tariff.included_km ?? 0;
  const billableKm = billableKilometers(distanceMeters, includedKm);
  const baseCents = tariff.base_fare_cents;
  const distanceCents = roundCents(tariff.price_per_km_cents * billableKm);
  const timeCents = roundCents(tariff.price_per_minute_cents * (durationSeconds / 60));
  const extraStops = Math.max(0, stopsCount - 2);
  const stopsCents = extraStops * tariff.extra_stop_cents;
  const helpersCents = helpersCount * tariff.helper_cents;

  const { fixed: fixedAddons, percent: percentAddons } = computeAddons(addons, addonDefinitions);
  const fixedAddonsCents = fixedAddons.reduce((total, addon) => total + addon.amountCents, 0);

  push(
    "base",
    includedKm > 0 ? `Bandeirada (inclui ${includedKm.toFixed(0)} km)` : "Bandeirada",
    baseCents,
  );
  push("distance", `Distância excedente (${billableKm.toFixed(1)} km)`, distanceCents);
  push("time", `Tempo estimado (${Math.round(durationSeconds / 60)} min)`, timeCents);
  push("extra_stops", `Paradas extras (${extraStops})`, stopsCents);
  push("helpers", `Ajudantes (${helpersCount})`, helpersCents);
  for (const addon of fixedAddons) {
    push(
      `addon:${addon.code}`,
      addon.quantity > 1 ? `${addon.name} (${addon.quantity}x)` : addon.name,
      addon.amountCents,
    );
  }

  const rawSubtotal =
    baseCents + distanceCents + timeCents + stopsCents + helpersCents + fixedAddonsCents;

  // --- 2. piso da tarifa -------------------------------------------------
  const minimumApplied = rawSubtotal < tariff.minimum_fare_cents;
  const subtotalCents = minimumApplied ? tariff.minimum_fare_cents : rawSubtotal;
  if (minimumApplied) {
    push("minimum_fare", "Ajuste para a tarifa mínima", subtotalCents - rawSubtotal);
  }

  // --- 3. adicionais em percentual --------------------------------------
  const definitionsByCode = new Map(
    addonDefinitions.map((definition) => [definition.code, definition]),
  );
  let percentAddonsCents = 0;
  for (const addon of percentAddons) {
    const definition = definitionsByCode.get(addon.code);
    const amount = pctOf(subtotalCents, definition?.percent ?? 0);
    addon.amountCents = amount;
    percentAddonsCents += amount;
    push(`addon:${addon.code}`, `${addon.name} (${definition?.percent ?? 0}%)`, amount);
  }

  const serviceBaseCents = subtotalCents + percentAddonsCents;

  // --- 4. acréscimos -----------------------------------------------------
  const immediateCents =
    modality === "immediate" ? pctOf(serviceBaseCents, tariff.immediate_surcharge_pct) : 0;
  push("immediate", `Carreto imediato (+${tariff.immediate_surcharge_pct}%)`, immediateCents);

  const nightCents = isNightTime(referenceDate, tariff, timezone)
    ? pctOf(serviceBaseCents, tariff.night_surcharge_pct)
    : 0;
  push("night", `Horário noturno (+${tariff.night_surcharge_pct}%)`, nightCents);

  const weekendCents = localClock(referenceDate, timezone).isWeekend
    ? pctOf(serviceBaseCents, tariff.weekend_surcharge_pct)
    : 0;
  push("weekend", `Fim de semana (+${tariff.weekend_surcharge_pct}%)`, weekendCents);

  const demandCents =
    demandMultiplier > 1 ? pctOf(serviceBaseCents, (demandMultiplier - 1) * 100) : 0;
  push("demand", "Alta demanda na região", demandCents);

  const surchargeCents = immediateCents + nightCents + weekendCents + demandCents;
  const fareCents = serviceBaseCents + surchargeCents;

  // --- 5. pedágio (repasse, por fora) -----------------------------------
  const tollCents = computeToll(tariff, distanceMeters, routeTollCents);
  push("toll", "Pedágio estimado", tollCents);

  // --- 6. taxa de serviço da plataforma ---------------------------------
  const serviceFeeCents =
    (tariff.service_fee_cents ?? 0) + pctOf(fareCents, tariff.service_fee_pct ?? 0);
  push("service_fee", "Taxa de serviço", serviceFeeCents);

  // --- 7. total e divisão ------------------------------------------------
  const totalCents = clampPositive(
    roundToStep(fareCents + tollCents + serviceFeeCents, roundingCents),
  );

  // A comissão incide só sobre o serviço: pedágio é repasse integral ao
  // motorista, e a taxa de serviço já é da plataforma.
  const commissionCents = clampPositive(
    Math.min(pctOf(fareCents, tariff.platform_commission_pct), fareCents),
  );
  const platformFeeCents = clampPositive(Math.min(commissionCents + serviceFeeCents, totalCents));
  const driverNetCents = totalCents - platformFeeCents;

  return {
    currency: tariff.currency ?? "BRL",
    distanceMeters,
    billableKm: Number(billableKm.toFixed(3)),
    durationSeconds,
    stopsCount,
    helpersCount,
    modality,
    subtotalCents,
    addonsCents: fixedAddonsCents + percentAddonsCents,
    surchargeCents,
    tollCents,
    serviceFeeCents,
    fareCents,
    totalCents,
    platformFeeCents,
    driverNetCents,
    minimumApplied,
    addons: [...fixedAddons, ...percentAddons],
    lines,
  };
}

/** Espera além da cortesia (o motorista parado esperando o cliente). */
export function computeWaitingFee(tariff: TariffLike, waitedMinutes: number): Cents {
  const billable = Math.max(0, Math.floor(waitedMinutes) - tariff.free_waiting_minutes);
  return billable * tariff.waiting_per_minute_cents;
}

export interface CancellationInput {
  tariff: TariffLike;
  /** Quem está cancelando. */
  by: "client" | "driver" | "admin" | "system";
  /** Etapa em que a corrida estava. */
  status: string;
  /** Segundos desde que o motorista foi designado (null se ainda não havia). */
  secondsSinceAssigned: number | null;
}

/**
 * Taxa de cancelamento.
 * Cancelou antes de ter motorista, ou dentro da janela de cortesia: não
 * paga nada. Depois que o motorista já estava a caminho: paga.
 * Motorista, admin e sistema cancelando nunca cobram do cliente.
 */
export function computeCancellationFee(input: CancellationInput): Cents {
  const { tariff, by, status, secondsSinceAssigned } = input;
  if (by !== "client") return 0;
  if (secondsSinceAssigned === null) return 0;
  if (["draft", "awaiting_payment", "searching_driver"].includes(status)) return 0;
  if (secondsSinceAssigned <= tariff.cancellation_free_seconds) return 0;
  return tariff.cancellation_fee_cents;
}

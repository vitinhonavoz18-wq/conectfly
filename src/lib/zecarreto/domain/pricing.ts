/**
 * Cálculo do preço do carreto.
 *
 * Nenhum valor está escrito aqui dentro: tudo vem da tarifa cadastrada no
 * admin. Esta função só sabe SOMAR — quanto custa cada coisa é decisão do
 * dono da plataforma, e ele muda isso pela tela, sem programador.
 */

import {
  clampPositive,
  pctOf,
  roundCents,
  roundToStep,
  splitCommission,
  type Cents,
} from "./money";
import type { ZcRideModality } from "./enums";

export interface TariffLike {
  id?: string;
  base_fare_cents: number;
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
  currency?: string;
}

export interface QuoteInput {
  tariff: TariffLike;
  distanceMeters: number;
  durationSeconds: number;
  /** Total de paradas, contando retirada e entrega. Mínimo 2. */
  stopsCount: number;
  helpersCount: number;
  modality: ZcRideModality;
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
  durationSeconds: number;
  stopsCount: number;
  helpersCount: number;
  modality: ZcRideModality;
  subtotalCents: Cents;
  surchargeCents: Cents;
  totalCents: Cents;
  platformFeeCents: Cents;
  driverNetCents: Cents;
  minimumApplied: boolean;
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

/**
 * Monta o preço. A ordem importa:
 * 1) soma base + distância + tempo + paradas extras + ajudantes;
 * 2) aplica o piso (tarifa mínima);
 * 3) só então aplica os acréscimos percentuais — imediato (+35% por
 *    padrão), noturno, fim de semana e demanda.
 *
 * Ou seja: o "imediato" encarece a tarifa normal, exatamente como a regra
 * do produto pede.
 */
export function computeQuote(input: QuoteInput): QuoteResult {
  const {
    tariff,
    distanceMeters,
    durationSeconds,
    stopsCount,
    helpersCount,
    modality,
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

  const baseCents = tariff.base_fare_cents;
  const distanceCents = roundCents(tariff.price_per_km_cents * (distanceMeters / 1000));
  const timeCents = roundCents(tariff.price_per_minute_cents * (durationSeconds / 60));
  const extraStops = Math.max(0, stopsCount - 2);
  const stopsCents = extraStops * tariff.extra_stop_cents;
  const helpersCents = helpersCount * tariff.helper_cents;

  push("base", "Bandeirada", baseCents);
  push("distance", `Distância (${(distanceMeters / 1000).toFixed(1)} km)`, distanceCents);
  push("time", `Tempo estimado (${Math.round(durationSeconds / 60)} min)`, timeCents);
  push("extra_stops", `Paradas extras (${extraStops})`, stopsCents);
  push("helpers", `Ajudantes (${helpersCount})`, helpersCents);

  const rawSubtotal = baseCents + distanceCents + timeCents + stopsCents + helpersCents;
  const minimumApplied = rawSubtotal < tariff.minimum_fare_cents;
  const subtotalCents = minimumApplied ? tariff.minimum_fare_cents : rawSubtotal;
  if (minimumApplied) {
    push("minimum_fare", "Ajuste para a tarifa mínima", subtotalCents - rawSubtotal);
  }

  const immediateCents =
    modality === "immediate" ? pctOf(subtotalCents, tariff.immediate_surcharge_pct) : 0;
  push("immediate", `Carreto imediato (+${tariff.immediate_surcharge_pct}%)`, immediateCents);

  const nightCents = isNightTime(referenceDate, tariff, timezone)
    ? pctOf(subtotalCents, tariff.night_surcharge_pct)
    : 0;
  push("night", `Horário noturno (+${tariff.night_surcharge_pct}%)`, nightCents);

  const weekendCents = localClock(referenceDate, timezone).isWeekend
    ? pctOf(subtotalCents, tariff.weekend_surcharge_pct)
    : 0;
  push("weekend", `Fim de semana (+${tariff.weekend_surcharge_pct}%)`, weekendCents);

  const demandCents = demandMultiplier > 1 ? pctOf(subtotalCents, (demandMultiplier - 1) * 100) : 0;
  push("demand", "Alta demanda na região", demandCents);

  const surchargeCents = immediateCents + nightCents + weekendCents + demandCents;
  const totalCents = clampPositive(roundToStep(subtotalCents + surchargeCents, roundingCents));
  const { platformFeeCents, driverNetCents } = splitCommission(
    totalCents,
    tariff.platform_commission_pct,
  );

  return {
    currency: tariff.currency ?? "BRL",
    distanceMeters,
    durationSeconds,
    stopsCount,
    helpersCount,
    modality,
    subtotalCents,
    surchargeCents: totalCents - subtotalCents,
    totalCents,
    platformFeeCents,
    driverNetCents,
    minimumApplied,
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

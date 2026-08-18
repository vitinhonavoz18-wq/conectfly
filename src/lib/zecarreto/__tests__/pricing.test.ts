import { describe, expect, test } from "bun:test";
import {
  computeCancellationFee,
  computeQuote,
  computeWaitingFee,
  isNightTime,
  type TariffLike,
} from "../domain/pricing";

/** Tarifa de referência: bandeirada R$ 35, R$ 3,20/km, R$ 0,60/min. */
const tariff: TariffLike = {
  base_fare_cents: 3_500,
  price_per_km_cents: 320,
  price_per_minute_cents: 60,
  minimum_fare_cents: 5_000,
  extra_stop_cents: 1_200,
  helper_cents: 4_500,
  waiting_per_minute_cents: 100,
  free_waiting_minutes: 15,
  immediate_surcharge_pct: 35,
  night_surcharge_pct: 0,
  night_start: "22:00:00",
  night_end: "06:00:00",
  weekend_surcharge_pct: 0,
  platform_commission_pct: 20,
  cancellation_fee_cents: 1_500,
  cancellation_free_seconds: 300,
  currency: "BRL",
};

/** Uma terça-feira de tarde, para não pegar noturno nem fim de semana. */
const weekdayNoon = new Date("2026-08-18T15:00:00.000Z");

describe("preço do carreto", () => {
  test("agendado soma bandeirada + distância + tempo", () => {
    const result = computeQuote({
      tariff,
      distanceMeters: 10_000, // 10 km -> R$ 32,00
      durationSeconds: 1_800, // 30 min -> R$ 18,00
      stopsCount: 2,
      helpersCount: 0,
      modality: "scheduled",
      referenceDate: weekdayNoon,
    });
    expect(result.subtotalCents).toBe(3_500 + 3_200 + 1_800);
    expect(result.surchargeCents).toBe(0);
    expect(result.totalCents).toBe(8_500);
  });

  test("imediato custa exatamente 35% a mais que o agendado", () => {
    const common = {
      tariff,
      distanceMeters: 10_000,
      durationSeconds: 1_800,
      stopsCount: 2,
      helpersCount: 0,
      referenceDate: weekdayNoon,
    };
    const scheduled = computeQuote({ ...common, modality: "scheduled" as const });
    const immediate = computeQuote({ ...common, modality: "immediate" as const });
    expect(immediate.totalCents).toBe(Math.round(scheduled.totalCents * 1.35));
    expect(immediate.subtotalCents).toBe(scheduled.subtotalCents);
  });

  test("paradas extras e ajudantes entram na conta", () => {
    const result = computeQuote({
      tariff,
      distanceMeters: 10_000,
      durationSeconds: 1_800,
      stopsCount: 4, // duas paradas extras
      helpersCount: 2,
      modality: "scheduled",
      referenceDate: weekdayNoon,
    });
    expect(result.subtotalCents).toBe(8_500 + 2 * 1_200 + 2 * 4_500);
  });

  test("corrida curtinha respeita a tarifa mínima", () => {
    const result = computeQuote({
      tariff,
      distanceMeters: 500,
      durationSeconds: 120,
      stopsCount: 2,
      helpersCount: 0,
      modality: "scheduled",
      referenceDate: weekdayNoon,
    });
    expect(result.minimumApplied).toBe(true);
    expect(result.subtotalCents).toBe(tariff.minimum_fare_cents);
  });

  test("mínimo é aplicado ANTES do acréscimo do imediato", () => {
    const result = computeQuote({
      tariff,
      distanceMeters: 500,
      durationSeconds: 120,
      stopsCount: 2,
      helpersCount: 0,
      modality: "immediate",
      referenceDate: weekdayNoon,
    });
    expect(result.totalCents).toBe(Math.round(5_000 * 1.35));
  });

  test("comissão e ganho do motorista fecham com o total", () => {
    const result = computeQuote({
      tariff,
      distanceMeters: 12_345,
      durationSeconds: 2_222,
      stopsCount: 3,
      helpersCount: 1,
      modality: "immediate",
      referenceDate: weekdayNoon,
    });
    expect(result.platformFeeCents + result.driverNetCents).toBe(result.totalCents);
    expect(result.platformFeeCents).toBe(Math.round(result.totalCents * 0.2));
  });

  test("multiplicador de demanda da região encarece", () => {
    const normal = computeQuote({
      tariff,
      distanceMeters: 10_000,
      durationSeconds: 1_800,
      stopsCount: 2,
      helpersCount: 0,
      modality: "scheduled",
      referenceDate: weekdayNoon,
    });
    const busy = computeQuote({
      tariff,
      distanceMeters: 10_000,
      durationSeconds: 1_800,
      stopsCount: 2,
      helpersCount: 0,
      modality: "scheduled",
      demandMultiplier: 1.5,
      referenceDate: weekdayNoon,
    });
    expect(busy.totalCents).toBe(normal.totalCents + Math.round(normal.subtotalCents * 0.5));
  });

  test("acréscimo noturno só vale de madrugada", () => {
    const nightTariff = { ...tariff, night_surcharge_pct: 20 };
    // 02:00 em São Paulo (UTC-3) = 05:00 UTC
    const dawn = new Date("2026-08-18T05:00:00.000Z");
    expect(isNightTime(dawn, nightTariff, "America/Sao_Paulo")).toBe(true);
    expect(isNightTime(weekdayNoon, nightTariff, "America/Sao_Paulo")).toBe(false);

    const atNight = computeQuote({
      tariff: nightTariff,
      distanceMeters: 10_000,
      durationSeconds: 1_800,
      stopsCount: 2,
      helpersCount: 0,
      modality: "scheduled",
      referenceDate: dawn,
      timezone: "America/Sao_Paulo",
    });
    expect(atNight.totalCents).toBe(8_500 + Math.round(8_500 * 0.2));
  });

  test("recusa dados impossíveis", () => {
    const base = {
      tariff,
      distanceMeters: 1_000,
      durationSeconds: 600,
      helpersCount: 0,
      modality: "scheduled" as const,
    };
    expect(() => computeQuote({ ...base, stopsCount: 1 })).toThrow();
    expect(() => computeQuote({ ...base, stopsCount: 2, distanceMeters: -1 })).toThrow();
    expect(() => computeQuote({ ...base, stopsCount: 2, helpersCount: -1 })).toThrow();
  });

  test("o detalhamento não inventa linha zerada", () => {
    const result = computeQuote({
      tariff,
      distanceMeters: 10_000,
      durationSeconds: 1_800,
      stopsCount: 2,
      helpersCount: 0,
      modality: "scheduled",
      referenceDate: weekdayNoon,
    });
    expect(result.lines.every((line) => line.amountCents !== 0)).toBe(true);
    expect(result.lines.map((line) => line.code)).toEqual(["base", "distance", "time"]);
  });
});

describe("espera e cancelamento", () => {
  test("os primeiros 15 minutos de espera são cortesia", () => {
    expect(computeWaitingFee(tariff, 10)).toBe(0);
    expect(computeWaitingFee(tariff, 15)).toBe(0);
    expect(computeWaitingFee(tariff, 25)).toBe(10 * 100);
  });

  test("sem motorista designado, cancelar é de graça", () => {
    expect(
      computeCancellationFee({
        tariff,
        by: "client",
        status: "searching_driver",
        secondsSinceAssigned: null,
      }),
    ).toBe(0);
  });

  test("dentro da janela de cortesia, cancelar é de graça", () => {
    expect(
      computeCancellationFee({
        tariff,
        by: "client",
        status: "driver_to_pickup",
        secondsSinceAssigned: 120,
      }),
    ).toBe(0);
  });

  test("depois da janela, o cliente paga a taxa", () => {
    expect(
      computeCancellationFee({
        tariff,
        by: "client",
        status: "driver_to_pickup",
        secondsSinceAssigned: 900,
      }),
    ).toBe(1_500);
  });

  test("motorista e admin cancelando não cobram do cliente", () => {
    for (const by of ["driver", "admin", "system"] as const) {
      expect(
        computeCancellationFee({
          tariff,
          by,
          status: "driver_to_pickup",
          secondsSinceAssigned: 900,
        }),
      ).toBe(0);
    }
  });
});

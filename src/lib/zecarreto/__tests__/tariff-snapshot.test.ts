import { describe, expect, test } from "bun:test";
import { computeQuote, type TariffLike } from "../domain/pricing";
import { recomputeFromSnapshot, type TariffSnapshot } from "../services/pricing.service";

const tarifaDeOntem: TariffLike = {
  base_fare_cents: 3_500,
  included_km: 5,
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
  service_fee_cents: 0,
  service_fee_pct: 0,
  toll_policy: "none",
  currency: "BRL",
};

/** Mesma tarifa, com todos os preços aumentados. */
const tarifaDeHoje: TariffLike = {
  ...tarifaDeOntem,
  base_fare_cents: 5_000,
  price_per_km_cents: 500,
  minimum_fare_cents: 9_000,
  immediate_surcharge_pct: 50,
};

const snapshot: TariffSnapshot = {
  taken_at: "2026-08-18T18:00:00.000Z",
  tariff: tarifaDeOntem,
  addons: [
    {
      code: "stairs",
      name: "Escada",
      pricing_mode: "per_floor",
      amount_cents: 1_500,
      percent: 0,
      max_quantity: 20,
    },
  ],
  region: { id: null, timezone: "America/Sao_Paulo", demand_multiplier: 1 },
  route_provider: "straight-line",
  rounding_cents: 0,
};

const pedido = {
  distanceMeters: 15_000,
  durationSeconds: 1_800,
  stopsCount: 2,
  helpersCount: 1,
  modality: "immediate" as const,
  addons: [{ code: "stairs", quantity: 2 }],
  referenceDate: new Date("2026-08-18T18:00:00.000Z"),
};

describe("fotografia da tarifa (snapshot)", () => {
  test("refazer a conta pelo snapshot dá exatamente o mesmo valor", () => {
    const original = computeQuote({
      tariff: tarifaDeOntem,
      addonDefinitions: snapshot.addons,
      timezone: "America/Sao_Paulo",
      ...pedido,
    });
    const refeito = recomputeFromSnapshot(snapshot, pedido);
    expect(refeito.totalCents).toBe(original.totalCents);
    expect(refeito.platformFeeCents).toBe(original.platformFeeCents);
    expect(refeito.driverNetCents).toBe(original.driverNetCents);
  });

  test("aumentar a tabela de preços NÃO mexe no pedido já fechado", () => {
    const pedidoDeOntem = recomputeFromSnapshot(snapshot, pedido);
    const mesmoPedidoComPrecoNovo = computeQuote({
      tariff: tarifaDeHoje,
      addonDefinitions: snapshot.addons,
      timezone: "America/Sao_Paulo",
      ...pedido,
    });

    // O preço novo é mais caro — prova de que a tabela realmente mudou.
    expect(mesmoPedidoComPrecoNovo.totalCents).toBeGreaterThan(pedidoDeOntem.totalCents);
    // E o pedido de ontem continua valendo o que valia.
    const refeitoDeNovo = recomputeFromSnapshot(snapshot, pedido);
    expect(refeitoDeNovo.totalCents).toBe(pedidoDeOntem.totalCents);
  });

  test("o snapshot guarda também os adicionais do dia", () => {
    const semSnapshot = recomputeFromSnapshot({ ...snapshot, addons: [] }, pedido);
    const comSnapshot = recomputeFromSnapshot(snapshot, pedido);
    // Sem a definição guardada, a escada não teria como ser cobrada.
    expect(comSnapshot.totalCents).toBeGreaterThan(semSnapshot.totalCents);
  });

  test("a região e o fuso do dia também ficam guardados", () => {
    const comDemanda = recomputeFromSnapshot(
      {
        ...snapshot,
        region: { id: "r1", timezone: "America/Sao_Paulo", demand_multiplier: 1.5 },
      },
      pedido,
    );
    const semDemanda = recomputeFromSnapshot(snapshot, pedido);
    expect(comDemanda.totalCents).toBeGreaterThan(semDemanda.totalCents);
  });
});

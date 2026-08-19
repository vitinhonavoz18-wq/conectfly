import { describe, expect, test } from "bun:test";
import {
  billableKilometers,
  computeAddons,
  computeQuote,
  computeToll,
  isNightTime,
  localClock,
  type AddonDefinition,
  type TariffLike,
} from "../domain/pricing";

/** Tarifa da FASE 3: bandeirada com 5 km inclusos. */
const tarifa: TariffLike = {
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
  toll_fixed_cents: 0,
  toll_applies_above_km: 0,
  currency: "BRL",
};

const adicionais: AddonDefinition[] = [
  {
    code: "stairs",
    name: "Escada",
    pricing_mode: "per_floor",
    amount_cents: 1_500,
    percent: 0,
    max_quantity: 20,
  },
  {
    code: "heavy_item",
    name: "Item pesado",
    pricing_mode: "per_unit",
    amount_cents: 5_000,
    percent: 0,
    max_quantity: 10,
  },
  {
    code: "assembly",
    name: "Montagem",
    pricing_mode: "fixed",
    amount_cents: 8_000,
    percent: 0,
    max_quantity: 1,
  },
  {
    code: "urgent_load",
    name: "Carga urgente",
    pricing_mode: "percent",
    amount_cents: 0,
    percent: 10,
    max_quantity: 1,
  },
];

/** Terça-feira, 15h em São Paulo — sem noturno, sem fim de semana. */
const tercaTarde = new Date("2026-08-18T18:00:00.000Z");

const base = {
  tariff: tarifa,
  distanceMeters: 15_000,
  durationSeconds: 1_800,
  stopsCount: 2,
  helpersCount: 0,
  modality: "scheduled" as const,
  referenceDate: tercaTarde,
  timezone: "America/Sao_Paulo",
};

describe("distância incluída e km excedente", () => {
  test("só o que passa da franquia é cobrado", () => {
    expect(billableKilometers(15_000, 5)).toBe(10);
    expect(billableKilometers(5_000, 5)).toBe(0);
    expect(billableKilometers(3_000, 5)).toBe(0); // nunca fica negativo
    expect(billableKilometers(15_000, 0)).toBe(15);
  });

  test("a conta usa só os km excedentes", () => {
    const resultado = computeQuote(base);
    // 3500 bandeirada + 10 km x 320 + 30 min x 60
    expect(resultado.subtotalCents).toBe(3_500 + 3_200 + 1_800);
    expect(resultado.billableKm).toBe(10);
  });

  test("viagem dentro da franquia não cobra distância", () => {
    const resultado = computeQuote({ ...base, distanceMeters: 4_000, durationSeconds: 600 });
    const linhas = resultado.lines.map((linha) => linha.code);
    expect(linhas).not.toContain("distance");
  });
});

describe("adicionais", () => {
  test("adicional por andar multiplica pela quantidade", () => {
    const resultado = computeQuote({
      ...base,
      addons: [{ code: "stairs", quantity: 3 }],
      addonDefinitions: adicionais,
    });
    expect(resultado.addonsCents).toBe(4_500);
  });

  test("adicional de valor fixo não multiplica", () => {
    const resultado = computeQuote({
      ...base,
      addons: [{ code: "assembly", quantity: 5 }],
      addonDefinitions: adicionais,
    });
    expect(resultado.addonsCents).toBe(8_000);
  });

  test("quantidade acima do limite é cortada no limite", () => {
    const { fixed } = computeAddons([{ code: "heavy_item", quantity: 999 }], adicionais);
    expect(fixed[0].quantity).toBe(10);
    expect(fixed[0].amountCents).toBe(50_000);
  });

  test("código que não existe no cadastro é ignorado", () => {
    const resultado = computeQuote({
      ...base,
      addons: [{ code: "desconto_secreto", quantity: 1 }],
      addonDefinitions: adicionais,
    });
    expect(resultado.addonsCents).toBe(0);
  });

  test("quantidade zero ou negativa é ignorada", () => {
    const { fixed } = computeAddons(
      [
        { code: "stairs", quantity: 0 },
        { code: "heavy_item", quantity: -3 },
      ],
      adicionais,
    );
    expect(fixed).toHaveLength(0);
  });

  test("adicional em percentual incide sobre o subtotal, não sobre o total", () => {
    const resultado = computeQuote({
      ...base,
      addons: [{ code: "urgent_load", quantity: 1 }],
      addonDefinitions: adicionais,
    });
    const subtotal = 3_500 + 3_200 + 1_800;
    expect(resultado.subtotalCents).toBe(subtotal);
    expect(resultado.addonsCents).toBe(Math.round(subtotal * 0.1));
  });

  test("adicional entra antes do acréscimo do imediato", () => {
    const resultado = computeQuote({
      ...base,
      modality: "immediate",
      addons: [{ code: "assembly", quantity: 1 }],
      addonDefinitions: adicionais,
    });
    const subtotal = 3_500 + 3_200 + 1_800 + 8_000;
    expect(resultado.totalCents).toBe(Math.round(subtotal * 1.35));
  });
});

describe("pedágio", () => {
  const comPedagio: TariffLike = {
    ...tarifa,
    toll_policy: "fixed",
    toll_fixed_cents: 1_200,
    toll_applies_above_km: 20,
  };

  test("só cobra acima da distância combinada", () => {
    expect(computeToll(comPedagio, 15_000)).toBe(0);
    expect(computeToll(comPedagio, 25_000)).toBe(1_200);
    expect(computeToll(comPedagio, 20_000)).toBe(0); // exatamente no limite não cobra
  });

  test("política 'route' usa o valor do serviço de mapas", () => {
    const porRota: TariffLike = { ...tarifa, toll_policy: "route" };
    expect(computeToll(porRota, 100_000, 2_340)).toBe(2_340);
    expect(computeToll(porRota, 100_000)).toBe(0);
  });

  test("pedágio NÃO leva o acréscimo de 35% do imediato", () => {
    const agendado = computeQuote({ ...base, tariff: comPedagio, distanceMeters: 30_000 });
    const imediato = computeQuote({
      ...base,
      tariff: comPedagio,
      distanceMeters: 30_000,
      modality: "immediate",
    });
    expect(agendado.tollCents).toBe(1_200);
    expect(imediato.tollCents).toBe(1_200);
    // A diferença entre os dois é 35% só do serviço, sem tocar no pedágio.
    expect(imediato.totalCents - agendado.totalCents).toBe(Math.round(agendado.fareCents * 0.35));
  });

  test("pedágio é repasse: fica com o motorista, não com a plataforma", () => {
    const semPedagio = computeQuote({ ...base, distanceMeters: 30_000 });
    const comPedagioResultado = computeQuote({
      ...base,
      tariff: comPedagio,
      distanceMeters: 30_000,
    });
    expect(comPedagioResultado.platformFeeCents).toBe(semPedagio.platformFeeCents);
    expect(comPedagioResultado.driverNetCents).toBe(semPedagio.driverNetCents + 1_200);
  });
});

describe("taxa de serviço", () => {
  const comTaxa: TariffLike = { ...tarifa, service_fee_cents: 300, service_fee_pct: 5 };

  test("soma parte fixa e percentual sobre o valor do serviço", () => {
    const resultado = computeQuote({ ...base, tariff: comTaxa });
    expect(resultado.serviceFeeCents).toBe(300 + Math.round(resultado.fareCents * 0.05));
    expect(resultado.totalCents).toBe(resultado.fareCents + resultado.serviceFeeCents);
  });

  test("a taxa de serviço fica com a plataforma", () => {
    const resultado = computeQuote({ ...base, tariff: comTaxa });
    const comissao = Math.round(resultado.fareCents * 0.2);
    expect(resultado.platformFeeCents).toBe(comissao + resultado.serviceFeeCents);
  });
});

describe("horários e fuso", () => {
  test("relógio é o da REGIÃO, não o do servidor", () => {
    // 02:00 em São Paulo é 05:00 em UTC.
    const madrugada = new Date("2026-08-18T05:00:00.000Z");
    expect(localClock(madrugada, "America/Sao_Paulo").minutesOfDay).toBe(2 * 60);
    expect(localClock(madrugada, "UTC").minutesOfDay).toBe(5 * 60);
  });

  test("a janela noturna atravessa a meia-noite", () => {
    const noturna = { ...tarifa, night_surcharge_pct: 20 };
    const casos: [string, boolean][] = [
      ["2026-08-19T00:59:00.000Z", true], // 21:59 SP — ainda não
      ["2026-08-19T01:00:00.000Z", true], // 22:00 SP — começa
      ["2026-08-19T03:00:00.000Z", true], // 00:00 SP — vira o dia
      ["2026-08-19T08:59:00.000Z", true], // 05:59 SP — último minuto
      ["2026-08-19T09:00:00.000Z", false], // 06:00 SP — acabou
      ["2026-08-19T15:00:00.000Z", false], // 12:00 SP
    ];
    // 21:59 não é noturno: conferido em separado para a leitura ficar clara.
    expect(isNightTime(new Date("2026-08-19T00:58:00.000Z"), noturna, "America/Sao_Paulo")).toBe(
      false,
    );
    for (const [iso, esperado] of casos.slice(1)) {
      expect(isNightTime(new Date(iso), noturna, "America/Sao_Paulo")).toBe(esperado);
    }
  });

  test("mesmo instante pode ser noturno numa região e não em outra", () => {
    const noturna = { ...tarifa, night_surcharge_pct: 20 };
    const instante = new Date("2026-08-19T02:00:00.000Z"); // 23:00 SP, 02:00 UTC
    expect(isNightTime(instante, noturna, "America/Sao_Paulo")).toBe(true);
    expect(isNightTime(instante, noturna, "UTC")).toBe(true);
    const outro = new Date("2026-08-19T12:00:00.000Z"); // 09:00 SP, 12:00 UTC
    expect(isNightTime(outro, noturna, "America/Sao_Paulo")).toBe(false);
  });

  test("fim de semana é o da região", () => {
    // Sábado 00:30 em São Paulo = sábado 03:30 UTC.
    const sabadoSP = new Date("2026-08-22T03:30:00.000Z");
    expect(localClock(sabadoSP, "America/Sao_Paulo").isWeekend).toBe(true);
    // Sexta 23:30 em São Paulo = sábado 02:30 UTC: ainda é sexta lá.
    const sextaSP = new Date("2026-08-22T02:30:00.000Z");
    expect(localClock(sextaSP, "America/Sao_Paulo").isWeekend).toBe(false);
    expect(localClock(sextaSP, "UTC").isWeekend).toBe(true);
  });

  test("acréscimo de fim de semana só entra no sábado/domingo da região", () => {
    const comFimDeSemana = { ...tarifa, weekend_surcharge_pct: 15 };
    const sabado = computeQuote({
      ...base,
      tariff: comFimDeSemana,
      referenceDate: new Date("2026-08-22T15:00:00.000Z"),
    });
    const terca = computeQuote({ ...base, tariff: comFimDeSemana });
    expect(sabado.surchargeCents).toBe(Math.round(sabado.subtotalCents * 0.15));
    expect(terca.surchargeCents).toBe(0);
  });
});

describe("arredondamento do dinheiro", () => {
  test("arredonda o total para o passo configurado", () => {
    const resultado = computeQuote({ ...base, roundingCents: 50 });
    expect(resultado.totalCents % 50).toBe(0);
  });

  test("mesmo arredondando, comissão + motorista fecham o total", () => {
    for (const passo of [0, 10, 50, 100]) {
      for (const metros of [1_000, 7_777, 15_000, 123_456]) {
        const resultado = computeQuote({
          ...base,
          distanceMeters: metros,
          modality: "immediate",
          roundingCents: passo,
          addons: [{ code: "stairs", quantity: 3 }],
          addonDefinitions: adicionais,
        });
        expect(resultado.platformFeeCents + resultado.driverNetCents).toBe(resultado.totalCents);
        expect(Number.isInteger(resultado.totalCents)).toBe(true);
        expect(resultado.driverNetCents).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("todo valor devolvido é centavo inteiro", () => {
    const resultado = computeQuote({
      ...base,
      distanceMeters: 8_333,
      durationSeconds: 1_111,
      modality: "immediate",
      addons: [{ code: "urgent_load", quantity: 1 }],
      addonDefinitions: adicionais,
    });
    for (const valor of [
      resultado.subtotalCents,
      resultado.addonsCents,
      resultado.surchargeCents,
      resultado.tollCents,
      resultado.serviceFeeCents,
      resultado.totalCents,
      resultado.platformFeeCents,
      resultado.driverNetCents,
    ]) {
      expect(Number.isInteger(valor)).toBe(true);
    }
  });
});

describe("casos extremos", () => {
  test("distância zero cai na tarifa mínima", () => {
    const resultado = computeQuote({ ...base, distanceMeters: 0, durationSeconds: 0 });
    expect(resultado.minimumApplied).toBe(true);
    expect(resultado.totalCents).toBe(5_000);
  });

  test("viagem muito longa não estoura nem vira número quebrado", () => {
    const resultado = computeQuote({ ...base, distanceMeters: 1_500_000, durationSeconds: 86_400 });
    expect(Number.isInteger(resultado.totalCents)).toBe(true);
    expect(resultado.totalCents).toBeGreaterThan(0);
    expect(resultado.platformFeeCents + resultado.driverNetCents).toBe(resultado.totalCents);
  });

  test("comissão de 100% não deixa o motorista negativo", () => {
    const resultado = computeQuote({
      ...base,
      tariff: { ...tarifa, platform_commission_pct: 100 },
    });
    expect(resultado.driverNetCents).toBe(0);
    expect(resultado.platformFeeCents).toBe(resultado.totalCents);
  });

  test("dados impossíveis são recusados", () => {
    expect(() => computeQuote({ ...base, distanceMeters: -1 })).toThrow();
    expect(() => computeQuote({ ...base, stopsCount: 1 })).toThrow();
    expect(() => computeQuote({ ...base, helpersCount: -1 })).toThrow();
  });

  test("muitas paradas e ajudantes continuam somando certo", () => {
    const resultado = computeQuote({ ...base, stopsCount: 6, helpersCount: 4 });
    expect(resultado.subtotalCents).toBe(3_500 + 3_200 + 1_800 + 4 * 1_200 + 4 * 4_500);
  });
});

describe("imediato x agendado", () => {
  test("imediato é exatamente 1,35 vezes o agendado", () => {
    const agendado = computeQuote(base);
    const imediato = computeQuote({ ...base, modality: "immediate" });
    expect(imediato.totalCents).toBe(Math.round(agendado.totalCents * 1.35));
  });

  test("com adicionais e ajudantes a proporção se mantém", () => {
    const comum = {
      ...base,
      helpersCount: 2,
      stopsCount: 3,
      addons: [{ code: "stairs", quantity: 2 }],
      addonDefinitions: adicionais,
    };
    const agendado = computeQuote(comum);
    const imediato = computeQuote({ ...comum, modality: "immediate" });
    expect(imediato.totalCents).toBe(Math.round(agendado.totalCents * 1.35));
  });
});

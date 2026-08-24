import { describe, expect, test } from "bun:test";
import { arrivalClock, estimateEta, estimateEtaThrough, formatEta } from "../domain/eta";

const opcoes = { averageSpeedKmh: 26, minimumSeconds: 60 };

/** Praça da Sé, São Paulo. */
const se = { lat: -23.5505, lng: -46.6333 };
/** Guarulhos — cerca de 20 km em linha reta. */
const guarulhos = { lat: -23.4356, lng: -46.4731 };
/** Uns 2 km da Sé. */
const perto = { lat: -23.5325, lng: -46.6333 };

describe("previsão de chegada", () => {
  test("mais longe demora mais", () => {
    const curta = estimateEta(se, perto, opcoes);
    const longa = estimateEta(se, guarulhos, opcoes);
    expect(longa.seconds).toBeGreaterThan(curta.seconds);
  });

  test("a conta bate com a velocidade média", () => {
    const eta = estimateEta(se, guarulhos, opcoes);
    const esperado = Math.round((eta.meters / 1000 / 26) * 3600);
    expect(eta.seconds).toBe(esperado);
  });

  test("a distância considera que rua não é régua", () => {
    const eta = estimateEta(se, guarulhos, opcoes);
    // 20 km em linha reta viram ~26 km de rua.
    expect(eta.meters).toBeGreaterThan(24_000);
    expect(eta.meters).toBeLessThan(30_000);
  });

  test("nunca promete 'chega em 5 segundos'", () => {
    const eta = estimateEta(se, { lat: se.lat + 0.00001, lng: se.lng }, opcoes);
    expect(eta.seconds).toBe(60);
  });

  test("velocidade do momento afina a conta, mas sem exagero", () => {
    const parado = estimateEta(se, guarulhos, { ...opcoes, currentSpeedKmh: 0 });
    const rodando = estimateEta(se, guarulhos, { ...opcoes, currentSpeedKmh: 60 });
    // Parado no semáforo não faz a previsão explodir.
    expect(parado.speedKmhUsed).toBe(26);
    // Rodando rápido reduz a previsão, mas fica entre as duas velocidades.
    expect(rodando.speedKmhUsed).toBe(43);
    expect(rodando.seconds).toBeLessThan(parado.seconds);
  });

  test("velocidade absurda é ignorada", () => {
    const eta = estimateEta(se, guarulhos, { ...opcoes, currentSpeedKmh: 900 });
    expect(eta.speedKmhUsed).toBe(26);
  });

  test("rota com paradas soma todos os trechos", () => {
    const direto = estimateEtaThrough([se, guarulhos], opcoes);
    const comParada = estimateEtaThrough([se, perto, guarulhos], opcoes);
    expect(comParada.meters).toBeGreaterThanOrEqual(direto.meters);
  });

  test("rota sem pontos suficientes devolve o piso", () => {
    const eta = estimateEtaThrough([se], opcoes);
    expect(eta.seconds).toBe(60);
    expect(eta.meters).toBe(0);
  });
});

describe("como o tempo aparece na tela", () => {
  test("menos de um minuto não vira '0 min'", () => {
    expect(formatEta(30)).toBe("menos de 1 min");
  });

  test("minutos aparecem redondos", () => {
    expect(formatEta(600)).toBe("10 min");
    expect(formatEta(3_540)).toBe("59 min");
  });

  test("acima de uma hora aparece em horas", () => {
    expect(formatEta(3_600)).toBe("1 h");
    expect(formatEta(3_900)).toBe("1 h 05");
    expect(formatEta(7_800)).toBe("2 h 10");
  });

  test("o horário previsto sai no fuso de quem lê", () => {
    // 15:00 UTC = 12:00 em São Paulo. Faltando 30 min: 12:30.
    const agora = new Date("2026-08-21T15:00:00.000Z");
    expect(arrivalClock(1_800, agora, "America/Sao_Paulo")).toBe("12:30");
    expect(arrivalClock(1_800, agora, "UTC")).toBe("15:30");
  });
});

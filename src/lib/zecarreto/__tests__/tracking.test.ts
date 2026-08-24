import { describe, expect, test } from "bun:test";
import {
  approximateLocation,
  decidePing,
  isSignalStale,
  type TrackingPolicy,
} from "../domain/tracking";
import { haversineMeters } from "../domain/geo";

const policy: TrackingPolicy = {
  minSecondsBetweenPings: 10,
  minDistanceMeters: 60,
  maxSecondsBetweenPoints: 90,
};

const base = new Date("2026-08-21T12:00:00.000Z");
const emSegundos = (segundos: number) => new Date(base.getTime() + segundos * 1000);

/** Praça da Sé, São Paulo. */
const se = { lat: -23.5505, lng: -46.6333 };
/** Cerca de 100 metros ao norte. */
const cemMetros = { lat: -23.5496, lng: -46.6333 };
/** Cerca de 20 metros ao norte. */
const vinteMetros = { lat: -23.55032, lng: -46.6333 };

describe("o que vale a pena gravar", () => {
  test("sinal cedo demais é descartado inteiro", () => {
    const decisao = decidePing({
      now: { ...cemMetros, recordedAt: emSegundos(5) },
      lastCurrent: { ...se, recordedAt: base },
      lastBreadcrumb: { ...se, recordedAt: base },
      onRide: true,
      policy,
    });
    expect(decisao.updateCurrent).toBe(false);
    expect(decisao.storeBreadcrumb).toBe(false);
    expect(decisao.reason).toContain("cedo demais");
  });

  test("fora de corrida grava só a posição atual, nunca a trilha", () => {
    const decisao = decidePing({
      now: { ...cemMetros, recordedAt: emSegundos(60) },
      lastCurrent: { ...se, recordedAt: base },
      lastBreadcrumb: null,
      onRide: false,
      policy,
    });
    expect(decisao.updateCurrent).toBe(true);
    expect(decisao.storeBreadcrumb).toBe(false);
  });

  test("o primeiro ponto da corrida sempre entra na trilha", () => {
    const decisao = decidePing({
      now: { ...se, recordedAt: base },
      lastCurrent: null,
      lastBreadcrumb: null,
      onRide: true,
      policy,
    });
    expect(decisao.storeBreadcrumb).toBe(true);
    expect(decisao.movedMeters).toBeNull();
  });

  test("andou o bastante: grava um ponto novo", () => {
    const decisao = decidePing({
      now: { ...cemMetros, recordedAt: emSegundos(30) },
      lastCurrent: { ...se, recordedAt: base },
      lastBreadcrumb: { ...se, recordedAt: base },
      onRide: true,
      policy,
    });
    expect(decisao.storeBreadcrumb).toBe(true);
    expect(decisao.movedMeters).toBeGreaterThan(60);
  });

  test("andou pouco: atualiza a posição, mas não enche a trilha", () => {
    const decisao = decidePing({
      now: { ...vinteMetros, recordedAt: emSegundos(30) },
      lastCurrent: { ...se, recordedAt: base },
      lastBreadcrumb: { ...se, recordedAt: base },
      onRide: true,
      policy,
    });
    expect(decisao.updateCurrent).toBe(true);
    expect(decisao.storeBreadcrumb).toBe(false);
    expect(decisao.reason).toContain("andou pouco");
  });

  test("parado há muito tempo grava um ponto mesmo assim", () => {
    // Serve de prova de que o carreteiro estava ali, esperando.
    const decisao = decidePing({
      now: { ...vinteMetros, recordedAt: emSegundos(120) },
      lastCurrent: { ...se, recordedAt: emSegundos(100) },
      lastBreadcrumb: { ...se, recordedAt: base },
      onRide: true,
      policy,
    });
    expect(decisao.storeBreadcrumb).toBe(true);
    expect(decisao.reason).toContain("parado");
  });

  test("uma viagem inteira gera muito menos pontos do que sinais", () => {
    // Simula 10 minutos de viagem com sinal a cada 5 segundos.
    let lastCurrent = { ...se, recordedAt: base };
    let lastBreadcrumb = { ...se, recordedAt: base };
    let sinais = 0;
    let pontos = 0;

    for (let segundo = 5; segundo <= 600; segundo += 5) {
      sinais += 1;
      // ~40 km/h: cerca de 55 metros a cada 5 segundos.
      const posicao = { lat: se.lat + segundo * 0.0000045, lng: se.lng };
      const agora = { ...posicao, recordedAt: emSegundos(segundo) };
      const decisao = decidePing({
        now: agora,
        lastCurrent,
        lastBreadcrumb,
        onRide: true,
        policy,
      });
      if (decisao.updateCurrent) lastCurrent = { ...posicao, recordedAt: emSegundos(segundo) };
      if (decisao.storeBreadcrumb) {
        pontos += 1;
        lastBreadcrumb = { ...posicao, recordedAt: emSegundos(segundo) };
      }
    }

    expect(sinais).toBe(120);
    // Bem menos pontos que sinais — é o objetivo do filtro.
    expect(pontos).toBeLessThan(sinais / 2);
    expect(pontos).toBeGreaterThan(0);
  });
});

describe("perda de sinal", () => {
  test("sem nenhum sinal, o motorista conta como sumido", () => {
    expect(isSignalStale(null, 300)).toBe(true);
  });

  test("sinal recente é sinal vivo", () => {
    const agora = new Date("2026-08-21T12:05:00.000Z");
    expect(isSignalStale(new Date("2026-08-21T12:04:00.000Z"), 300, agora)).toBe(false);
  });

  test("sinal velho passa do prazo", () => {
    const agora = new Date("2026-08-21T12:10:00.000Z");
    expect(isSignalStale(new Date("2026-08-21T12:00:00.000Z"), 300, agora)).toBe(true);
  });
});

describe("endereço aproximado antes do aceite", () => {
  test("o ponto arredondado fica perto, mas não é o exato", () => {
    const aproximado = approximateLocation(se, 400);
    const distancia = haversineMeters(se, aproximado);
    expect(distancia).toBeGreaterThan(0);
    expect(distancia).toBeLessThan(600);
    expect(aproximado.lat).not.toBe(se.lat);
  });

  test("uma rua inteira vira um punhado de pontos", () => {
    // É isso que esconde o número da casa: dezenas de endereços vizinhos
    // colapsam em poucos pontos. (Quem está bem na divisa entre dois
    // quadrantes cai no vizinho — e tudo bem: o endereço exato continua
    // escondido de qualquer jeito.)
    const enderecos = Array.from({ length: 40 }, (_, i) => ({
      lat: se.lat + i * 0.0001,
      lng: se.lng + i * 0.0001,
    }));
    const distintos = new Set(
      enderecos.map((endereco) => {
        const p = approximateLocation(endereco, 400);
        return `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
      }),
    );
    expect(distintos.size).toBeLessThan(enderecos.length / 3);
    expect(distintos.size).toBeGreaterThan(0);
  });

  test("o ponto aproximado nunca entrega o endereço exato", () => {
    for (let i = 0; i < 50; i += 1) {
      const endereco = { lat: se.lat + i * 0.00013, lng: se.lng - i * 0.00017 };
      const aproximado = approximateLocation(endereco, 400);
      expect(haversineMeters(endereco, aproximado)).toBeLessThan(700);
    }
  });

  test("raio zero devolve o ponto original", () => {
    expect(approximateLocation(se, 0)).toEqual(se);
  });
});

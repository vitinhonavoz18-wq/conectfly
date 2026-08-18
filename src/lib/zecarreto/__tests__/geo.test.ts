import { describe, expect, test } from "bun:test";
import {
  boundingBox,
  haversineMeters,
  isValidLatLng,
  straightLineRouteProvider,
} from "../domain/geo";

const se = { lat: -23.5505, lng: -46.6333 }; // Praça da Sé, São Paulo
const guarulhos = { lat: -23.4356, lng: -46.4731 };

describe("distância e vizinhança", () => {
  test("distância em linha reta bate com a realidade (~20 km)", () => {
    const meters = haversineMeters(se, guarulhos);
    expect(meters).toBeGreaterThan(18_000);
    expect(meters).toBeLessThan(22_000);
  });

  test("mesmo ponto dá zero", () => {
    expect(haversineMeters(se, se)).toBe(0);
  });

  test("a caixa de busca cobre o raio pedido", () => {
    const box = boundingBox(se, 5);
    expect(box.minLat).toBeLessThan(se.lat);
    expect(box.maxLat).toBeGreaterThan(se.lat);
    expect(haversineMeters(se, { lat: box.maxLat, lng: se.lng })).toBeGreaterThanOrEqual(4_900);
  });

  test("coordenada inválida é recusada", () => {
    expect(isValidLatLng(se)).toBe(true);
    expect(isValidLatLng({ lat: 200, lng: 0 })).toBe(false);
    expect(isValidLatLng(null)).toBe(false);
    expect(isValidLatLng({ lat: -23.5 })).toBe(false);
  });

  test("estimativa de rota soma as paradas e aplica o fator de ruas", () => {
    const straight = haversineMeters(se, guarulhos);
    return straightLineRouteProvider.estimate([se, guarulhos]).then((route) => {
      expect(route.distanceMeters).toBe(Math.round(straight * 1.3));
      expect(route.durationSeconds).toBeGreaterThan(0);
    });
  });

  test("rota com menos de dois pontos é erro", async () => {
    await expect(straightLineRouteProvider.estimate([se])).rejects.toThrow();
  });
});

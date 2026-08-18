/**
 * Cálculo de distância e vizinhança.
 *
 * A FASE 1 usa distância em linha reta com um fator de correção (ruas não
 * são retas). Quando entrar um serviço de mapas de verdade, basta trocar
 * a implementação de `RouteProvider` — nada mais no sistema muda.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteEstimate {
  distanceMeters: number;
  durationSeconds: number;
  provider: string;
}

export interface RouteProvider {
  name: string;
  estimate(points: LatLng[]): Promise<RouteEstimate>;
}

const EARTH_RADIUS_M = 6_371_000;

/** Distância em linha reta entre dois pontos, em metros. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** Quadrado de busca ao redor de um ponto — usado para achar motoristas perto. */
export function boundingBox(center: LatLng, radiusKm: number) {
  const latDelta = radiusKm / 111.32;
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  const lngDelta = radiusKm / (111.32 * (Math.abs(cosLat) < 0.01 ? 0.01 : cosLat));
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - Math.abs(lngDelta),
    maxLng: center.lng + Math.abs(lngDelta),
  };
}

export function isValidLatLng(point: Partial<LatLng> | null | undefined): point is LatLng {
  return (
    !!point &&
    typeof point.lat === "number" &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

/** Rua não é régua: a distância real costuma ser ~30% maior que a reta. */
export const STRAIGHT_LINE_ROAD_FACTOR = 1.3;
/** Velocidade média usada na estimativa de tempo (trânsito urbano). */
export const DEFAULT_AVG_SPEED_KMH = 28;

export const straightLineRouteProvider: RouteProvider = {
  name: "straight-line",
  async estimate(points: LatLng[]): Promise<RouteEstimate> {
    if (points.length < 2) {
      throw new Error("É preciso pelo menos origem e destino para estimar a rota.");
    }
    let straight = 0;
    for (let i = 1; i < points.length; i += 1) {
      straight += haversineMeters(points[i - 1], points[i]);
    }
    const distanceMeters = Math.round(straight * STRAIGHT_LINE_ROAD_FACTOR);
    const durationSeconds = Math.round((distanceMeters / 1000 / DEFAULT_AVG_SPEED_KMH) * 3600);
    return { distanceMeters, durationSeconds, provider: "straight-line" };
  },
};

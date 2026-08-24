/**
 * Previsão de chegada (ETA).
 *
 * "Chega em 12 minutos" é a informação que mais acalma quem está
 * esperando. Como ainda não há um serviço de mapas com trânsito, a conta é
 * honesta e simples: distância que falta dividida pela velocidade média,
 * com um piso para nunca dizer "chega em 5 segundos".
 *
 * Quando entrar um provedor de rotas de verdade, troca-se `estimateEta`
 * por ele e o resto do sistema continua igual.
 */

import { haversineMeters, STRAIGHT_LINE_ROAD_FACTOR, type LatLng } from "./geo";

export interface EtaOptions {
  /** Velocidade média em km/h usada quando não há dado melhor. */
  averageSpeedKmh: number;
  /** Nunca prometer menos que isso, em segundos. */
  minimumSeconds: number;
  /** Velocidade instantânea do motorista, se o aparelho informou. */
  currentSpeedKmh?: number | null;
}

export interface EtaResult {
  seconds: number;
  meters: number;
  speedKmhUsed: number;
  /** Texto pronto para a tela: "12 min", "1 h 05". */
  label: string;
}

/** Estimativa entre dois pontos. */
export function estimateEta(from: LatLng, to: LatLng, options: EtaOptions): EtaResult {
  const straight = haversineMeters(from, to);
  const meters = Math.round(straight * STRAIGHT_LINE_ROAD_FACTOR);

  // A velocidade do momento só é usada se fizer sentido: parado no
  // semáforo não significa que a viagem levará horas.
  const instant = options.currentSpeedKmh ?? 0;
  const speedKmhUsed =
    instant >= 5 && instant <= 120
      ? (instant + options.averageSpeedKmh) / 2
      : options.averageSpeedKmh;

  const seconds = Math.max(
    options.minimumSeconds,
    Math.round((meters / 1000 / Math.max(1, speedKmhUsed)) * 3600),
  );

  return { seconds, meters, speedKmhUsed, label: formatEta(seconds) };
}

/** Estimativa passando por vários pontos (retirada, paradas, entrega). */
export function estimateEtaThrough(points: LatLng[], options: EtaOptions): EtaResult {
  if (points.length < 2) {
    return {
      seconds: options.minimumSeconds,
      meters: 0,
      speedKmhUsed: options.averageSpeedKmh,
      label: formatEta(options.minimumSeconds),
    };
  }
  let meters = 0;
  for (let i = 1; i < points.length; i += 1) {
    meters += haversineMeters(points[i - 1], points[i]);
  }
  meters = Math.round(meters * STRAIGHT_LINE_ROAD_FACTOR);
  const seconds = Math.max(
    options.minimumSeconds,
    Math.round((meters / 1000 / Math.max(1, options.averageSpeedKmh)) * 3600),
  );
  return { seconds, meters, speedKmhUsed: options.averageSpeedKmh, label: formatEta(seconds) };
}

export function formatEta(seconds: number): string {
  if (seconds < 60) return "menos de 1 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/** Horário previsto de chegada, já no fuso de quem está lendo. */
export function arrivalClock(
  seconds: number,
  from = new Date(),
  timezone = "America/Sao_Paulo",
): string {
  const arrival = new Date(from.getTime() + seconds * 1000);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(arrival);
}

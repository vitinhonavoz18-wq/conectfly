/**
 * Rastreamento: o que vale a pena gravar.
 *
 * O celular do carreteiro sabe a posição a cada segundo. Gravar tudo isso
 * encheria o banco de lixo — é como filmar o dia inteiro para depois
 * procurar dois minutos de imagem. Então guardamos:
 *
 *  • a POSIÇÃO ATUAL, numa linha só por motorista, que é sobrescrita; e
 *  • a TRILHA da corrida, só quando ele realmente andou, ou quando faz
 *    tempo demais desde o último ponto (para provar que estava parado ali).
 *
 * As duas regras juntas dão um caminho fiel com uma fração dos registros.
 */

import { haversineMeters, type LatLng } from "./geo";

export interface TrackingPolicy {
  /** Intervalo mínimo entre dois sinais do mesmo motorista. */
  minSecondsBetweenPings: number;
  /** Distância mínima andada para gravar um ponto novo na trilha. */
  minDistanceMeters: number;
  /** Mesmo parado, grava um ponto a cada tanto tempo. */
  maxSecondsBetweenPoints: number;
}

export interface LastKnownPoint {
  lat: number;
  lng: number;
  recordedAt: Date;
}

export interface PingDecision {
  /** Atualizar a posição atual do motorista? */
  updateCurrent: boolean;
  /** Gravar um ponto novo na trilha da corrida? */
  storeBreadcrumb: boolean;
  /** Quantos metros andou desde o último ponto (null = primeiro ponto). */
  movedMeters: number | null;
  reason: string;
}

/** Decide o que fazer com um sinal de posição que acabou de chegar. */
export function decidePing(input: {
  now: LatLng & { recordedAt: Date };
  lastCurrent: LastKnownPoint | null;
  lastBreadcrumb: LastKnownPoint | null;
  onRide: boolean;
  policy: TrackingPolicy;
}): PingDecision {
  const { now, lastCurrent, lastBreadcrumb, onRide, policy } = input;

  const secondsSinceCurrent = lastCurrent
    ? (now.recordedAt.getTime() - lastCurrent.recordedAt.getTime()) / 1000
    : Number.POSITIVE_INFINITY;

  // Sinal cedo demais é descartado inteiro: nem posição, nem trilha.
  if (secondsSinceCurrent < policy.minSecondsBetweenPings) {
    return {
      updateCurrent: false,
      storeBreadcrumb: false,
      movedMeters: lastCurrent ? haversineMeters(lastCurrent, now) : null,
      reason: "sinal recebido cedo demais",
    };
  }

  if (!onRide) {
    return {
      updateCurrent: true,
      storeBreadcrumb: false,
      movedMeters: lastCurrent ? haversineMeters(lastCurrent, now) : null,
      reason: "fora de corrida: só a posição atual",
    };
  }

  if (!lastBreadcrumb) {
    return {
      updateCurrent: true,
      storeBreadcrumb: true,
      movedMeters: null,
      reason: "primeiro ponto da trilha",
    };
  }

  const moved = haversineMeters(lastBreadcrumb, now);
  const secondsSinceBreadcrumb =
    (now.recordedAt.getTime() - lastBreadcrumb.recordedAt.getTime()) / 1000;

  if (moved >= policy.minDistanceMeters) {
    return {
      updateCurrent: true,
      storeBreadcrumb: true,
      movedMeters: moved,
      reason: `andou ${Math.round(moved)} m`,
    };
  }
  if (secondsSinceBreadcrumb >= policy.maxSecondsBetweenPoints) {
    return {
      updateCurrent: true,
      storeBreadcrumb: true,
      movedMeters: moved,
      reason: "parado, mas faz tempo desde o último ponto",
    };
  }

  return {
    updateCurrent: true,
    storeBreadcrumb: false,
    movedMeters: moved,
    reason: "andou pouco desde o último ponto",
  };
}

/** O sinal do motorista está velho a ponto de considerá-lo sumido? */
export function isSignalStale(
  lastRecordedAt: Date | null,
  graceSeconds: number,
  now = new Date(),
): boolean {
  if (!lastRecordedAt) return true;
  return (now.getTime() - lastRecordedAt.getTime()) / 1000 > graceSeconds;
}

/**
 * Arredonda uma coordenada para esconder o endereço exato.
 *
 * Antes de aceitar, o carreteiro precisa saber SE vale a pena ir — não
 * precisa saber o número da casa. É como o anúncio de imóvel que mostra a
 * região antes de marcar a visita.
 */
export function approximateLocation(point: LatLng, radiusMeters: number): LatLng {
  if (radiusMeters <= 0) return point;

  // A ideia é jogar o ponto no centro de um quadrado de uma grade fixa —
  // como dizer "fica no quarteirão tal" em vez de dar o número da casa.
  //
  // Detalhe que faz toda a diferença: a largura do quadrado em longitude
  // é calculada a partir da latitude JÁ ARREDONDADA. Se fosse pela
  // latitude original, cada endereço teria a sua própria grade e nenhum
  // vizinho cairia no mesmo quadrado — o arredondamento não esconderia
  // nada.
  const latStep = radiusMeters / 111_320;
  const lat = Math.round(point.lat / latStep) * latStep;

  const cosLat = Math.abs(Math.cos((lat * Math.PI) / 180));
  const lngStep = radiusMeters / (111_320 * Math.max(0.01, cosLat));
  const lng = Math.round(point.lng / lngStep) * lngStep;

  return { lat, lng };
}

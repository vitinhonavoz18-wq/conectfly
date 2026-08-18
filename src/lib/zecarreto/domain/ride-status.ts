/**
 * A esteira do carreto: por onde a corrida pode andar, e quem pode
 * empurrá-la.
 *
 * Este arquivo é o espelho da trava que existe no banco
 * (`zc_ride_transition_allowed`). O banco é a autoridade final — aqui a
 * regra existe para o sistema poder recusar cedo, com uma mensagem boa,
 * antes de bater no banco.
 */

import type { ZcRideStatus, ZcRole } from "./enums";
import { ZC_RIDE_TERMINAL_STATUSES } from "./enums";

export const ZC_RIDE_TRANSITIONS: Record<ZcRideStatus, readonly ZcRideStatus[]> = {
  draft: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["searching_driver", "cancelled"],
  searching_driver: ["driver_assigned", "cancelled"],
  // Motorista desistiu? A corrida volta para a fila de busca.
  driver_assigned: ["driver_to_pickup", "searching_driver", "cancelled"],
  driver_to_pickup: ["driver_arrived", "searching_driver", "cancelled"],
  driver_arrived: ["loading", "cancelled"],
  loading: ["in_transit", "cancelled"],
  in_transit: ["unloading", "cancelled"],
  unloading: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/**
 * Quem tem a mão no botão de cada etapa.
 * `system` é o próprio servidor (pagamento aprovado, oferta aceita, busca
 * esgotada) — nunca um usuário apertando um botão.
 */
export type ZcTransitionActor = ZcRole | "system";

const ACTORS_BY_TARGET: Record<ZcRideStatus, readonly ZcTransitionActor[]> = {
  draft: ["system"],
  awaiting_payment: ["client", "admin", "system"],
  searching_driver: ["system", "admin", "driver"],
  driver_assigned: ["system", "admin"],
  driver_to_pickup: ["driver", "admin"],
  driver_arrived: ["driver", "admin"],
  loading: ["driver", "admin"],
  in_transit: ["driver", "admin"],
  unloading: ["driver", "admin"],
  completed: ["driver", "admin"],
  cancelled: ["client", "driver", "admin", "system"],
};

export function isTerminalRideStatus(status: ZcRideStatus): boolean {
  return ZC_RIDE_TERMINAL_STATUSES.includes(status);
}

export function canTransition(from: ZcRideStatus, to: ZcRideStatus): boolean {
  return ZC_RIDE_TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: ZcRideStatus): readonly ZcRideStatus[] {
  return ZC_RIDE_TRANSITIONS[from];
}

export function actorCanTransition(
  actor: ZcTransitionActor,
  from: ZcRideStatus,
  to: ZcRideStatus,
): boolean {
  if (!canTransition(from, to)) return false;
  return ACTORS_BY_TARGET[to].includes(actor);
}

/**
 * Explica em português por que uma mudança de etapa foi recusada — a
 * mensagem chega até a tela do usuário.
 */
export function describeTransitionError(from: ZcRideStatus, to: ZcRideStatus): string {
  if (isTerminalRideStatus(from)) {
    return `Este carreto já está ${STATUS_LABELS[from].toLowerCase()} e não pode mais mudar de etapa.`;
  }
  if (!canTransition(from, to)) {
    const allowed = nextStatuses(from)
      .map((s) => STATUS_LABELS[s])
      .join(", ");
    return `Não dá para ir de "${STATUS_LABELS[from]}" direto para "${STATUS_LABELS[to]}". Próximas etapas possíveis: ${allowed}.`;
  }
  return `Etapa "${STATUS_LABELS[to]}" não permitida para este perfil.`;
}

export const STATUS_LABELS: Record<ZcRideStatus, string> = {
  draft: "Rascunho",
  awaiting_payment: "Aguardando pagamento",
  searching_driver: "Procurando motorista",
  driver_assigned: "Motorista a caminho",
  driver_to_pickup: "Indo até a retirada",
  driver_arrived: "Motorista no local",
  loading: "Carregando",
  in_transit: "Em transporte",
  unloading: "Descarregando",
  completed: "Concluído",
  cancelled: "Cancelado",
};

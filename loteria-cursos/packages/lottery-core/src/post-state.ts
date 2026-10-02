/**
 * Máquina de estados dos posts. É espelho exato da função SQL
 * `lc_post_transition_allowed` (um teste de integração garante que os dois batem).
 * O banco é a barreira final: transição inválida gera erro, nunca passa calada.
 */
export const POST_STATUSES = [
  "DRAFT",
  "READY",
  "RENDERING",
  "RENDERED",
  "PUBLISHING",
  "PUBLISHED",
  "PUBLISHED_SIMULATED",
  "FAILED",
  "CANCELLED",
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_TRANSITIONS: Record<PostStatus, readonly PostStatus[]> = {
  DRAFT: ["READY", "FAILED", "CANCELLED"],
  READY: ["RENDERING", "FAILED", "CANCELLED"],
  RENDERING: ["RENDERED", "FAILED"],
  RENDERED: ["PUBLISHING", "FAILED", "CANCELLED"],
  // PUBLISHING → RENDERED só para "devolver" a vez quando nada foi enviado à Meta (ex.: circuito aberto).
  PUBLISHING: ["PUBLISHED", "PUBLISHED_SIMULATED", "FAILED", "RENDERED"],
  PUBLISHED: [],
  PUBLISHED_SIMULATED: [],
  // FAILED → READY: reprocessamento manual, permitido apenas se nada foi publicado.
  FAILED: ["READY", "CANCELLED"],
  CANCELLED: [],
};

export const TERMINAL_STATUSES: readonly PostStatus[] = [
  "PUBLISHED",
  "PUBLISHED_SIMULATED",
  "CANCELLED",
];

export function canTransition(from: PostStatus, to: PostStatus): boolean {
  return POST_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: PostStatus, to: PostStatus): void {
  if (!canTransition(from, to)) throw new Error(`INVALID_POST_TRANSITION ${from} -> ${to}`);
}

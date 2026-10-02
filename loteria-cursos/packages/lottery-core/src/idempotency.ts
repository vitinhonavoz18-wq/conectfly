/**
 * Chave de idempotência: o "número do pedido" de cada post.
 * Ex.: result:megasena:3065:feed — se o mesmo pedido chegar duas vezes, o banco
 * recusa o segundo (UNIQUE) e nada é publicado em dobro.
 * Posts de simulação (dry-run) recebem o sufixo ":dryrun" para nunca bloquearem
 * a publicação real do mesmo concurso no futuro.
 */
export const POST_FORMATS = ["feed", "story", "reel"] as const;
export type PostFormat = (typeof POST_FORMATS)[number];

export interface IdempotencyInput {
  contentType: string;
  game: string;
  contest: number;
  format: PostFormat;
  variant?: number;
  dryRun?: boolean;
}

const SLUG = /^[a-z0-9_]+$/;

export function buildIdempotencyKey(input: IdempotencyInput): string {
  const type = input.contentType.toLowerCase();
  if (!SLUG.test(type)) throw new Error(`tipo de conteúdo inválido: ${input.contentType}`);
  if (!SLUG.test(input.game)) throw new Error(`modalidade inválida: ${input.game}`);
  if (!Number.isSafeInteger(input.contest) || input.contest < 1)
    throw new Error(`concurso inválido: ${input.contest}`);
  if (!POST_FORMATS.includes(input.format)) throw new Error(`formato inválido: ${input.format}`);
  const parts = [type, input.game, String(input.contest), input.format];
  if (input.variant !== undefined) {
    if (!Number.isInteger(input.variant) || input.variant < 1) throw new Error("variante inválida");
    parts.push(`v${input.variant}`);
  }
  if (input.dryRun) parts.push("dryrun");
  return parts.join(":");
}

export function parseIdempotencyKey(key: string): IdempotencyInput | null {
  const m = /^([a-z0-9_]+):([a-z0-9_]+):(\d+):(feed|story|reel)(?::v(\d+))?(:dryrun)?$/.exec(key);
  if (!m) return null;
  return {
    contentType: (m[1] as string).toUpperCase(),
    game: m[2] as string,
    contest: Number(m[3]),
    format: m[4] as PostFormat,
    ...(m[5] ? { variant: Number(m[5]) } : {}),
    dryRun: Boolean(m[6]),
  };
}

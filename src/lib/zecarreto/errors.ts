/**
 * Erros do ZÉ CARRETO.
 *
 * Todo erro tem um código estável (`ZC_...`), uma mensagem em português
 * que pode aparecer na tela do usuário e um status HTTP. Assim o app
 * mostra a mensagem certa sem precisar adivinhar o que deu errado.
 */

export type ZcErrorCode =
  | "ZC_UNAUTHENTICATED"
  | "ZC_FORBIDDEN"
  | "ZC_NOT_FOUND"
  | "ZC_VALIDATION"
  | "ZC_CONFLICT"
  | "ZC_INVALID_TRANSITION"
  | "ZC_RIDE_TAKEN"
  | "ZC_OFFER_EXPIRED"
  | "ZC_OFFER_NOT_PENDING"
  | "ZC_QUOTE_EXPIRED"
  | "ZC_PAYMENT_REQUIRED"
  | "ZC_DRIVER_NOT_APPROVED"
  | "ZC_NO_TARIFF"
  | "ZC_RATE_LIMITED"
  | "ZC_LEDGER_IMMUTABLE"
  | "ZC_INTERNAL";

const HTTP_STATUS: Record<ZcErrorCode, number> = {
  ZC_UNAUTHENTICATED: 401,
  ZC_FORBIDDEN: 403,
  ZC_NOT_FOUND: 404,
  ZC_VALIDATION: 422,
  ZC_CONFLICT: 409,
  ZC_INVALID_TRANSITION: 409,
  ZC_RIDE_TAKEN: 409,
  ZC_OFFER_EXPIRED: 410,
  ZC_OFFER_NOT_PENDING: 409,
  ZC_QUOTE_EXPIRED: 410,
  ZC_PAYMENT_REQUIRED: 402,
  ZC_DRIVER_NOT_APPROVED: 403,
  ZC_NO_TARIFF: 409,
  ZC_RATE_LIMITED: 429,
  ZC_LEDGER_IMMUTABLE: 409,
  ZC_INTERNAL: 500,
};

export class ZcError extends Error {
  readonly code: ZcErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ZcErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ZcError";
    this.code = code;
    this.status = HTTP_STATUS[code] ?? 500;
    this.details = details;
  }

  toJSON() {
    return { error: this.message, code: this.code, details: this.details };
  }
}

export const zcError = {
  unauthenticated: (msg = "Você precisa entrar na sua conta para continuar.") =>
    new ZcError("ZC_UNAUTHENTICATED", msg),
  forbidden: (msg = "Você não tem permissão para fazer isso.") => new ZcError("ZC_FORBIDDEN", msg),
  notFound: (msg = "Não encontramos o que você procura.") => new ZcError("ZC_NOT_FOUND", msg),
  validation: (msg: string, details?: unknown) => new ZcError("ZC_VALIDATION", msg, details),
  conflict: (msg: string, details?: unknown) => new ZcError("ZC_CONFLICT", msg, details),
  internal: (msg = "Tivemos um problema aqui do nosso lado. Tente de novo.", details?: unknown) =>
    new ZcError("ZC_INTERNAL", msg, details),
};

/**
 * Traduz o erro cru do banco para um erro nosso.
 * O banco fala em código de exceção; o usuário precisa ler português.
 */
export function fromPostgresError(error: { message?: string; code?: string } | null): ZcError {
  const message = error?.message ?? "";
  if (message.includes("ZC_INVALID_TRANSITION")) {
    return new ZcError("ZC_INVALID_TRANSITION", "Esta etapa não pode ser feita agora.", message);
  }
  if (message.includes("ZC_RIDE_TAKEN")) {
    return new ZcError("ZC_RIDE_TAKEN", "Outro motorista aceitou este carreto primeiro.");
  }
  if (message.includes("ZC_OFFER_EXPIRED")) {
    return new ZcError("ZC_OFFER_EXPIRED", "O tempo para aceitar este carreto acabou.");
  }
  if (message.includes("ZC_OFFER_NOT_PENDING")) {
    return new ZcError("ZC_OFFER_NOT_PENDING", "Esta oferta já foi respondida.");
  }
  if (message.includes("ZC_OFFER_FORBIDDEN")) {
    return new ZcError("ZC_FORBIDDEN", "Esta oferta não é sua.");
  }
  if (message.includes("ZC_OFFER_NOT_FOUND")) {
    return new ZcError("ZC_NOT_FOUND", "Oferta não encontrada.");
  }
  if (message.includes("ZC_LEDGER_IMMUTABLE")) {
    return new ZcError("ZC_LEDGER_IMMUTABLE", "Lançamentos financeiros não podem ser alterados.");
  }
  if (error?.code === "23505") {
    return new ZcError("ZC_CONFLICT", "Este registro já existe.", message);
  }
  if (error?.code === "23503") {
    return new ZcError(
      "ZC_VALIDATION",
      "Um dado obrigatório aponta para algo que não existe.",
      message,
    );
  }
  if (error?.code === "23514") {
    return new ZcError(
      "ZC_VALIDATION",
      "Os dados enviados não passam nas regras do sistema.",
      message,
    );
  }
  return zcError.internal("Erro ao falar com o banco de dados.", message);
}

export function isZcError(value: unknown): value is ZcError {
  return value instanceof ZcError;
}

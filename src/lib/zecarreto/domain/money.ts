/**
 * Dinheiro em CENTAVOS, sempre número inteiro.
 *
 * Guardar preço como número quebrado (10,55) faz o computador errar
 * frações de centavo e, no fim do mês, a conta não fecha. Trabalhando em
 * centavos inteiros (1055) isso nunca acontece.
 */

export type Cents = number;

export function assertCents(value: number, field = "valor"): Cents {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new TypeError(`${field} precisa ser um número inteiro de centavos (recebido: ${value})`);
  }
  return value;
}

/** Arredonda meio centavo para cima, como faz a calculadora do caixa. */
export function roundCents(value: number): Cents {
  return Math.round(value);
}

/** Percentual sobre um valor: pctOf(10000, 35) = 3500 (35% de R$ 100,00). */
export function pctOf(amount: Cents, percent: number): Cents {
  return roundCents(amount * (percent / 100));
}

/** Arredonda para o múltiplo mais próximo (ex.: step 50 = arredonda a cada R$ 0,50). */
export function roundToStep(amount: Cents, step: number): Cents {
  if (!step || step <= 1) return roundCents(amount);
  return Math.round(amount / step) * step;
}

export function sumCents(...values: Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}

/** Nunca deixa o valor ficar negativo (preço não pode ser menor que zero). */
export function clampPositive(value: Cents): Cents {
  return value < 0 ? 0 : value;
}

/** Divide um valor entre plataforma e motorista sem perder centavo. */
export function splitCommission(
  total: Cents,
  commissionPercent: number,
): { platformFeeCents: Cents; driverNetCents: Cents } {
  const platformFeeCents = clampPositive(Math.min(pctOf(total, commissionPercent), total));
  return { platformFeeCents, driverNetCents: total - platformFeeCents };
}

/** Formata para exibição: 1055 -> "R$ 10,55". */
export function formatBRL(cents: Cents): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/**
 * O desconto que o restaurante dá a quem aceita receber ofertas.
 *
 * O valor chega do FlyControl dentro de `site_settings`, o mesmo pacote de
 * configurações que já traz `checkout_layout` e `entry_mode`. Não há
 * integração nova: ele viaja junto.
 *
 * REGRAS QUE NÃO SE NEGOCIAM
 *
 * 1. Sem configuração, o desconto é ZERO. Vazio, nulo, texto, número
 *    esquisito — tudo vira 0. É isso que impede o preço de uma loja mudar
 *    sozinho porque alguém digitou errado num campo do painel.
 *
 * 2. O teto é 50%. Não porque 60% seja impossível, mas porque um zero a mais
 *    digitado sem querer ("500" em vez de "50") não pode fazer a loja vender
 *    de graça. Caixa registradora boa não aceita troco maior que a nota.
 *
 * 3. Este arquivo só LÊ. Quem decide o número é o dono, no painel. O
 *    navegador do cliente nunca escolhe o próprio desconto — e o FlyControl
 *    confere de novo quando o pedido chega, com o número que ele mesmo tem
 *    guardado.
 */

export const DESCONTO_ACEITE_MAXIMO = 50;

export function normalizeDescontoAceite(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Meio por cento é o menor passo que faz sentido numa conta de restaurante.
  const arredondado = Math.round(n * 2) / 2;
  return Math.min(arredondado, DESCONTO_ACEITE_MAXIMO);
}

/** Lê a escolha do restaurante, sem quebrar se o campo não existir. */
export function descontoAceiteOf(
  restaurant: { site_settings?: unknown } | null | undefined,
): number {
  const settings = restaurant?.site_settings as Record<string, unknown> | null | undefined;
  return normalizeDescontoAceite(settings?.marketing_opt_in_discount_percent);
}

/**
 * Quanto sai de desconto, em reais, para um subtotal.
 *
 * O desconto incide só sobre os produtos, NUNCA sobre a taxa de entrega. A
 * taxa é dinheiro do entregador, não margem da loja — dar desconto nela é
 * tirar do bolso de quem levou a pizza.
 *
 * O arredondamento é para baixo, no centavo. Assim o cliente nunca vê um
 * centavo a mais de desconto do que a conta permite, e o total nunca fecha
 * com sobra de arredondamento.
 */
export function valorDoDescontoAceite(subtotal: number, percent: number): number {
  const p = normalizeDescontoAceite(percent);
  if (p <= 0 || !Number.isFinite(subtotal) || subtotal <= 0) return 0;
  return Math.floor(subtotal * p) / 100;
}

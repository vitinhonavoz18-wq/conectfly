/**
 * Qual modelo de checkout este estabelecimento escolheu.
 *
 * O valor chega do FlyControl dentro de `site_settings` — o mesmo pacote de
 * configurações do cardápio que já traz `entry_mode`, `combos_visibility` e
 * companhia. Não há integração nova: ele viaja junto.
 *
 * A regra mais importante está no fallback: vazio, nulo, ausente ou escrito
 * errado vira "lateral". É isso que impede o site de um cliente antigo mudar
 * de cara sozinho — só muda quem escolheu "central" de propósito no painel.
 */

export const CHECKOUT_LAYOUTS = ["lateral", "central"] as const;

export type CheckoutLayout = (typeof CHECKOUT_LAYOUTS)[number];

export const DEFAULT_CHECKOUT_LAYOUT: CheckoutLayout = "lateral";

export function normalizeCheckoutLayout(raw: unknown): CheckoutLayout {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  return (CHECKOUT_LAYOUTS as readonly string[]).includes(value)
    ? (value as CheckoutLayout)
    : DEFAULT_CHECKOUT_LAYOUT;
}

/** Lê a escolha a partir do restaurante, sem quebrar se o campo não existir. */
export function checkoutLayoutOf(restaurant: { site_settings?: unknown } | null | undefined) {
  const settings = restaurant?.site_settings as Record<string, unknown> | null | undefined;
  return normalizeCheckoutLayout(settings?.checkout_layout);
}

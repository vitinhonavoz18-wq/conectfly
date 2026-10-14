import { RESERVED_SITE_PATHS } from "./format";

/**
 * O ENDEREÇO QUE A PRÓPRIA LOJA ESCOLHE (conectfly.com.br/<endereço>)
 *
 * É a regra única do que pode ser endereço de loja. O FlyControl tem uma cópia
 * dela só para a tela responder na hora, enquanto o dono digita; quem decide
 * de verdade é este lado, no servidor, e a palavra final é do banco.
 *
 * Diferente do "nome curto" automático (`subdomainify`, que tira os traços),
 * aqui o traço é permitido: é com ele que a segunda loja de mesmo nome faz a
 * sua variação ("acaielove" ocupado → "acai-e-love" ou "acaielove-centro").
 */

export const STORE_ADDRESS_MIN = 3;
export const STORE_ADDRESS_MAX = 40;

const FORMATO = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Transforma o que o dono digitou em endereço: minúsculas, sem acento, espaço
 * vira traço, símbolo some, traços repetidos viram um só.
 *
 * "Açaí e Love" → "acai-e-love"; "  Pizza   da Nonna!! " → "pizza-da-nonna".
 */
export function normalizeStoreAddress(input: string | null | undefined): string {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_.]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .slice(0, STORE_ADDRESS_MAX)
    .replace(/-+$/, "");
}

export type StoreAddressProblem =
  "too_short" | "too_long" | "invalid_format" | "reserved" | "test_pattern";

/**
 * Endereço de teste (teste, teste-001, teste001…). É exatamente o tipo de
 * endereço que o dono quer abandonar — não faz sentido deixar escolher.
 */
export function isTestAddress(address: string): boolean {
  return /^teste(?:$|-|\d)/.test(address);
}

/**
 * Só o FORMATO (tamanho e caracteres). Não olha se é reservado nem se está
 * livre: isso depende de quem pede (a loja pode voltar a um endereço que já
 * foi dela).
 */
export function storeAddressFormatProblem(address: string): StoreAddressProblem | null {
  if (address.length < STORE_ADDRESS_MIN) return "too_short";
  if (address.length > STORE_ADDRESS_MAX) return "too_long";
  if (!FORMATO.test(address) || address.includes("--")) return "invalid_format";
  return null;
}

/** Nome que o sistema guarda para si (página interna) ou padrão de teste. */
export function storeAddressPolicyProblem(address: string): StoreAddressProblem | null {
  if (RESERVED_SITE_PATHS.includes(address)) return "reserved";
  if (isTestAddress(address)) return "test_pattern";
  return null;
}

/**
 * Variações para oferecer quando o nome está ocupado. Só gera candidatos; quem
 * confere se estão livres é o servidor.
 */
export function storeAddressVariations(
  base: string,
  extras: { city?: string | null } = {},
): string[] {
  const b = normalizeStoreAddress(base);
  if (!b) return [];
  const cidade = normalizeStoreAddress(extras.city ?? "").split("-")[0] ?? "";
  const semTraco = b.replace(/-/g, "");
  const candidatos = [
    cidade ? `${b}-${cidade}` : "",
    `${b}-oficial`,
    `${b}-delivery`,
    semTraco !== b ? semTraco : "",
    `${b}-2`,
    `${b}-3`,
  ];
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const c of candidatos) {
    const n = normalizeStoreAddress(c);
    if (!n || n === b || vistos.has(n)) continue;
    if (storeAddressFormatProblem(n) || storeAddressPolicyProblem(n)) continue;
    vistos.add(n);
    saida.push(n);
  }
  return saida;
}

/**
 * Para onde mandar quem chegou por um endereço que não é o atual da loja
 * (o endereço longo antigo, ou um nome que a loja usava antes). Devolve
 * `null` quando já está no endereço certo.
 */
export function storeRedirectTarget(
  requested: string,
  restaurant: { slug?: string | null; custom_subdomain?: string | null },
): string | null {
  const atual = (restaurant.custom_subdomain ?? "").trim() || (restaurant.slug ?? "").trim();
  if (!atual) return null;
  const pedido = requested
    .toLowerCase()
    .trim()
    .replace(/^\/+|\/+$/g, "");
  if (!pedido || pedido === atual.toLowerCase()) return null;
  return atual;
}

/**
 * O que veio na barra de endereço tem cara de endereço de loja? Barra a busca
 * antes de chegar ao banco quando vem com vírgula, parêntese, ponto etc. — o
 * filtro da busca é montado com esse texto, e um caractere desses mudaria o
 * sentido do filtro.
 */
export function looksLikeStoreAddress(identifier: string): boolean {
  return /^[a-z0-9-]{1,100}$/.test(identifier);
}

import {
  normalizeStoreAddress,
  storeAddressFormatProblem,
  storeAddressPolicyProblem,
  storeAddressVariations,
  type StoreAddressProblem,
} from "./storeAddress";
import { getPizzeriaPublicUrl } from "./format";

/**
 * Consulta e troca do endereço da loja, do lado do servidor.
 *
 * O cliente do banco entra por parâmetro (e não importado direto) para os
 * testes conseguirem simular o banco — inclusive duas lojas disputando o
 * mesmo nome — sem Postgres de verdade.
 *
 * QUEM GARANTE QUE NÃO HÁ DUPLICADO
 *
 * O caderno `store_addresses` (ver a migração 20261014120000). Cada endereço
 * que uma loja já usou — o longo, o curto atual e os curtos antigos — tem uma
 * linha só lá, com dono. A troca grava em `restaurants.custom_subdomain`, e um
 * gatilho do banco tenta registrar o nome no caderno na mesma operação: se
 * outra loja chegou antes, o banco recusa e nada é salvo. A conferência feita
 * aqui antes é só para a tela responder rápido; a trava é do banco.
 */

// O cliente do Supabase é tipado a partir de `types.ts`, que ainda não conhece
// a tabela nova. Este é o pedaço mínimo que usamos.
type Query = any;
export type AddressDb = { from: (table: string) => Query };

export type AddressStatus = "available" | "yours" | "current" | "taken" | StoreAddressProblem;

export type AddressCheck = {
  address: string;
  status: AddressStatus;
  /** Variações livres, só quando o nome pedido está ocupado ou bloqueado. */
  suggestions: string[];
};

export type StoreRow = {
  id: string;
  slug: string;
  custom_subdomain: string | null;
  city?: string | null;
};

/** Dono atual de um endereço no caderno, ou null se ninguém tem. */
export async function addressOwner(db: AddressDb, address: string): Promise<string | null> {
  const { data, error } = await db
    .from("store_addresses")
    .select("restaurant_id")
    .eq("address", address)
    .maybeSingle();
  if (error) throw error;
  return (data?.restaurant_id as string | undefined) ?? null;
}

/**
 * Endereço livre para uma loja NOVA (usado no cadastro automático). Confere o
 * caderno — que inclui os nomes antigos de outras lojas — e também a tabela de
 * lojas, por garantia.
 */
export async function addressIsFree(db: AddressDb, candidate: string): Promise<boolean> {
  try {
    if (await addressOwner(db, candidate)) return false;
  } catch (err) {
    // Caderno indisponível (ex.: migração ainda não aplicada). O cadastro de
    // loja nova não pode parar por isso: segue conferindo só a tabela de
    // lojas, como fazia antes. Com o caderno no ar, o próprio banco recusa
    // nome repetido de qualquer jeito.
    console.warn("[store-address] caderno indisponível, conferindo só restaurants", err);
  }
  const { data } = await db
    .from("restaurants")
    .select("id")
    .or(`custom_subdomain.eq.${candidate},slug.eq.${candidate}`)
    .limit(1);
  return !data || data.length === 0;
}

async function freeSuggestions(db: AddressDb, store: StoreRow, base: string): Promise<string[]> {
  const livres: string[] = [];
  for (const c of storeAddressVariations(base, { city: store.city })) {
    const dono = await addressOwner(db, c);
    if (!dono) livres.push(c);
    if (livres.length >= 3) break;
  }
  return livres;
}

/** Diz se `rawAddress` pode virar o endereço desta loja. */
export async function checkStoreAddress(
  db: AddressDb,
  store: StoreRow,
  rawAddress: string,
): Promise<AddressCheck> {
  const address = normalizeStoreAddress(rawAddress);
  const formato = storeAddressFormatProblem(address);
  if (formato) return { address, status: formato, suggestions: [] };

  if ((store.custom_subdomain ?? "").toLowerCase() === address) {
    return { address, status: "current", suggestions: [] };
  }

  const dono = await addressOwner(db, address);
  // Nome que já foi desta loja (o endereço longo, ou um curto antigo): ela
  // pode voltar a usá-lo. Vem antes da lista de reservados de propósito.
  if (dono === store.id) return { address, status: "yours", suggestions: [] };

  const politica = storeAddressPolicyProblem(address);
  if (politica) {
    return { address, status: politica, suggestions: await freeSuggestions(db, store, address) };
  }

  if (dono) {
    return { address, status: "taken", suggestions: await freeSuggestions(db, store, address) };
  }
  return { address, status: "available", suggestions: [] };
}

export type SetResult =
  | { ok: true; address: string; previous: string | null; public_url: string; changed: boolean }
  | { ok: false; address: string; status: AddressStatus; suggestions: string[] };

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "23505";
}

/**
 * Troca o endereço da loja. Só mexe na loja informada — quem chama já
 * descobriu QUAL loja é pelo vínculo com o FlyControl, nunca por um número
 * vindo do navegador.
 */
export async function setStoreAddress(
  db: AddressDb,
  store: StoreRow,
  rawAddress: string,
): Promise<SetResult> {
  const check = await checkStoreAddress(db, store, rawAddress);
  const { address } = check;

  if (check.status === "current") {
    return {
      ok: true,
      address,
      previous: store.custom_subdomain,
      public_url: getPizzeriaPublicUrl(store.slug, address),
      changed: false,
    };
  }
  if (check.status !== "available" && check.status !== "yours") {
    return { ok: false, address, status: check.status, suggestions: check.suggestions };
  }

  const { error } = await db
    .from("restaurants")
    .update({ custom_subdomain: address })
    .eq("id", store.id);

  if (error) {
    // Outra loja salvou o mesmo nome no meio do caminho: o banco recusou.
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        address,
        status: "taken",
        suggestions: await freeSuggestions(db, store, address),
      };
    }
    throw error;
  }

  return {
    ok: true,
    address,
    previous: store.custom_subdomain,
    public_url: getPizzeriaPublicUrl(store.slug, address),
    changed: true,
  };
}

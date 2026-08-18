/**
 * Carteira do motorista.
 *
 * Cada corrida concluída vira DOIS lançamentos: o valor cheio entra como
 * crédito e a comissão da plataforma sai como débito. O motorista vê a
 * conta inteira, sem mistério — como um extrato de banco, e não um
 * "sobrou tanto".
 *
 * Quando o pagamento é em dinheiro na mão, o caminho é o contrário: o
 * motorista já recebeu do cliente, então só a comissão é lançada como
 * dívida dele com a plataforma.
 */

import { zcAdmin } from "../db/client";
import { fromPostgresError, zcError } from "../errors";
import type { ZcTransactionKind, ZcTransactionStatus } from "../domain/enums";
import type { ZcRideRow, ZcWalletRow, ZcWalletTransactionRow } from "../db/types";
import { getNumberSetting } from "./settings.service";

export async function ensureWallet(driverId: string): Promise<ZcWalletRow> {
  const db = zcAdmin();
  const { data: existing } = await db
    .from("zc_wallets")
    .select("*")
    .eq("driver_id", driverId)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await db
    .from("zc_wallets")
    .insert({ driver_id: driverId })
    .select()
    .single();
  if (error) throw fromPostgresError(error);
  return data;
}

export async function getWallet(driverId: string): Promise<ZcWalletRow> {
  return ensureWallet(driverId);
}

export interface LedgerEntryInput {
  driverId: string;
  kind: ZcTransactionKind;
  amountCents: number;
  status?: ZcTransactionStatus;
  rideId?: string | null;
  payoutId?: string | null;
  description?: string;
  reference?: string;
  availableAt?: string | null;
}

/** Escreve uma linha no livro-caixa. Nunca edita, nunca apaga. */
export async function addLedgerEntry(input: LedgerEntryInput): Promise<ZcWalletTransactionRow> {
  if (!Number.isInteger(input.amountCents) || input.amountCents === 0) {
    throw zcError.validation("Lançamento precisa de um valor inteiro diferente de zero.");
  }
  const wallet = await ensureWallet(input.driverId);
  const { data, error } = await zcAdmin()
    .from("zc_wallet_transactions")
    .insert({
      wallet_id: wallet.id,
      driver_id: input.driverId,
      ride_id: input.rideId ?? null,
      payout_id: input.payoutId ?? null,
      kind: input.kind,
      status: input.status ?? "pending",
      amount_cents: input.amountCents,
      description: input.description ?? null,
      reference: input.reference ?? null,
      available_at: input.availableAt ?? null,
    })
    .select()
    .single();
  if (error) throw fromPostgresError(error);
  return data;
}

/** Credita o que o motorista ganhou na corrida concluída. */
export async function creditRideEarnings(ride: ZcRideRow): Promise<void> {
  if (!ride.driver_id) return;
  const holdDays = await getNumberSetting("wallet.hold_days");
  const availableAt = new Date(Date.now() + holdDays * 86_400_000).toISOString();

  const { data: payment } = await zcAdmin()
    .from("zc_payments")
    .select("method, status")
    .eq("ride_id", ride.id)
    .in("status", ["paid", "authorized", "partially_refunded"])
    .maybeSingle();
  const paidInCash = payment?.method === "cash";

  if (paidInCash) {
    // O motorista já está com o dinheiro: fica devendo só a comissão.
    if (ride.platform_fee_cents > 0) {
      await addLedgerEntry({
        driverId: ride.driver_id,
        rideId: ride.id,
        kind: "platform_commission",
        amountCents: -ride.platform_fee_cents,
        status: "available",
        description: `Comissão do carreto ${ride.code} (recebido em dinheiro)`,
      });
    }
    return;
  }

  await addLedgerEntry({
    driverId: ride.driver_id,
    rideId: ride.id,
    kind: "ride_earning",
    amountCents: ride.total_cents,
    status: "pending",
    availableAt,
    description: `Carreto ${ride.code}`,
  });

  if (ride.platform_fee_cents > 0) {
    await addLedgerEntry({
      driverId: ride.driver_id,
      rideId: ride.id,
      kind: "platform_commission",
      amountCents: -ride.platform_fee_cents,
      status: "pending",
      availableAt,
      description: `Comissão do carreto ${ride.code}`,
    });
  }
}

/** Corrida cancelada depois de creditada: cancela os lançamentos dela. */
export async function reverseRideEarnings(rideId: string): Promise<void> {
  const db = zcAdmin();
  const { data: entries } = await db
    .from("zc_wallet_transactions")
    .select("id, status")
    .eq("ride_id", rideId)
    .in("kind", ["ride_earning", "platform_commission"]);
  for (const entry of entries ?? []) {
    if (entry.status === "pending" || entry.status === "available") {
      await db.from("zc_wallet_transactions").update({ status: "cancelled" }).eq("id", entry.id);
    }
  }
}

/**
 * Passa para "disponível" tudo o que já maturou.
 * Roda uma vez por dia (tarefa agendada da FASE 2).
 */
export async function releaseMaturedEarnings(now = new Date()): Promise<number> {
  const { data, error } = await zcAdmin()
    .from("zc_wallet_transactions")
    .update({ status: "available" })
    .eq("status", "pending")
    .not("available_at", "is", null)
    .lte("available_at", now.toISOString())
    .select("id");
  if (error) throw fromPostgresError(error);
  return data?.length ?? 0;
}

export async function listTransactions(params: {
  driverId: string;
  limit?: number;
  offset?: number;
  status?: ZcTransactionStatus;
}) {
  const limit = params.limit ?? 30;
  const offset = params.offset ?? 0;
  let query = zcAdmin()
    .from("zc_wallet_transactions")
    .select("*")
    .eq("driver_id", params.driverId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (params.status) query = query.eq("status", params.status);
  const { data, error } = await query;
  if (error) throw fromPostgresError(error);
  return data ?? [];
}

/** Confere o saldo recalculando tudo pelo livro-caixa. */
export async function recomputeWallet(walletId: string): Promise<ZcWalletRow> {
  const { data, error } = await zcAdmin().rpc("zc_wallet_recompute", { _wallet_id: walletId });
  if (error) throw fromPostgresError(error);
  return data as ZcWalletRow;
}

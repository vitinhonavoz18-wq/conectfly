/**
 * Repasse semanal.
 *
 * Toda semana o sistema fecha a conta de cada motorista: soma o que está
 * disponível, gera UM repasse e lança a saída no livro-caixa. Fechar a
 * mesma semana duas vezes não paga em dobro — o banco não deixa.
 */

import { zcAdmin } from "../db/client";
import { fromPostgresError, zcError } from "../errors";
import type { ZcPayoutRow } from "../db/types";
import type { ZcCaller } from "../http/auth";
import { addLedgerEntry } from "./wallet.service";
import { getNumberSetting } from "./settings.service";
import { recordAudit } from "./audit.service";
import { notify } from "./notifications.service";

export interface PayoutPeriod {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

/** Semana fechada: da segunda anterior ao domingo passado, por padrão. */
export async function currentPayoutPeriod(reference = new Date()): Promise<PayoutPeriod> {
  const closeWeekday = await getNumberSetting("payout.close_weekday");
  const date = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()),
  );
  const day = date.getUTCDay();
  const daysSinceClose = (day - closeWeekday + 7) % 7;
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() - daysSinceClose - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/**
 * Fecha a semana para todos os motoristas com saldo disponível.
 * Devolve os repasses criados.
 */
export async function closeWeeklyPayouts(
  caller: ZcCaller | null,
  period?: PayoutPeriod,
): Promise<ZcPayoutRow[]> {
  const db = zcAdmin();
  const window = period ?? (await currentPayoutPeriod());
  const minimumCents = await getNumberSetting("payout.minimum_cents");

  // Lançamentos disponíveis que ainda não entraram em nenhum repasse.
  const { data: entries, error } = await db
    .from("zc_wallet_transactions")
    .select("id, driver_id, wallet_id, amount_cents, created_at")
    .eq("status", "available")
    .is("payout_id", null)
    .lte("created_at", `${window.end}T23:59:59.999Z`);
  if (error) throw fromPostgresError(error);

  const { data: alreadyPaid } = await db.from("zc_payout_items").select("transaction_id");
  const paidIds = new Set((alreadyPaid ?? []).map((item) => item.transaction_id));

  const byDriver = new Map<string, { walletId: string; entries: typeof entries }>();
  for (const entry of entries ?? []) {
    if (paidIds.has(entry.id)) continue;
    const bucket = byDriver.get(entry.driver_id) ?? { walletId: entry.wallet_id, entries: [] };
    bucket.entries!.push(entry);
    byDriver.set(entry.driver_id, bucket);
  }

  const created: ZcPayoutRow[] = [];

  for (const [driverId, bucket] of byDriver) {
    const netCents = bucket.entries!.reduce((total, entry) => total + entry.amount_cents, 0);
    if (netCents < minimumCents) continue; // acumula para a semana seguinte

    const { data: driver } = await db
      .from("zc_drivers")
      .select("pix_key, pix_key_type, profile_id")
      .eq("id", driverId)
      .maybeSingle();

    const { data: payout, error: payoutError } = await db
      .from("zc_payouts")
      .insert({
        driver_id: driverId,
        wallet_id: bucket.walletId,
        period_start: window.start,
        period_end: window.end,
        gross_cents: netCents,
        net_cents: netCents,
        status: "scheduled",
        pix_key: driver?.pix_key ?? null,
        pix_key_type: driver?.pix_key_type ?? null,
      })
      .select()
      .single();
    if (payoutError) {
      // Semana já fechada para este motorista: segue para o próximo.
      if (payoutError.code === "23505") continue;
      throw fromPostgresError(payoutError);
    }

    await db.from("zc_payout_items").insert(
      bucket.entries!.map((entry) => ({
        payout_id: payout.id,
        transaction_id: entry.id,
        amount_cents: entry.amount_cents,
      })),
    );
    await db
      .from("zc_wallet_transactions")
      .update({ payout_id: payout.id })
      .in(
        "id",
        bucket.entries!.map((entry) => entry.id),
      );

    // A saída do dinheiro da carteira também é uma linha do livro-caixa.
    await addLedgerEntry({
      driverId,
      payoutId: payout.id,
      kind: "payout",
      amountCents: -netCents,
      status: "available",
      description: `Repasse ${window.start} a ${window.end}`,
    });

    created.push(payout);

    if (driver?.profile_id) {
      await notify({
        profileId: driver.profile_id,
        type: "payout.scheduled",
        title: "Repasse programado",
        body: `Seu repasse de R$ ${(netCents / 100).toFixed(2).replace(".", ",")} está agendado.`,
        dedupeKey: `payout:${payout.id}:scheduled`,
      }).catch(() => undefined);
    }
  }

  await recordAudit({
    caller,
    action: "payout.close_week",
    entityTable: "zc_payouts",
    entityId: `${window.start}..${window.end}`,
    after: { created: created.length, period: window },
  });

  return created;
}

export async function markPayoutPaid(
  caller: ZcCaller,
  payoutId: string,
  externalId?: string,
): Promise<ZcPayoutRow> {
  const db = zcAdmin();
  const { data, error } = await db
    .from("zc_payouts")
    .update({
      status: "paid",
      processed_at: new Date().toISOString(),
      external_id: externalId ?? null,
    })
    .eq("id", payoutId)
    .in("status", ["scheduled", "processing"])
    .select()
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) throw zcError.conflict("Este repasse não está aguardando pagamento.");

  await db
    .from("zc_wallet_transactions")
    .update({ status: "settled", settled_at: new Date().toISOString() })
    .eq("payout_id", payoutId)
    .eq("kind", "payout");

  await recordAudit({
    caller,
    action: "payout.paid",
    entityTable: "zc_payouts",
    entityId: payoutId,
    after: data,
  });
  return data;
}

export async function markPayoutFailed(
  caller: ZcCaller,
  payoutId: string,
  reason: string,
): Promise<ZcPayoutRow> {
  const { data, error } = await zcAdmin()
    .from("zc_payouts")
    .update({ status: "failed", failed_at: new Date().toISOString(), failure_reason: reason })
    .eq("id", payoutId)
    .select()
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) throw zcError.notFound("Repasse não encontrado.");
  await recordAudit({
    caller,
    action: "payout.failed",
    entityTable: "zc_payouts",
    entityId: payoutId,
    after: { reason },
  });
  return data;
}

export async function listPayouts(params: { driverId?: string; limit?: number; offset?: number }) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  let query = zcAdmin()
    .from("zc_payouts")
    .select("*")
    .order("period_start", { ascending: false })
    .range(offset, offset + limit - 1);
  if (params.driverId) query = query.eq("driver_id", params.driverId);
  const { data, error } = await query;
  if (error) throw fromPostgresError(error);
  return data ?? [];
}

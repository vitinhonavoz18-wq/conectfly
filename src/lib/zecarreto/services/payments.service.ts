/**
 * Pagamentos.
 *
 * O sistema não fala com nenhum banco ou maquininha específica: fala com
 * um "provedor". Hoje existe o provedor manual (dinheiro/pix combinado
 * fora do app). Quando entrar Pix automático ou cartão, basta plugar
 * outro provedor aqui — o resto do sistema não muda.
 */

import { zcAdmin } from "../db/client";
import { fromPostgresError, zcError, ZcError } from "../errors";
import type { ZcPaymentMethod } from "../domain/enums";
import type { Json, ZcPaymentRow, ZcRideRow } from "../db/types";
import type { ZcCaller } from "../http/auth";
import { markRidePaid } from "./rides.service";
import { recordAudit } from "./audit.service";

export interface ChargeRequest {
  rideId: string;
  amountCents: number;
  method: ZcPaymentMethod;
  customerProfileId: string;
  idempotencyKey?: string;
}

export interface ChargeResult {
  providerPaymentId: string | null;
  status: "pending" | "authorized" | "paid" | "failed";
  payload?: Record<string, unknown>;
  /** Para Pix: o código copia-e-cola. Para cartão: a URL de confirmação. */
  checkout?: { kind: "pix_code" | "redirect"; value: string } | null;
}

export interface PaymentProvider {
  name: string;
  createCharge(request: ChargeRequest): Promise<ChargeResult>;
  refund(payment: ZcPaymentRow, amountCents: number): Promise<{ ok: boolean; payload?: unknown }>;
}

/**
 * Provedor manual: registra a intenção e espera alguém confirmar (o
 * próprio motorista recebendo em dinheiro, ou o admin conferindo o Pix).
 * Serve para a plataforma rodar antes de existir integração bancária.
 */
export const manualPaymentProvider: PaymentProvider = {
  name: "manual",
  async createCharge(request) {
    return {
      providerPaymentId: null,
      status: request.method === "cash" ? "authorized" : "pending",
      checkout: null,
      payload: { note: "Pagamento registrado manualmente." },
    };
  },
  async refund() {
    return { ok: true, payload: { note: "Estorno registrado manualmente." } };
  },
};

let provider: PaymentProvider = manualPaymentProvider;

export function setPaymentProvider(next: PaymentProvider) {
  provider = next;
}

export function getPaymentProvider(): PaymentProvider {
  return provider;
}

/** Cria a cobrança da corrida e coloca o carreto em "aguardando pagamento". */
export async function createPaymentForRide(
  caller: ZcCaller,
  ride: ZcRideRow,
  method: ZcPaymentMethod,
  idempotencyKey?: string,
): Promise<{ payment: ZcPaymentRow; checkout: ChargeResult["checkout"] }> {
  if (ride.customer_profile_id !== caller.profileId && !caller.isAdmin) {
    throw zcError.forbidden("Este carreto não é seu.");
  }
  if (ride.total_cents <= 0) {
    throw zcError.validation("Este carreto ainda não tem preço calculado.");
  }

  const db = zcAdmin();
  const { data: existing } = await db
    .from("zc_payments")
    .select("*")
    .eq("ride_id", ride.id)
    .in("status", ["pending", "authorized", "paid"])
    .maybeSingle();
  if (existing) {
    return { payment: existing, checkout: null };
  }

  const charge = await provider.createCharge({
    rideId: ride.id,
    amountCents: ride.total_cents,
    method,
    customerProfileId: ride.customer_profile_id,
    idempotencyKey,
  });

  const { data, error } = await db
    .from("zc_payments")
    .insert({
      ride_id: ride.id,
      customer_profile_id: ride.customer_profile_id,
      method,
      status: charge.status,
      amount_cents: ride.total_cents,
      currency: ride.currency,
      provider: provider.name,
      provider_payment_id: charge.providerPaymentId,
      provider_payload: (charge.payload ?? {}) as Json,
      idempotency_key: idempotencyKey ?? null,
      authorized_at: charge.status === "authorized" ? new Date().toISOString() : null,
      paid_at: charge.status === "paid" ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) throw fromPostgresError(error);

  await recordAudit({
    caller,
    action: "payment.create",
    entityTable: "zc_payments",
    entityId: data.id,
    after: { ride_id: ride.id, method, status: charge.status },
  });

  // Dinheiro na mão: o carreto já pode sair procurando motorista.
  if (charge.status === "paid" || (method === "cash" && charge.status === "authorized")) {
    await confirmPayment(data.id, { alreadyChecked: true });
  }

  return { payment: data, checkout: charge.checkout ?? null };
}

/**
 * Confirma o pagamento (chamado pelo retorno do provedor ou pelo admin).
 * Depois de confirmado, a corrida anda sozinha para "procurando motorista".
 */
export async function confirmPayment(
  paymentId: string,
  options: { alreadyChecked?: boolean } = {},
): Promise<ZcPaymentRow> {
  const db = zcAdmin();
  const { data: payment } = await db
    .from("zc_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) throw zcError.notFound("Pagamento não encontrado.");
  if (payment.status === "paid" && !options.alreadyChecked) return payment;

  const { data, error } = await db
    .from("zc_payments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", paymentId)
    .select()
    .single();
  if (error) throw fromPostgresError(error);

  if (data.ride_id) {
    await markRidePaid(data.ride_id).catch((rideError) => {
      // Pagamento é fato consumado; a corrida pode já ter mudado de etapa.
      console.error("[ZC] pagamento confirmado, mas a corrida não avançou:", rideError);
    });
  }
  return data;
}

export async function failPayment(paymentId: string, reason: string): Promise<ZcPaymentRow> {
  const { data, error } = await zcAdmin()
    .from("zc_payments")
    .update({ status: "failed", failed_at: new Date().toISOString(), failure_reason: reason })
    .eq("id", paymentId)
    .select()
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) throw zcError.notFound("Pagamento não encontrado.");
  return data;
}

export async function refundPayment(
  caller: ZcCaller,
  paymentId: string,
  amountCents?: number,
): Promise<ZcPaymentRow> {
  const db = zcAdmin();
  const { data: payment } = await db
    .from("zc_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) throw zcError.notFound("Pagamento não encontrado.");
  if (payment.status !== "paid" && payment.status !== "partially_refunded") {
    throw new ZcError("ZC_CONFLICT", "Só é possível estornar um pagamento já concluído.");
  }

  const refundCents = amountCents ?? payment.amount_cents - payment.refunded_cents;
  if (refundCents <= 0 || refundCents > payment.amount_cents - payment.refunded_cents) {
    throw zcError.validation("Valor de estorno inválido.");
  }

  const result = await provider.refund(payment, refundCents);
  if (!result.ok) throw zcError.internal("O provedor de pagamento recusou o estorno.");

  const totalRefunded = payment.refunded_cents + refundCents;
  const { data, error } = await db
    .from("zc_payments")
    .update({
      refunded_cents: totalRefunded,
      status: totalRefunded >= payment.amount_cents ? "refunded" : "partially_refunded",
      refunded_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .select()
    .single();
  if (error) throw fromPostgresError(error);

  await recordAudit({
    caller,
    action: "payment.refund",
    entityTable: "zc_payments",
    entityId: paymentId,
    before: { refunded_cents: payment.refunded_cents },
    after: { refunded_cents: totalRefunded },
  });
  return data;
}

export async function getPaymentForRide(rideId: string): Promise<ZcPaymentRow | null> {
  const { data } = await zcAdmin()
    .from("zc_payments")
    .select("*")
    .eq("ride_id", rideId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

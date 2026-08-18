/**
 * Notificações.
 *
 * A FASE 1 grava o aviso no banco (o app lê em tempo real) e deixa a porta
 * aberta para os canais externos — push, SMS, e-mail, WhatsApp — entrarem
 * depois sem mexer em quem chama. Trocar de fornecedor é trocar o
 * "carteiro", não a carta.
 */

import { zcAdmin } from "../db/client";
import { fromPostgresError } from "../errors";
import type { ZcNotificationChannel } from "../domain/enums";
import type { Json, ZcNotificationRow } from "../db/types";

export interface NotificationInput {
  profileId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  channel?: ZcNotificationChannel;
  rideId?: string | null;
  dedupeKey?: string | null;
}

export interface NotificationTransport {
  channel: ZcNotificationChannel;
  send(notification: ZcNotificationRow): Promise<void>;
}

const transports = new Map<ZcNotificationChannel, NotificationTransport>();

/** Liga um canal externo (ex.: push). Feito no arranque do servidor. */
export function registerNotificationTransport(transport: NotificationTransport) {
  transports.set(transport.channel, transport);
}

export async function notify(input: NotificationInput): Promise<ZcNotificationRow | null> {
  const channel = input.channel ?? "in_app";
  const { data, error } = await zcAdmin()
    .from("zc_notifications")
    .insert({
      profile_id: input.profileId,
      ride_id: input.rideId ?? null,
      channel,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      data: (input.data ?? {}) as Json,
      dedupe_key: input.dedupeKey ?? null,
      status: channel === "in_app" ? "sent" : "queued",
      sent_at: channel === "in_app" ? new Date().toISOString() : null,
    })
    .select()
    .maybeSingle();

  // Aviso repetido (mesma chave) não é erro: é só um aviso que já foi dado.
  if (error) {
    if (error.code === "23505") return null;
    throw fromPostgresError(error);
  }
  if (!data) return null;

  const transport = transports.get(channel);
  if (transport) {
    try {
      await transport.send(data);
      await zcAdmin()
        .from("zc_notifications")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", data.id);
    } catch (sendError) {
      await zcAdmin()
        .from("zc_notifications")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          error: sendError instanceof Error ? sendError.message : String(sendError),
        })
        .eq("id", data.id);
    }
  }

  return data;
}

export async function listNotifications(params: {
  profileId: string;
  onlyUnread?: boolean;
  limit?: number;
  offset?: number;
}) {
  const limit = params.limit ?? 30;
  const offset = params.offset ?? 0;
  let query = zcAdmin()
    .from("zc_notifications")
    .select("*")
    .eq("profile_id", params.profileId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (params.onlyUnread) query = query.is("read_at", null);
  const { data, error } = await query;
  if (error) throw fromPostgresError(error);
  return data ?? [];
}

export async function markNotificationsRead(profileId: string, ids?: string[]): Promise<number> {
  let query = zcAdmin()
    .from("zc_notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .is("read_at", null);
  if (ids?.length) query = query.in("id", ids);
  const { data, error } = await query.select("id");
  if (error) throw fromPostgresError(error);
  return data?.length ?? 0;
}

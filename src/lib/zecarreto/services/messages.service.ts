/**
 * Conversa do carreto (cliente ↔ carreteiro).
 *
 * Toda a conversa acontece DENTRO da plataforma. Ninguém precisa passar o
 * telefone pessoal, e se houver discussão depois ("mas eu avisei que a
 * portaria fechava às 18h"), está tudo registrado.
 *
 * A arquitetura já está pronta para virar um chat de verdade: as mensagens
 * chegam em tempo real pelo canal da corrida; o que falta é só a tela ficar
 * mais bonita e o aviso no celular.
 */

import { zcAdmin } from "../db/client";
import { fromPostgresError, zcError } from "../errors";
import type { ZcRole } from "../domain/enums";
import type { Json, ZcRideMessageRow } from "../db/types";
import type { ZcCaller } from "../http/auth";
import { primaryRole } from "../http/auth";
import { notify } from "./notifications.service";

/** Só quem está na corrida conversa nela. */
async function assertParticipant(caller: ZcCaller, rideId: string) {
  const { data: ride } = await zcAdmin()
    .from("zc_rides")
    .select("id, status, customer_profile_id, driver_id")
    .eq("id", rideId)
    .maybeSingle();
  if (!ride) throw zcError.notFound("Carreto não encontrado.");

  const isCustomer = ride.customer_profile_id === caller.profileId;
  const isDriver = !!caller.driverId && ride.driver_id === caller.driverId;
  if (!isCustomer && !isDriver && !caller.isAdmin) {
    throw zcError.forbidden("Esta conversa não é sua.");
  }
  return { ride, isCustomer, isDriver };
}

export async function listMessages(
  caller: ZcCaller,
  rideId: string,
  options: { after?: string; limit?: number } = {},
): Promise<ZcRideMessageRow[]> {
  await assertParticipant(caller, rideId);
  let query = zcAdmin()
    .from("zc_ride_messages")
    .select("*")
    .eq("ride_id", rideId)
    .order("created_at")
    .limit(options.limit ?? 100);
  if (options.after) query = query.gt("created_at", options.after);

  const { data, error } = await query;
  if (error) throw fromPostgresError(error);
  return data ?? [];
}

export async function sendMessage(
  caller: ZcCaller,
  rideId: string,
  body: string,
  attachments: string[] = [],
): Promise<ZcRideMessageRow> {
  const { ride, isCustomer } = await assertParticipant(caller, rideId);
  if (ride.status === "completed" || ride.status === "cancelled") {
    throw zcError.conflict("Este carreto já terminou. Abra um chamado no suporte, se precisar.");
  }

  const { data, error } = await zcAdmin()
    .from("zc_ride_messages")
    .insert({
      ride_id: rideId,
      sender_profile_id: caller.profileId,
      sender_role: primaryRole(caller) as ZcRole,
      is_system: false,
      body: body.trim(),
      attachments: attachments as unknown as Json,
    })
    .select()
    .single();
  if (error) throw fromPostgresError(error);

  // Avisa o outro lado. Quem mandou não recebe aviso da própria mensagem.
  const destinatario = isCustomer
    ? await driverProfileId(ride.driver_id)
    : ride.customer_profile_id;
  if (destinatario && destinatario !== caller.profileId) {
    await notify({
      profileId: destinatario,
      rideId,
      type: "ride.message",
      title: "Nova mensagem no carreto",
      body: body.slice(0, 120),
      channel: "push",
      dedupeKey: `message:${data.id}`,
    }).catch(() => undefined);
  }

  return data;
}

/** Recado automático do sistema ("o carreteiro chegou"). */
export async function sendSystemMessage(rideId: string, body: string): Promise<void> {
  const { error } = await zcAdmin()
    .from("zc_ride_messages")
    .insert({ ride_id: rideId, is_system: true, body });
  if (error) console.error("[ZC] recado do sistema falhou:", error.message);
}

export async function markMessagesRead(caller: ZcCaller, rideId: string): Promise<number> {
  await assertParticipant(caller, rideId);
  const { data, error } = await zcAdmin()
    .from("zc_ride_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("ride_id", rideId)
    .is("read_at", null)
    .neq("sender_profile_id", caller.profileId)
    .select("id");
  if (error) throw fromPostgresError(error);
  return data?.length ?? 0;
}

async function driverProfileId(driverId: string | null): Promise<string | null> {
  if (!driverId) return null;
  const { data } = await zcAdmin()
    .from("zc_drivers")
    .select("profile_id")
    .eq("id", driverId)
    .maybeSingle();
  return data?.profile_id ?? null;
}

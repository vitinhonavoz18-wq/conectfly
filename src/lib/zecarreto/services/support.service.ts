/**
 * Suporte: chamados e conversas.
 * O cliente ou o motorista abre um chamado; a equipe responde na mesma
 * linha do tempo. Cada chamado ganha um código curto (SUP-...) para citar
 * no telefone.
 */

import { zcAdmin } from "../db/client";
import { fromPostgresError, zcError } from "../errors";
import type { ZcTicketPriority, ZcTicketStatus } from "../domain/enums";
import type { Json, ZcSupportMessageRow, ZcSupportTicketRow } from "../db/types";
import type { ZcCaller } from "../http/auth";
import { notify } from "./notifications.service";
import { recordAudit } from "./audit.service";

export async function openTicket(
  caller: ZcCaller,
  input: {
    subject: string;
    category?: string;
    ride_id?: string;
    priority?: ZcTicketPriority;
    message: string;
  },
): Promise<{ ticket: ZcSupportTicketRow; message: ZcSupportMessageRow }> {
  const db = zcAdmin();
  const { data: ticket, error } = await db
    .from("zc_support_tickets")
    .insert({
      profile_id: caller.profileId,
      ride_id: input.ride_id ?? null,
      subject: input.subject,
      category: input.category ?? "general",
      priority: input.priority ?? "normal",
      status: "open",
    })
    .select()
    .single();
  if (error) throw fromPostgresError(error);

  const { data: message, error: messageError } = await db
    .from("zc_support_messages")
    .insert({
      ticket_id: ticket.id,
      author_profile_id: caller.profileId,
      is_staff: false,
      body: input.message,
    })
    .select()
    .single();
  if (messageError) throw fromPostgresError(messageError);

  await recordAudit({
    caller,
    action: "support.open",
    entityTable: "zc_support_tickets",
    entityId: ticket.id,
    after: { subject: input.subject, category: ticket.category },
  });

  return { ticket, message };
}

export async function addTicketMessage(
  caller: ZcCaller,
  ticketId: string,
  body: string,
  attachments?: string[],
): Promise<ZcSupportMessageRow> {
  const db = zcAdmin();
  const { data: ticket } = await db
    .from("zc_support_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) throw zcError.notFound("Chamado não encontrado.");
  if (ticket.profile_id !== caller.profileId && !caller.isAdmin) {
    throw zcError.forbidden("Este chamado não é seu.");
  }
  if (ticket.status === "closed") {
    throw zcError.conflict("Este chamado está encerrado. Abra um novo, por favor.");
  }

  const { data, error } = await db
    .from("zc_support_messages")
    .insert({
      ticket_id: ticketId,
      author_profile_id: caller.profileId,
      is_staff: caller.isAdmin,
      body,
      attachments: (attachments ?? []) as unknown as Json,
    })
    .select()
    .single();
  if (error) throw fromPostgresError(error);

  await db
    .from("zc_support_tickets")
    .update({ status: caller.isAdmin ? "pending_user" : "pending_support" })
    .eq("id", ticketId);

  if (caller.isAdmin && ticket.profile_id !== caller.profileId) {
    await notify({
      profileId: ticket.profile_id,
      type: "support.reply",
      title: "Resposta do suporte",
      body: `Seu chamado ${ticket.code} teve uma resposta.`,
      dedupeKey: `support:${data.id}`,
    }).catch(() => undefined);
  }
  return data;
}

export async function listTickets(
  caller: ZcCaller,
  params: { status?: ZcTicketStatus; limit?: number; offset?: number } = {},
) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  let query = zcAdmin()
    .from("zc_support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (!caller.isAdmin) query = query.eq("profile_id", caller.profileId);
  if (params.status) query = query.eq("status", params.status);
  const { data, error } = await query;
  if (error) throw fromPostgresError(error);
  return data ?? [];
}

export async function getTicket(caller: ZcCaller, ticketId: string) {
  const db = zcAdmin();
  const { data: ticket, error } = await db
    .from("zc_support_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!ticket) throw zcError.notFound("Chamado não encontrado.");
  if (ticket.profile_id !== caller.profileId && !caller.isAdmin) {
    throw zcError.forbidden("Este chamado não é seu.");
  }
  const { data: messages } = await db
    .from("zc_support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at");
  return { ...ticket, messages: messages ?? [] };
}

export async function updateTicket(
  caller: ZcCaller,
  ticketId: string,
  patch: { status?: ZcTicketStatus; priority?: ZcTicketPriority; assigned_to?: string | null },
): Promise<ZcSupportTicketRow> {
  const update: Partial<ZcSupportTicketRow> = { ...patch };
  if (patch.status === "resolved") update.resolved_at = new Date().toISOString();
  if (patch.status === "closed") update.closed_at = new Date().toISOString();

  const { data, error } = await zcAdmin()
    .from("zc_support_tickets")
    .update(update)
    .eq("id", ticketId)
    .select()
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) throw zcError.notFound("Chamado não encontrado.");

  await recordAudit({
    caller,
    action: "support.update",
    entityTable: "zc_support_tickets",
    entityId: ticketId,
    after: patch,
  });
  return data;
}

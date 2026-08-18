/**
 * Auditoria — o livro de ocorrências da plataforma.
 * Quem fez, o que fez, quando e de onde. Nunca apaga.
 */

import { zcAdmin } from "../db/client";
import type { Json } from "../db/types";
import type { ZcCaller } from "../http/auth";
import { primaryRole } from "../http/auth";

export interface AuditInput {
  caller?: ZcCaller | null;
  action: string;
  entityTable: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  const { caller } = input;
  const { error } = await zcAdmin()
    .from("zc_audit_logs")
    .insert({
      actor_profile_id: caller?.profileId || null,
      actor_role: caller ? primaryRole(caller) : null,
      action: input.action,
      entity_table: input.entityTable,
      entity_id: input.entityId ?? null,
      before: (input.before ?? null) as Json,
      after: (input.after ?? null) as Json,
      ip: caller?.ip ?? null,
      user_agent: caller?.userAgent ?? null,
      metadata: (input.metadata ?? {}) as Json,
    });
  if (error) {
    // Auditoria nunca derruba a operação principal — só avisa no log.
    console.error("[ZC] auditoria falhou:", error.message);
  }
}

export async function listAuditLogs(params: {
  entityTable?: string;
  entityId?: string;
  actorProfileId?: string;
  limit?: number;
  offset?: number;
}) {
  let query = zcAdmin()
    .from("zc_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 50) - 1);

  if (params.entityTable) query = query.eq("entity_table", params.entityTable);
  if (params.entityId) query = query.eq("entity_id", params.entityId);
  if (params.actorProfileId) query = query.eq("actor_profile_id", params.actorProfileId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

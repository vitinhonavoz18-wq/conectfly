/**
 * Histórico de alterações — o "livro de quem mexeu em quê".
 *
 * As linhas são escritas sozinhas pelo banco a cada alteração; aqui só se
 * lê. Dados sensíveis já entram mascarados no banco, então o histórico
 * nunca vira uma segunda cópia dos documentos de ninguém.
 */

import { zcAdmin } from "../db/client";
import { fromPostgresError } from "../errors";
import type { ZcRecordHistoryRow } from "../db/types";

export interface HistoryQuery {
  entityTable?: string;
  entityId?: string;
  changedBy?: string;
  limit?: number;
  offset?: number;
}

export async function listHistory(params: HistoryQuery): Promise<ZcRecordHistoryRow[]> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  let query = zcAdmin()
    .from("zc_record_history")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.entityTable) query = query.eq("entity_table", params.entityTable);
  if (params.entityId) query = query.eq("entity_id", params.entityId);
  if (params.changedBy) query = query.eq("changed_by", params.changedBy);

  const { data, error } = await query;
  if (error) throw fromPostgresError(error);
  return data ?? [];
}

const FIELD_LABELS: Record<string, string> = {
  full_name: "Nome",
  phone: "Telefone",
  email: "E-mail",
  document_number: "CPF/CNPJ",
  avatar_url: "Foto de perfil",
  status: "Status",
  availability: "Disponibilidade",
  cnh_number: "Número da CNH",
  cnh_expires_at: "Validade da CNH",
  pix_key: "Chave PIX",
  pix_key_type: "Tipo da chave PIX",
  plate: "Placa",
  brand: "Marca",
  model: "Modelo",
  model_year: "Ano",
  capacity_kg: "Capacidade (kg)",
  category_id: "Categoria",
  photos: "Fotos",
  notes: "Observações",
  rejection_reason: "Motivo da recusa",
  current_vehicle_id: "Veículo em uso",
};

/** Deixa o histórico legível para quem não é programador. */
export function describeHistoryEntry(entry: ZcRecordHistoryRow): string {
  const field = FIELD_LABELS[entry.field] ?? entry.field;
  if (!entry.old_value) return `${field} preenchido`;
  if (!entry.new_value) return `${field} apagado`;
  return `${field} alterado`;
}

/**
 * "Meus veículos".
 *
 * Um motorista pode ter vários — a Saveiro do dia a dia e o caminhão do
 * fim de semana, por exemplo. Cada veículo é analisado separadamente, e o
 * motorista só recebe carretos da categoria de um veículo APROVADO.
 */

import { zcAdmin } from "../db/client";
import { fromPostgresError, zcError } from "../errors";
import type { ZcVehicleStatus } from "../domain/enums";
import { vehicleChecklist } from "../domain/onboarding";
import type { Json, ZcDocumentRow, ZcVehicleRow } from "../db/types";
import type { ZcCaller } from "../http/auth";
import type { VehicleInput } from "../validation";
import { getNumberSetting, getSetting } from "./settings.service";
import { recordAudit } from "./audit.service";
import { notify } from "./notifications.service";

export interface VehicleWithDocuments extends ZcVehicleRow {
  documents: ZcDocumentRow[];
  checklist: ReturnType<typeof vehicleChecklist>;
}

export async function listVehiclesWithDocuments(driverId: string): Promise<VehicleWithDocuments[]> {
  const db = zcAdmin();
  const { data: vehicles, error } = await db
    .from("zc_vehicles")
    .select("*")
    .eq("driver_id", driverId)
    .is("deleted_at", null)
    .order("created_at");
  if (error) throw fromPostgresError(error);
  if (!vehicles?.length) return [];

  const { data: documents } = await db
    .from("zc_documents")
    .select("*")
    .in(
      "vehicle_id",
      vehicles.map((vehicle) => vehicle.id),
    )
    .is("deleted_at", null);

  const [requiredDocs, minPhotos] = await Promise.all([
    getSetting<string[]>("onboarding.required_vehicle_documents", ["crlv"]),
    getNumberSetting("onboarding.min_vehicle_photos"),
  ]);

  return vehicles.map((vehicle) => {
    const vehicleDocs = (documents ?? []).filter((doc) => doc.vehicle_id === vehicle.id);
    return {
      ...vehicle,
      documents: vehicleDocs,
      checklist: vehicleChecklist({
        vehicle,
        documents: vehicleDocs,
        requiredVehicleDocuments: requiredDocs,
        minVehiclePhotos: minPhotos,
      }),
    };
  });
}

export async function getVehicle(vehicleId: string): Promise<ZcVehicleRow> {
  const { data, error } = await zcAdmin()
    .from("zc_vehicles")
    .select("*")
    .eq("id", vehicleId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) throw zcError.notFound("Veículo não encontrado.");
  return data;
}

export async function assertOwnsVehicle(
  caller: ZcCaller,
  vehicleId: string,
): Promise<ZcVehicleRow> {
  const vehicle = await getVehicle(vehicleId);
  if (caller.isAdmin) return vehicle;
  if (!caller.driverId || vehicle.driver_id !== caller.driverId) {
    throw zcError.forbidden("Este veículo não é seu.");
  }
  return vehicle;
}

export interface VehicleUpsertInput extends VehicleInput {
  photos?: string[];
  notes?: string;
}

export async function createVehicle(
  caller: ZcCaller,
  driverId: string,
  input: VehicleUpsertInput,
): Promise<ZcVehicleRow> {
  const db = zcAdmin();
  const { photos, notes, ...vehicle } = input;

  const { data, error } = await db
    .from("zc_vehicles")
    .insert({
      ...vehicle,
      driver_id: driverId,
      photos: (photos ?? []) as unknown as Json,
      notes: notes ?? null,
      status: "pending",
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      throw zcError.conflict("Esta placa já está cadastrada na plataforma.");
    }
    throw fromPostgresError(error);
  }

  // Primeiro veículo vira o veículo em uso assim que for aprovado.
  await recordAudit({
    caller,
    action: "vehicle.create",
    entityTable: "zc_vehicles",
    entityId: data.id,
    after: { plate: data.plate, category_id: data.category_id },
  });
  return data;
}

/**
 * Editar um veículo já aprovado o devolve para análise: se a placa ou a
 * categoria mudaram, o que foi aprovado não é mais o que está lá.
 */
export async function updateVehicle(
  caller: ZcCaller,
  vehicleId: string,
  input: Partial<VehicleUpsertInput>,
): Promise<ZcVehicleRow> {
  const current = await assertOwnsVehicle(caller, vehicleId);
  const { photos, notes, ...rest } = input;

  const patch: Partial<ZcVehicleRow> = { ...rest };
  if (photos !== undefined) patch.photos = photos as unknown as Json;
  if (notes !== undefined) patch.notes = notes;

  const significantChange =
    (rest.plate !== undefined && rest.plate !== current.plate) ||
    (rest.category_id !== undefined && rest.category_id !== current.category_id) ||
    (rest.model_year !== undefined && rest.model_year !== current.model_year);

  if (significantChange && current.status === "approved" && !caller.isAdmin) {
    patch.status = "pending";
    patch.rejection_reason = null;
    patch.reviewed_at = null;
  }

  const { data, error } = await zcAdmin()
    .from("zc_vehicles")
    .update(patch)
    .eq("id", vehicleId)
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      throw zcError.conflict("Esta placa já está cadastrada na plataforma.");
    }
    throw fromPostgresError(error);
  }
  if (!data) throw zcError.notFound("Veículo não encontrado.");

  await recordAudit({
    caller,
    action: "vehicle.update",
    entityTable: "zc_vehicles",
    entityId: vehicleId,
    before: { status: current.status },
    after: { ...patch, voltou_para_analise: significantChange },
  });
  return data;
}

/** Tira o veículo de circulação sem apagar o histórico dele. */
export async function deactivateVehicle(
  caller: ZcCaller,
  vehicleId: string,
): Promise<ZcVehicleRow> {
  await assertOwnsVehicle(caller, vehicleId);
  const { data, error } = await zcAdmin()
    .from("zc_vehicles")
    .update({ status: "inactive", active: false })
    .eq("id", vehicleId)
    .select()
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) throw zcError.notFound("Veículo não encontrado.");

  await recordAudit({
    caller,
    action: "vehicle.deactivate",
    entityTable: "zc_vehicles",
    entityId: vehicleId,
  });
  return data;
}

/** Marca qual veículo está em uso (precisa estar aprovado). */
export async function setCurrentVehicle(
  caller: ZcCaller,
  driverId: string,
  vehicleId: string,
): Promise<ZcVehicleRow> {
  const vehicle = await assertOwnsVehicle(caller, vehicleId);
  if (vehicle.status !== "approved") {
    throw zcError.conflict("Só dá para usar um veículo já aprovado.");
  }
  const { error } = await zcAdmin()
    .from("zc_drivers")
    .update({ current_vehicle_id: vehicleId })
    .eq("id", driverId);
  if (error) throw fromPostgresError(error);
  return vehicle;
}

/**
 * Análise do veículo pelo administrador.
 * Reprovar SEM motivo não é permitido: o motorista precisa saber o que
 * corrigir — recusar sem explicação só gera ligação para o suporte.
 */
export async function reviewVehicle(
  caller: ZcCaller,
  vehicleId: string,
  status: ZcVehicleStatus,
  reason?: string,
): Promise<ZcVehicleRow> {
  if ((status === "rejected" || status === "inactive") && !reason?.trim()) {
    throw zcError.validation("Informe o motivo para o motorista saber o que corrigir.");
  }

  const db = zcAdmin();
  const vehicle = await getVehicle(vehicleId);

  const { data, error } = await db
    .from("zc_vehicles")
    .update({
      status,
      rejection_reason: status === "approved" ? null : (reason ?? null),
      reviewed_at: new Date().toISOString(),
      verified_at: status === "approved" ? new Date().toISOString() : null,
      verified_by: caller.profileId,
      active: status === "approved",
    })
    .eq("id", vehicleId)
    .select()
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) throw zcError.notFound("Veículo não encontrado.");

  const { data: driver } = await db
    .from("zc_drivers")
    .select("profile_id, current_vehicle_id")
    .eq("id", vehicle.driver_id)
    .maybeSingle();

  if (driver) {
    if (status === "approved" && !driver.current_vehicle_id) {
      await db
        .from("zc_drivers")
        .update({ current_vehicle_id: vehicleId })
        .eq("id", vehicle.driver_id);
    }
    const messages: Record<string, { title: string; body: string }> = {
      approved: {
        title: "Veículo aprovado!",
        body: `${data.brand ?? "Seu veículo"} ${data.model ?? ""} (${data.plate}) já pode rodar.`,
      },
      rejected: {
        title: "Veículo não aprovado",
        body: reason ?? "Confira os dados e as fotos enviadas.",
      },
      inactive: {
        title: "Veículo inativado",
        body: reason ?? "Fale com o suporte para entender o motivo.",
      },
    };
    const message = messages[status];
    if (message) {
      await notify({
        profileId: driver.profile_id,
        type: `vehicle.${status}`,
        title: message.title,
        body: message.body,
        dedupeKey: `vehicle:${vehicleId}:${status}:${data.reviewed_at}`,
      }).catch(() => undefined);
    }
  }

  await recordAudit({
    caller,
    action: `vehicle.${status}`,
    entityTable: "zc_vehicles",
    entityId: vehicleId,
    before: { status: vehicle.status },
    after: { status, reason },
  });
  return data;
}

/** Fila de veículos aguardando análise (painel do admin). */
export async function listVehiclesForAdmin(params: {
  status?: ZcVehicleStatus;
  limit?: number;
  offset?: number;
}) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  let query = zcAdmin()
    .from("zc_vehicles")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (params.status) query = query.eq("status", params.status);
  const { data, error } = await query;
  if (error) throw fromPostgresError(error);
  return data ?? [];
}

/**
 * Motoristas / carreteiros: cadastro, veículos, documentos, disponibilidade
 * e posição no mapa.
 *
 * Ponto importante: o motorista NUNCA muda o próprio status de aprovação.
 * Ele envia documento e fica online; quem aprova é o administrador. É
 * como o crachá da empresa — quem usa não é quem emite.
 */

import { zcAdmin } from "../db/client";
import { fromPostgresError, zcError, ZcError } from "../errors";
import type { ZcDriverAvailability, ZcDriverStatus } from "../domain/enums";
import type { ZcDocumentRow, ZcDriverRow, ZcVehicleRow } from "../db/types";
import type { ZcCaller } from "../http/auth";
import type { LocationPingInput } from "../validation";
import { driverChecklist } from "../domain/onboarding";
import { getNumberSetting, getSetting } from "./settings.service";
import { currentTermsVersion, getProfile, hasAcceptedCurrentTerms } from "./account.service";
import { listVehiclesWithDocuments } from "./vehicles.service";
import { recordAudit } from "./audit.service";
import { notify } from "./notifications.service";
import { ensureWallet } from "./wallet.service";
import { createSignedDownload, ZC_BUCKET_DOCUMENTS } from "./storage.service";

export async function getDriverByProfile(profileId: string): Promise<ZcDriverRow | null> {
  const { data, error } = await zcAdmin()
    .from("zc_drivers")
    .select("*")
    .eq("profile_id", profileId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  return data;
}

/** Abre o cadastro de motorista (a aprovação vem depois, pelo admin). */
export async function registerDriver(
  caller: ZcCaller,
  input: {
    region_id?: string;
    cnh_number?: string;
    cnh_category?: string;
    cnh_expires_at?: string;
  },
): Promise<ZcDriverRow> {
  const existing = await getDriverByProfile(caller.profileId);
  if (existing) return existing;

  const db = zcAdmin();
  const { data, error } = await db
    .from("zc_drivers")
    .insert({
      profile_id: caller.profileId,
      region_id: input.region_id ?? null,
      cnh_number: input.cnh_number ?? null,
      cnh_category: input.cnh_category ?? null,
      cnh_expires_at: input.cnh_expires_at ?? null,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw fromPostgresError(error);

  await db
    .from("zc_user_roles")
    .upsert({ user_id: caller.profileId, role: "driver" }, { onConflict: "user_id,role" });
  await ensureWallet(data.id);

  await recordAudit({
    caller,
    action: "driver.register",
    entityTable: "zc_drivers",
    entityId: data.id,
    after: data,
  });
  return data;
}

/** Dados que o motorista pode editar sozinho — status não está na lista. */
export async function updateDriverProfile(
  caller: ZcCaller,
  driverId: string,
  patch: Partial<
    Pick<
      ZcDriverRow,
      | "region_id"
      | "pix_key"
      | "pix_key_type"
      | "cnh_number"
      | "cnh_category"
      | "cnh_expires_at"
      | "current_vehicle_id"
    >
  >,
): Promise<ZcDriverRow> {
  const { data, error } = await zcAdmin()
    .from("zc_drivers")
    .update(patch)
    .eq("id", driverId)
    .select()
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) throw zcError.notFound("Motorista não encontrado.");
  await recordAudit({
    caller,
    action: "driver.update",
    entityTable: "zc_drivers",
    entityId: driverId,
    after: patch,
  });
  return data;
}

/** Liga/desliga o motorista da fila de ofertas. */
export async function setAvailability(
  driverId: string,
  availability: ZcDriverAvailability,
): Promise<ZcDriverRow> {
  const db = zcAdmin();

  // Ficar online exige cadastro aprovado E veículo aprovado. Quem decide é
  // o banco (`zc_driver_can_go_online`), então a regra vale mesmo se um dia
  // alguém chamar isto por outro caminho.
  if (availability !== "offline") {
    const { data: allowed, error: checkError } = await db.rpc("zc_driver_can_go_online", {
      _driver_id: driverId,
    });
    if (checkError) throw fromPostgresError(checkError);
    if (!allowed) {
      const reason = await describeOnlineBlock(driverId);
      throw new ZcError("ZC_DRIVER_NOT_APPROVED", reason);
    }
  }

  const { data, error } = await db
    .from("zc_drivers")
    .update({
      availability,
      last_online_at: availability === "online" ? new Date().toISOString() : undefined,
    })
    .eq("id", driverId)
    .select()
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) throw zcError.notFound("Motorista não encontrado.");

  await db.from("zc_driver_locations").update({ availability }).eq("driver_id", driverId);
  return data;
}

/** Explica, em português, por que o motorista ainda não pode ficar online. */
export async function describeOnlineBlock(driverId: string): Promise<string> {
  const db = zcAdmin();
  const { data: driver } = await db
    .from("zc_drivers")
    .select("status, suspended_until")
    .eq("id", driverId)
    .maybeSingle();

  if (!driver) return "Cadastro de motorista não encontrado.";
  if (driver.status === "pending") {
    return "Termine o seu cadastro e envie os documentos para análise.";
  }
  if (driver.status === "under_review") {
    return "Seu cadastro está em análise. Assim que for aprovado, você poderá ficar online.";
  }
  if (driver.status === "rejected") {
    return "Seu cadastro não foi aprovado. Corrija o que foi apontado e envie de novo.";
  }
  if (driver.status === "suspended") {
    return "Seu cadastro está suspenso. Fale com o suporte.";
  }

  const { data: vehicles } = await db
    .from("zc_vehicles")
    .select("status")
    .eq("driver_id", driverId)
    .is("deleted_at", null);

  if (!vehicles?.length) return "Cadastre um veículo para poder ficar online.";
  if (!vehicles.some((vehicle) => vehicle.status === "approved")) {
    return "Nenhum veículo seu está aprovado ainda. Assim que um for aprovado, você poderá ficar online.";
  }
  return "Ainda não é possível ficar online. Fale com o suporte.";
}

/**
 * Recebe a posição do motorista.
 * Tem intervalo mínimo entre um sinal e outro para não afogar o banco —
 * como o relógio de ponto que não aceita duas batidas no mesmo minuto.
 */
export async function updateDriverLocation(
  driverId: string,
  input: LocationPingInput,
): Promise<{ accepted: boolean; reason?: string }> {
  const db = zcAdmin();
  const minInterval = await getNumberSetting("tracking.min_seconds_between_pings");
  const recordedAt = input.recorded_at ? new Date(input.recorded_at) : new Date();

  const { data: current } = await db
    .from("zc_driver_locations")
    .select("recorded_at, availability")
    .eq("driver_id", driverId)
    .maybeSingle();

  if (current) {
    const elapsed = (recordedAt.getTime() - new Date(current.recorded_at).getTime()) / 1000;
    if (elapsed < minInterval) {
      return { accepted: false, reason: "Sinal recebido cedo demais. Aguarde alguns segundos." };
    }
  }

  const { data: driver } = await db
    .from("zc_drivers")
    .select("availability")
    .eq("id", driverId)
    .maybeSingle();

  const { error } = await db.from("zc_driver_locations").upsert(
    {
      driver_id: driverId,
      ride_id: input.ride_id ?? null,
      lat: input.lat,
      lng: input.lng,
      heading: input.heading ?? null,
      speed_kmh: input.speed_kmh ?? null,
      accuracy_m: input.accuracy_m ?? null,
      availability: driver?.availability ?? "online",
      recorded_at: recordedAt.toISOString(),
    },
    { onConflict: "driver_id" },
  );
  if (error) throw fromPostgresError(error);

  // Durante a corrida guardamos a trilha, para o cliente acompanhar e
  // para o suporte conferir depois o que aconteceu.
  if (input.ride_id) {
    await db.from("zc_ride_tracking").insert({
      ride_id: input.ride_id,
      driver_id: driverId,
      lat: input.lat,
      lng: input.lng,
      heading: input.heading ?? null,
      speed_kmh: input.speed_kmh ?? null,
      recorded_at: recordedAt.toISOString(),
    });
  }

  return { accepted: true };
}

export async function listVehicles(driverId: string): Promise<ZcVehicleRow[]> {
  const { data, error } = await zcAdmin()
    .from("zc_vehicles")
    .select("*")
    .eq("driver_id", driverId)
    .is("deleted_at", null)
    .order("created_at");
  if (error) throw fromPostgresError(error);
  return data ?? [];
}

export async function submitDocument(
  caller: ZcCaller,
  driverId: string,
  input: {
    owner_kind: "driver" | "vehicle";
    vehicle_id?: string;
    type: ZcDocumentRow["type"];
    storage_path: string;
    file_name?: string;
    mime_type?: string;
    issued_at?: string;
    expires_at?: string;
  },
): Promise<ZcDocumentRow> {
  if (input.owner_kind === "vehicle" && !input.vehicle_id) {
    throw zcError.validation("Documento de veículo precisa dizer de qual veículo é.");
  }
  const db = zcAdmin();
  const { data, error } = await db
    .from("zc_documents")
    .insert({
      owner_kind: input.owner_kind,
      driver_id: input.owner_kind === "driver" ? driverId : null,
      vehicle_id: input.vehicle_id ?? null,
      type: input.type,
      storage_path: input.storage_path,
      file_name: input.file_name ?? null,
      mime_type: input.mime_type ?? null,
      issued_at: input.issued_at ?? null,
      expires_at: input.expires_at ?? null,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw fromPostgresError(error);

  // Documento enviado põe o cadastro na fila de análise.
  await db
    .from("zc_drivers")
    .update({ status: "under_review" })
    .eq("id", driverId)
    .eq("status", "pending");

  await recordAudit({
    caller,
    action: "document.submit",
    entityTable: "zc_documents",
    entityId: data.id,
    after: { type: input.type, owner_kind: input.owner_kind },
  });
  return data;
}

export async function listDocuments(driverId: string): Promise<ZcDocumentRow[]> {
  const db = zcAdmin();
  const { data: vehicles } = await db
    .from("zc_vehicles")
    .select("id")
    .eq("driver_id", driverId)
    .is("deleted_at", null);
  const vehicleIds = (vehicles ?? []).map((vehicle) => vehicle.id);

  const { data, error } = await db
    .from("zc_documents")
    .select("*")
    .is("deleted_at", null)
    .or(
      vehicleIds.length
        ? `driver_id.eq.${driverId},vehicle_id.in.(${vehicleIds.join(",")})`
        : `driver_id.eq.${driverId}`,
    )
    .order("created_at", { ascending: false });
  if (error) throw fromPostgresError(error);
  return data ?? [];
}

/** Admin analisa um documento. */
export async function reviewDocument(
  caller: ZcCaller,
  documentId: string,
  status: ZcDocumentRow["status"],
  rejectionReason?: string,
): Promise<ZcDocumentRow> {
  if (status === "rejected" && !rejectionReason?.trim()) {
    throw zcError.validation("Informe o motivo — o motorista precisa saber o que reenviar.");
  }

  const { data, error } = await zcAdmin()
    .from("zc_documents")
    .update({
      status,
      reviewed_by: caller.profileId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: status === "rejected" ? (rejectionReason ?? null) : null,
    })
    .eq("id", documentId)
    .select()
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) throw zcError.notFound("Documento não encontrado.");

  // Documento recusado sem aviso é documento que fica parado: o motorista
  // precisa saber para reenviar.
  if (status === "rejected" && data.driver_id) {
    const { data: driver } = await zcAdmin()
      .from("zc_drivers")
      .select("profile_id")
      .eq("id", data.driver_id)
      .maybeSingle();
    if (driver) {
      await notify({
        profileId: driver.profile_id,
        type: "document.rejected",
        title: "Documento não aprovado",
        body: rejectionReason ?? "Reenvie o documento para continuar.",
        dedupeKey: `document:${documentId}:rejected:${data.reviewed_at}`,
      }).catch(() => undefined);
    }
  }

  await recordAudit({
    caller,
    action: `document.${status}`,
    entityTable: "zc_documents",
    entityId: documentId,
    after: { status, rejectionReason },
  });
  return data;
}

/** Admin aprova, recusa ou suspende o motorista. */
export async function reviewDriver(
  caller: ZcCaller,
  driverId: string,
  status: ZcDriverStatus,
  options: { reason?: string; suspendedUntil?: string } = {},
): Promise<ZcDriverRow> {
  if ((status === "rejected" || status === "suspended") && !options.reason?.trim()) {
    throw zcError.validation(
      "Informe o motivo — o motorista precisa saber o que corrigir para voltar a rodar.",
    );
  }

  const db = zcAdmin();
  const patch: Partial<ZcDriverRow> = { status };
  if (status === "approved") {
    patch.approved_at = new Date().toISOString();
    patch.approved_by = caller.profileId;
    patch.rejection_reason = null;
  }
  if (status === "rejected") patch.rejection_reason = options.reason ?? null;
  if (status === "suspended") {
    patch.suspended_until = options.suspendedUntil ?? null;
    patch.availability = "offline";
    patch.rejection_reason = options.reason ?? null;
  }

  const { data, error } = await db
    .from("zc_drivers")
    .update(patch)
    .eq("id", driverId)
    .select()
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) throw zcError.notFound("Motorista não encontrado.");

  const messages: Partial<Record<ZcDriverStatus, { title: string; body: string }>> = {
    approved: {
      title: "Cadastro aprovado!",
      body: "Você já pode ficar online e receber carretos.",
    },
    rejected: {
      title: "Cadastro não aprovado",
      body: options.reason ?? "Confira os documentos enviados e tente de novo.",
    },
    suspended: {
      title: "Cadastro suspenso",
      body: options.reason ?? "Fale com o suporte para entender o motivo.",
    },
  };
  const message = messages[status];
  if (message) {
    await notify({
      profileId: data.profile_id,
      type: `driver.${status}`,
      title: message.title,
      body: message.body,
    }).catch(() => undefined);
  }

  await recordAudit({
    caller,
    action: `driver.${status}`,
    entityTable: "zc_drivers",
    entityId: driverId,
    after: patch,
  });
  return data;
}

export async function listDriversForAdmin(params: {
  status?: ZcDriverStatus;
  limit?: number;
  offset?: number;
}) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  let query = zcAdmin()
    .from("zc_drivers")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (params.status) query = query.eq("status", params.status);
  const { data, error } = await query;
  if (error) throw fromPostgresError(error);
  return data ?? [];
}

/**
 * Retrato completo do motorista — é o que a tela dele carrega de uma vez:
 * dados pessoais, documentos, veículos, o que falta e se pode ficar online.
 */
export async function getDriverSnapshot(caller: ZcCaller) {
  const db = zcAdmin();
  const driver = await getDriverByProfile(caller.profileId);
  const profile = await getProfile(caller.profileId);

  const driverVersion = await currentTermsVersion("driver");
  const acceptedTerms = await hasAcceptedCurrentTerms(caller.profileId, "driver");

  if (!driver) {
    return {
      driver: null,
      profile,
      documents: [],
      vehicles: [],
      terms: { current_version: driverVersion, accepted: acceptedTerms },
      checklist: null,
      canGoOnline: false,
      onlineBlockReason: "Abra o seu cadastro de motorista para começar.",
    };
  }

  const [documents, vehicles, requiredDriverDocs, requiredVehicleDocs, minPhotos] =
    await Promise.all([
      listDocuments(driver.id),
      listVehiclesWithDocuments(driver.id),
      getSetting<string[]>("onboarding.required_driver_documents", ["cnh", "selfie"]),
      getSetting<string[]>("onboarding.required_vehicle_documents", ["crlv"]),
      getNumberSetting("onboarding.min_vehicle_photos"),
    ]);

  const checklist = driverChecklist({
    profile: profile ?? {},
    driver,
    documents,
    vehicles,
    acceptedTerms,
    requiredDriverDocuments: requiredDriverDocs,
    requiredVehicleDocuments: requiredVehicleDocs,
    minVehiclePhotos: minPhotos,
  });

  const { data: canGoOnline } = await db.rpc("zc_driver_can_go_online", { _driver_id: driver.id });

  return {
    driver,
    profile,
    documents,
    vehicles,
    terms: { current_version: driverVersion, accepted: acceptedTerms },
    checklist,
    canGoOnline: !!canGoOnline,
    onlineBlockReason: canGoOnline ? null : await describeOnlineBlock(driver.id),
  };
}

/**
 * O motorista diz "terminei, pode analisar".
 * Só sai do lugar se o checklist estiver completo — senão a fila do
 * administrador enche de cadastro pela metade.
 */
export async function submitDriverForReview(caller: ZcCaller): Promise<ZcDriverRow> {
  const snapshot = await getDriverSnapshot(caller);
  if (!snapshot.driver) throw zcError.notFound("Abra o seu cadastro de motorista primeiro.");
  if (snapshot.driver.status === "approved") return snapshot.driver;
  if (snapshot.driver.status === "suspended") {
    throw zcError.forbidden("Cadastro suspenso. Fale com o suporte.");
  }
  if (!snapshot.checklist?.canSubmitForReview) {
    throw zcError.validation(
      `Ainda falta: ${snapshot.checklist?.pending.join(", ")}.`,
      snapshot.checklist?.pending,
    );
  }

  const { data, error } = await zcAdmin()
    .from("zc_drivers")
    .update({ status: "under_review", rejection_reason: null })
    .eq("id", snapshot.driver.id)
    .select()
    .single();
  if (error) throw fromPostgresError(error);

  await recordAudit({
    caller,
    action: "driver.submit_for_review",
    entityTable: "zc_drivers",
    entityId: data.id,
  });
  return data;
}

/**
 * Fila de documentos esperando análise, já com um link temporário para o
 * administrador abrir o arquivo. O link vence em minutos — conferir não é
 * o mesmo que ficar com uma cópia.
 */
export async function listDocumentsForAdmin(params: {
  status?: ZcDocumentRow["status"];
  limit?: number;
  offset?: number;
}) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  let query = zcAdmin()
    .from("zc_documents")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (params.status) query = query.eq("status", params.status);

  const { data, error } = await query;
  if (error) throw fromPostgresError(error);

  return Promise.all(
    (data ?? []).map(async (document) => ({
      ...document,
      view_url: await createSignedDownload(ZC_BUCKET_DOCUMENTS, document.storage_path, 300).catch(
        () => null,
      ),
    })),
  );
}

/**
 * Checklist do cadastro — o que ainda falta para o motorista rodar.
 *
 * Função pura: recebe o que já existe e devolve a lista de pendências.
 * Não conhece banco nem tela, por isso dá para testá-la sozinha e usá-la
 * nos dois lados (no servidor, para barrar; na tela, para mostrar).
 */

import type { ZcDocumentType, ZcDriverStatus } from "./enums";

export interface OnboardingProfile {
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  document_number?: string | null;
}

export interface OnboardingDriver {
  status: ZcDriverStatus;
  cnh_number?: string | null;
  cnh_expires_at?: string | null;
  pix_key?: string | null;
}

export interface OnboardingDocument {
  type: ZcDocumentType | string;
  status: string;
  owner_kind?: string;
  vehicle_id?: string | null;
  expires_at?: string | null;
}

export interface OnboardingVehicle {
  id: string;
  status: string;
  photos?: unknown;
}

export interface ChecklistStep {
  key: string;
  label: string;
  done: boolean;
  blocking: boolean;
  hint?: string;
}

export interface OnboardingResult {
  steps: ChecklistStep[];
  completedCount: number;
  totalCount: number;
  percent: number;
  /** Pode enviar o cadastro para análise? */
  canSubmitForReview: boolean;
  /** Pode ficar online e receber carretos? */
  canGoOnline: boolean;
  pending: string[];
}

export interface ClientOnboardingInput {
  profile: OnboardingProfile;
  acceptedTerms: boolean;
}

/** Cliente: o mínimo para pedir um carreto. Nada além disso. */
export function clientChecklist(input: ClientOnboardingInput): OnboardingResult {
  const { profile, acceptedTerms } = input;
  const steps: ChecklistStep[] = [
    {
      key: "name",
      label: "Nome completo",
      done: !!profile.full_name && profile.full_name.trim().split(/\s+/).length >= 2,
      blocking: true,
      hint: "Informe nome e sobrenome.",
    },
    {
      key: "phone",
      label: "Telefone com DDD",
      done: !!profile.phone,
      blocking: true,
      hint: "É por ele que o motorista fala com você.",
    },
    {
      key: "email",
      label: "E-mail",
      done: !!profile.email,
      blocking: true,
    },
    {
      key: "document",
      label: "CPF",
      done: !!profile.document_number,
      blocking: true,
      hint: "Necessário para emitir o recibo do carreto.",
    },
    {
      key: "terms",
      label: "Aceite dos termos de uso",
      done: acceptedTerms,
      blocking: true,
    },
  ];
  return summarize(steps, { canSubmit: true });
}

export interface DriverOnboardingInput {
  profile: OnboardingProfile;
  driver: OnboardingDriver;
  documents: OnboardingDocument[];
  vehicles: OnboardingVehicle[];
  acceptedTerms: boolean;
  requiredDriverDocuments: string[];
  requiredVehicleDocuments: string[];
  minVehiclePhotos: number;
  today?: Date;
}

/** Motorista: cadastro pessoal, documentos, dados de recebimento e veículo. */
export function driverChecklist(input: DriverOnboardingInput): OnboardingResult {
  const {
    profile,
    driver,
    documents,
    vehicles,
    acceptedTerms,
    requiredDriverDocuments,
    minVehiclePhotos,
    today = new Date(),
  } = input;

  const hasDoc = (type: string, approvedOnly = false) =>
    documents.some(
      (doc) =>
        doc.type === type &&
        doc.owner_kind !== "vehicle" &&
        (approvedOnly ? doc.status === "approved" : doc.status !== "rejected"),
    );

  const cnhValid =
    !!driver.cnh_expires_at && new Date(driver.cnh_expires_at).getTime() > today.getTime();

  const steps: ChecklistStep[] = [
    {
      key: "name",
      label: "Nome completo",
      done: !!profile.full_name && profile.full_name.trim().split(/\s+/).length >= 2,
      blocking: true,
    },
    { key: "document", label: "CPF", done: !!profile.document_number, blocking: true },
    { key: "phone", label: "Telefone com DDD", done: !!profile.phone, blocking: true },
    { key: "email", label: "E-mail", done: !!profile.email, blocking: true },
    {
      key: "cnh_number",
      label: "Número da CNH",
      done: !!driver.cnh_number,
      blocking: true,
    },
    {
      key: "cnh_expiry",
      label: "CNH dentro da validade",
      done: cnhValid,
      blocking: true,
      hint: "CNH vencida não permite dirigir — e não permite receber carreto.",
    },
    {
      key: "pix",
      label: "Chave PIX para receber",
      done: !!driver.pix_key,
      blocking: true,
      hint: "É para onde vai o repasse da semana.",
    },
    {
      key: "terms",
      label: "Aceite dos termos do motorista",
      done: acceptedTerms,
      blocking: true,
    },
    ...requiredDriverDocuments.map((type) => ({
      key: `doc:${type}`,
      label: documentLabel(type),
      done: hasDoc(type),
      blocking: true,
    })),
    {
      key: "vehicle",
      label: "Pelo menos um veículo cadastrado",
      done: vehicles.length > 0,
      blocking: true,
    },
    {
      key: "vehicle_photos",
      label: `Fotos do veículo (mínimo ${minVehiclePhotos})`,
      done: vehicles.some((vehicle) => photoCount(vehicle.photos) >= minVehiclePhotos),
      blocking: true,
    },
  ];

  const result = summarize(steps, { canSubmit: true });
  const hasApprovedVehicle = vehicles.some((vehicle) => vehicle.status === "approved");

  return {
    ...result,
    canGoOnline: driver.status === "approved" && hasApprovedVehicle,
  };
}

export function photoCount(photos: unknown): number {
  return Array.isArray(photos) ? photos.length : 0;
}

export interface VehicleChecklistInput {
  vehicle: {
    category_id?: string | null;
    plate?: string | null;
    brand?: string | null;
    model?: string | null;
    model_year?: number | null;
    capacity_kg?: number | null;
    photos?: unknown;
  };
  documents: OnboardingDocument[];
  requiredVehicleDocuments: string[];
  minVehiclePhotos: number;
}

/** Veículo: o que falta para ele poder ser aprovado. */
export function vehicleChecklist(input: VehicleChecklistInput): OnboardingResult {
  const { vehicle, documents, requiredVehicleDocuments, minVehiclePhotos } = input;
  const steps: ChecklistStep[] = [
    { key: "category", label: "Categoria", done: !!vehicle.category_id, blocking: true },
    { key: "plate", label: "Placa", done: !!vehicle.plate, blocking: true },
    { key: "brand", label: "Marca", done: !!vehicle.brand, blocking: true },
    { key: "model", label: "Modelo", done: !!vehicle.model, blocking: true },
    { key: "year", label: "Ano", done: !!vehicle.model_year, blocking: true },
    {
      key: "capacity",
      label: "Capacidade de carga (kg)",
      done: !!vehicle.capacity_kg,
      blocking: true,
    },
    {
      key: "photos",
      label: `Fotos do veículo (mínimo ${minVehiclePhotos})`,
      done: photoCount(vehicle.photos) >= minVehiclePhotos,
      blocking: true,
    },
    ...requiredVehicleDocuments.map((type) => ({
      key: `doc:${type}`,
      label: documentLabel(type),
      done: documents.some((doc) => doc.type === type && doc.status !== "rejected"),
      blocking: true,
    })),
  ];
  return summarize(steps, { canSubmit: true });
}

export function documentLabel(type: string): string {
  const labels: Record<string, string> = {
    cnh: "Foto da CNH",
    crlv: "Documento do veículo (CRLV)",
    selfie: "Selfie de verificação",
    profile_photo: "Foto de perfil",
    vehicle_photo: "Foto do veículo",
    proof_of_address: "Comprovante de endereço",
    criminal_record: "Certidão de antecedentes",
    bank_proof: "Comprovante bancário",
    other: "Outro documento",
  };
  return labels[type] ?? type;
}

function summarize(steps: ChecklistStep[], options: { canSubmit: boolean }): OnboardingResult {
  const completedCount = steps.filter((step) => step.done).length;
  const pending = steps.filter((step) => !step.done && step.blocking).map((step) => step.label);
  return {
    steps,
    completedCount,
    totalCount: steps.length,
    percent: steps.length ? Math.round((completedCount / steps.length) * 100) : 100,
    canSubmitForReview: options.canSubmit && pending.length === 0,
    canGoOnline: false,
    pending,
  };
}

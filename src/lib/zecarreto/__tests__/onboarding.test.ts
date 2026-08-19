import { describe, expect, test } from "bun:test";
import {
  clientChecklist,
  driverChecklist,
  documentLabel,
  photoCount,
  vehicleChecklist,
} from "../domain/onboarding";

const amanha = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

const perfilCompleto = {
  full_name: "Maria Souza",
  phone: "11999990001",
  email: "maria@email.com",
  document_number: "52998224725",
};

describe("checklist do cliente", () => {
  test("cliente completo pode seguir", () => {
    const result = clientChecklist({ profile: perfilCompleto, acceptedTerms: true });
    expect(result.canSubmitForReview).toBe(true);
    expect(result.percent).toBe(100);
    expect(result.pending).toHaveLength(0);
  });

  test("sem aceitar os termos, não segue", () => {
    const result = clientChecklist({ profile: perfilCompleto, acceptedTerms: false });
    expect(result.canSubmitForReview).toBe(false);
    expect(result.pending).toContain("Aceite dos termos de uso");
  });

  test("só o primeiro nome não vale como nome completo", () => {
    const result = clientChecklist({
      profile: { ...perfilCompleto, full_name: "Maria" },
      acceptedTerms: true,
    });
    expect(result.pending).toContain("Nome completo");
  });
});

const motoristaBase = {
  profile: perfilCompleto,
  driver: {
    status: "pending" as const,
    cnh_number: "12345678901",
    cnh_expires_at: amanha,
    pix_key: "52998224725",
  },
  documents: [
    { type: "cnh", status: "pending" },
    { type: "selfie", status: "pending" },
    { type: "proof_of_address", status: "pending" },
  ],
  vehicles: [{ id: "v1", status: "pending", photos: ["a.jpg", "b.jpg"] }],
  acceptedTerms: true,
  requiredDriverDocuments: ["cnh", "selfie", "proof_of_address"],
  requiredVehicleDocuments: ["crlv"],
  minVehiclePhotos: 2,
};

describe("checklist do motorista", () => {
  test("cadastro completo pode ir para análise", () => {
    const result = driverChecklist(motoristaBase);
    expect(result.canSubmitForReview).toBe(true);
    expect(result.pending).toHaveLength(0);
  });

  test("CNH vencida trava o cadastro", () => {
    const result = driverChecklist({
      ...motoristaBase,
      driver: { ...motoristaBase.driver, cnh_expires_at: ontem },
    });
    expect(result.canSubmitForReview).toBe(false);
    expect(result.pending).toContain("CNH dentro da validade");
  });

  test("sem chave PIX não dá para receber — logo, não segue", () => {
    const result = driverChecklist({
      ...motoristaBase,
      driver: { ...motoristaBase.driver, pix_key: null },
    });
    expect(result.pending).toContain("Chave PIX para receber");
  });

  test("documento recusado conta como não enviado", () => {
    const result = driverChecklist({
      ...motoristaBase,
      documents: [
        { type: "cnh", status: "rejected" },
        { type: "selfie", status: "pending" },
        { type: "proof_of_address", status: "pending" },
      ],
    });
    expect(result.pending).toContain("Foto da CNH");
  });

  test("sem veículo, não segue", () => {
    const result = driverChecklist({ ...motoristaBase, vehicles: [] });
    expect(result.pending).toContain("Pelo menos um veículo cadastrado");
  });

  test("poucas fotos do veículo travam", () => {
    const result = driverChecklist({
      ...motoristaBase,
      vehicles: [{ id: "v1", status: "pending", photos: ["a.jpg"] }],
    });
    expect(result.pending).toContain("Fotos do veículo (mínimo 2)");
  });

  test("só fica online com cadastro E veículo aprovados", () => {
    const semAprovacao = driverChecklist(motoristaBase);
    expect(semAprovacao.canGoOnline).toBe(false);

    const aprovadoSemVeiculo = driverChecklist({
      ...motoristaBase,
      driver: { ...motoristaBase.driver, status: "approved" },
      vehicles: [{ id: "v1", status: "pending", photos: ["a.jpg", "b.jpg"] }],
    });
    expect(aprovadoSemVeiculo.canGoOnline).toBe(false);

    const tudoAprovado = driverChecklist({
      ...motoristaBase,
      driver: { ...motoristaBase.driver, status: "approved" },
      vehicles: [{ id: "v1", status: "approved", photos: ["a.jpg", "b.jpg"] }],
    });
    expect(tudoAprovado.canGoOnline).toBe(true);
  });
});

describe("checklist do veículo", () => {
  const veiculoCompleto = {
    vehicle: {
      category_id: "cat",
      plate: "ABC1D23",
      brand: "Fiat",
      model: "Fiorino",
      model_year: 2020,
      capacity_kg: 650,
      photos: ["a.jpg", "b.jpg"],
    },
    documents: [{ type: "crlv", status: "pending" }],
    requiredVehicleDocuments: ["crlv"],
    minVehiclePhotos: 2,
  };

  test("veículo completo pode ser analisado", () => {
    expect(vehicleChecklist(veiculoCompleto).canSubmitForReview).toBe(true);
  });

  test("sem CRLV, não pode", () => {
    const result = vehicleChecklist({ ...veiculoCompleto, documents: [] });
    expect(result.pending).toContain("Documento do veículo (CRLV)");
  });

  test("sem capacidade informada, não pode", () => {
    const result = vehicleChecklist({
      ...veiculoCompleto,
      vehicle: { ...veiculoCompleto.vehicle, capacity_kg: null },
    });
    expect(result.pending).toContain("Capacidade de carga (kg)");
  });
});

describe("apoios", () => {
  test("conta fotos com segurança, mesmo com dado estranho", () => {
    expect(photoCount(["a", "b"])).toBe(2);
    expect(photoCount(null)).toBe(0);
    expect(photoCount("a.jpg")).toBe(0);
  });

  test("nome do documento sai em português", () => {
    expect(documentLabel("crlv")).toBe("Documento do veículo (CRLV)");
    expect(documentLabel("selfie")).toBe("Selfie de verificação");
  });
});

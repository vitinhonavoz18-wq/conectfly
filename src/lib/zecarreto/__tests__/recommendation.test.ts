import { describe, expect, test } from "bun:test";
import {
  recommendCategory,
  type CategoryCapacity,
  type ItemPreset,
} from "../domain/recommendation";

const presets: ItemPreset[] = [
  { code: "caixa_grande", name: "Caixa grande", volume_m3: 0.15, weight_kg: 18 },
  {
    code: "geladeira",
    name: "Geladeira",
    volume_m3: 0.8,
    weight_kg: 80,
    is_heavy: true,
    needs_two_people: true,
  },
  {
    code: "sofa_3",
    name: "Sofá de 3 lugares",
    volume_m3: 1.6,
    weight_kg: 60,
    is_heavy: true,
    needs_two_people: true,
  },
  {
    code: "guarda_roupa",
    name: "Guarda-roupa",
    volume_m3: 1.8,
    weight_kg: 90,
    is_heavy: true,
    needs_two_people: true,
  },
  {
    code: "cama_casal",
    name: "Cama de casal",
    volume_m3: 1.2,
    weight_kg: 60,
    is_heavy: true,
    needs_two_people: true,
  },
  { code: "pallet", name: "Palete", volume_m3: 1.0, weight_kg: 300, is_heavy: true },
];

const categorias: CategoryCapacity[] = [
  {
    id: "c1",
    slug: "pequeno",
    name: "Pequeno porte",
    max_weight_kg: 700,
    max_volume_m3: 2.5,
    sort_order: 1,
  },
  {
    id: "c2",
    slug: "medio",
    name: "Médio porte",
    max_weight_kg: 800,
    max_volume_m3: 3.5,
    sort_order: 2,
  },
  {
    id: "c3",
    slug: "bongo",
    name: "Bongo / HR",
    max_weight_kg: 1500,
    max_volume_m3: 12,
    sort_order: 3,
  },
  {
    id: "c4",
    slug: "caminhao",
    name: "Caminhão",
    max_weight_kg: 6000,
    max_volume_m3: 40,
    sort_order: 4,
  },
];

const recomendar = (selections: { code: string; quantity: number }[]) =>
  recommendCategory({ selections, presets, categories: categorias, packingSlackPct: 15 });

describe("recomendação de categoria", () => {
  test("pouca coisa cabe no menor veículo", () => {
    const resultado = recomendar([{ code: "caixa_grande", quantity: 5 }]);
    expect(resultado.categorySlug).toBe("pequeno");
    expect(resultado.itemCount).toBe(5);
  });

  test("mudança pequena já pede um veículo maior", () => {
    const resultado = recomendar([
      { code: "geladeira", quantity: 1 },
      { code: "sofa_3", quantity: 1 },
      { code: "cama_casal", quantity: 1 },
      { code: "caixa_grande", quantity: 10 },
    ]);
    expect(resultado.categorySlug).toBe("bongo");
  });

  test("mudança grande vai para o caminhão", () => {
    const resultado = recomendar([
      { code: "guarda_roupa", quantity: 3 },
      { code: "sofa_3", quantity: 2 },
      { code: "cama_casal", quantity: 3 },
      { code: "geladeira", quantity: 1 },
      { code: "caixa_grande", quantity: 40 },
    ]);
    expect(resultado.categorySlug).toBe("caminhao");
  });

  test("peso também decide, não só o espaço", () => {
    // Cinco paletes ocupam pouco espaço, mas pesam 1500 kg.
    const resultado = recomendar([{ code: "pallet", quantity: 5 }]);
    expect(resultado.totalWeightKg).toBe(1500);
    expect(["bongo", "caminhao"]).toContain(resultado.categorySlug ?? "");
  });

  test("a folga de encaixe é aplicada no volume", () => {
    const resultado = recomendar([{ code: "sofa_3", quantity: 1 }]);
    expect(resultado.totalVolumeM3).toBe(1.6);
    expect(resultado.effectiveVolumeM3).toBeCloseTo(1.84, 2);
  });

  test("carga maior que o maior veículo avisa em vez de mentir", () => {
    const resultado = recomendar([{ code: "pallet", quantity: 50 }]);
    expect(resultado.exceedsLargest).toBe(true);
    expect(resultado.categorySlug).toBe("caminhao");
    expect(resultado.reason).toContain("mais de uma viagem");
  });

  test("item que precisa de duas pessoas sugere ajudante", () => {
    expect(recomendar([{ code: "caixa_grande", quantity: 3 }]).suggestedHelpers).toBe(0);
    expect(recomendar([{ code: "geladeira", quantity: 1 }]).suggestedHelpers).toBe(1);
    expect(recomendar([{ code: "guarda_roupa", quantity: 4 }]).suggestedHelpers).toBe(2);
  });

  test("marca item pesado para o carreteiro vir preparado", () => {
    expect(recomendar([{ code: "caixa_grande", quantity: 2 }]).hasHeavyItems).toBe(false);
    const pesado = recomendar([{ code: "geladeira", quantity: 1 }]);
    expect(pesado.hasHeavyItems).toBe(true);
    expect(pesado.reason).toContain("item pesado");
  });

  test("sem itens marcados, explica o que fazer", () => {
    const resultado = recomendar([]);
    expect(resultado.categorySlug).toBe("pequeno");
    expect(resultado.reason).toContain("Marque o que você vai levar");
  });

  test("item desconhecido e quantidade zero são ignorados", () => {
    const resultado = recomendar([
      { code: "nao_existe", quantity: 10 },
      { code: "caixa_grande", quantity: 0 },
      { code: "caixa_grande", quantity: 2 },
    ]);
    expect(resultado.itemCount).toBe(2);
  });
});

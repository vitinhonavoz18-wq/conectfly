/**
 * "Não sei qual escolher" — recomendação de categoria.
 *
 * O cliente marca o que vai levar ("geladeira, sofá, 10 caixas") e a
 * função soma volume e peso para sugerir o menor veículo que dá conta. É
 * a mesma conta que o carreteiro experiente faz de cabeça; aqui ela está
 * escrita e o admin ajusta os números pela tela.
 *
 * A sugestão NUNCA decide sozinha: o cliente pode trocar a categoria na
 * mão, e é a escolha dele que vale.
 */

export interface ItemPreset {
  code: string;
  name: string;
  volume_m3: number;
  weight_kg: number;
  is_heavy?: boolean;
  needs_two_people?: boolean;
}

export interface CategoryCapacity {
  id: string;
  slug: string;
  name: string;
  max_weight_kg: number | null;
  max_volume_m3: number | null;
  sort_order: number;
}

export interface ItemSelection {
  code: string;
  quantity: number;
}

export interface Recommendation {
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  totalVolumeM3: number;
  totalWeightKg: number;
  /** Volume com a folga aplicada — carga não encaixa perfeita. */
  effectiveVolumeM3: number;
  suggestedHelpers: number;
  hasHeavyItems: boolean;
  itemCount: number;
  /** Explicação em português, para mostrar na tela. */
  reason: string;
  /** Verdadeiro quando nem o maior veículo dá conta numa viagem só. */
  exceedsLargest: boolean;
}

export interface RecommendationInput {
  selections: ItemSelection[];
  presets: ItemPreset[];
  categories: CategoryCapacity[];
  /** Folga sobre o volume somado, em percentual (padrão 15%). */
  packingSlackPct?: number;
}

export function recommendCategory(input: RecommendationInput): Recommendation {
  const { selections, presets, categories, packingSlackPct = 15 } = input;
  const byCode = new Map(presets.map((preset) => [preset.code, preset]));

  let totalVolumeM3 = 0;
  let totalWeightKg = 0;
  let itemCount = 0;
  let hasHeavyItems = false;
  let twoPeopleItems = 0;

  for (const selection of selections) {
    const preset = byCode.get(selection.code);
    if (!preset) continue;
    const quantity = Math.max(0, Math.floor(selection.quantity));
    if (!quantity) continue;

    itemCount += quantity;
    totalVolumeM3 += preset.volume_m3 * quantity;
    totalWeightKg += preset.weight_kg * quantity;
    if (preset.is_heavy) hasHeavyItems = true;
    if (preset.needs_two_people) twoPeopleItems += quantity;
  }

  const effectiveVolumeM3 = round3(totalVolumeM3 * (1 + packingSlackPct / 100));

  const ordered = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const fitting = ordered.find(
    (category) =>
      (category.max_volume_m3 === null || category.max_volume_m3 >= effectiveVolumeM3) &&
      (category.max_weight_kg === null || category.max_weight_kg >= totalWeightKg),
  );

  const chosen = fitting ?? ordered[ordered.length - 1] ?? null;
  const exceedsLargest = !fitting && ordered.length > 0;

  // Item que precisa de duas pessoas já sugere um ajudante; muitos deles,
  // dois. Continua sendo sugestão — quem decide é o cliente.
  const suggestedHelpers = twoPeopleItems === 0 ? 0 : twoPeopleItems <= 3 ? 1 : 2;

  return {
    categoryId: chosen?.id ?? null,
    categorySlug: chosen?.slug ?? null,
    categoryName: chosen?.name ?? null,
    totalVolumeM3: round3(totalVolumeM3),
    totalWeightKg: round3(totalWeightKg),
    effectiveVolumeM3,
    suggestedHelpers,
    hasHeavyItems,
    itemCount,
    exceedsLargest,
    reason: buildReason({
      itemCount,
      effectiveVolumeM3,
      totalWeightKg,
      chosenName: chosen?.name ?? null,
      exceedsLargest,
      hasHeavyItems,
      suggestedHelpers,
    }),
  };
}

function buildReason(input: {
  itemCount: number;
  effectiveVolumeM3: number;
  totalWeightKg: number;
  chosenName: string | null;
  exceedsLargest: boolean;
  hasHeavyItems: boolean;
  suggestedHelpers: number;
}): string {
  if (input.itemCount === 0) {
    return "Marque o que você vai levar e a gente sugere o veículo certo.";
  }
  if (!input.chosenName) {
    return "Não há categorias cadastradas para sugerir um veículo.";
  }
  const partes = [
    `${input.itemCount} ${input.itemCount === 1 ? "item" : "itens"}`,
    `cerca de ${formatVolume(input.effectiveVolumeM3)} de espaço`,
    `${Math.round(input.totalWeightKg)} kg`,
  ];
  let texto = `Pelo que você marcou (${partes.join(", ")}), o ${input.chosenName} dá conta.`;

  if (input.exceedsLargest) {
    texto =
      `Pelo que você marcou (${partes.join(", ")}), nem o maior veículo leva tudo de uma vez. ` +
      `Sugerimos o ${input.chosenName} e mais de uma viagem — ou fale com o suporte.`;
  }
  if (input.hasHeavyItems) {
    texto += " Tem item pesado: marque o adicional para o carreteiro vir preparado.";
  }
  if (input.suggestedHelpers > 0) {
    texto += ` Sugerimos ${input.suggestedHelpers} ${
      input.suggestedHelpers === 1 ? "ajudante" : "ajudantes"
    }.`;
  }
  return texto;
}

function formatVolume(volume: number): string {
  return `${volume.toFixed(1).replace(".", ",")} m³`;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

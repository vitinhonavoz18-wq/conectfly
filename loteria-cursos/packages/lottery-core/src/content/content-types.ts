/**
 * Registro dos tipos de conteúdo. Para criar um tipo novo (CURIOSITY, NEWS, CTA…):
 *  1. adicione aqui; 2. crie o template no renderer; 3. pronto — banco, idempotência
 *  e publicação já tratam o tipo de forma genérica.
 */
export interface ContentTypeDefinition {
  template: "RESULT" | "PREDICTION" | "CHECK" | "EDUCATIONAL";
  storageFolder: string;
  needsDraw: boolean;
  needsPrediction: boolean;
  imageHeadline: string;
}

export const CONTENT_TYPES = {
  RESULT: {
    template: "RESULT",
    storageFolder: "results",
    needsDraw: true,
    needsPrediction: false,
    imageHeadline: "RESULTADO",
  },
  PREDICTION: {
    template: "PREDICTION",
    storageFolder: "predictions",
    needsDraw: false,
    needsPrediction: true,
    imageHeadline: "PALPITE DO DIA",
  },
  CHECK: {
    template: "CHECK",
    storageFolder: "checks",
    needsDraw: true,
    needsPrediction: true,
    imageHeadline: "CONFIRA NOSSO PALPITE",
  },
  EDUCATIONAL: {
    template: "EDUCATIONAL",
    storageFolder: "educational",
    needsDraw: false,
    needsPrediction: false,
    imageHeadline: "VOCÊ SABIA?",
  },
} as const satisfies Record<string, ContentTypeDefinition>;

export type ContentType = keyof typeof CONTENT_TYPES;

export function isContentType(value: unknown): value is ContentType {
  return typeof value === "string" && value in CONTENT_TYPES;
}

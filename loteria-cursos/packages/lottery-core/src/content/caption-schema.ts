import { z } from "zod";

export const MAX_HASHTAGS = 5;

/** O que a OpenAI deve devolver (validado SEMPRE antes de seguir). */
export const captionOutputSchema = z
  .object({
    headline: z.string().trim().min(3).max(80),
    caption: z.string().trim().min(20).max(1200),
    cta: z.string().trim().min(3).max(220),
    hashtags: z
      .array(
        z
          .string()
          .trim()
          .regex(/^#[\p{L}\p{N}_]{2,40}$/u, "hashtag inválida"),
      )
      .max(MAX_HASHTAGS),
    alt_text: z.string().trim().min(10).max(400),
  })
  .strict();

export type CaptionOutput = z.infer<typeof captionOutputSchema>;

/**
 * JSON Schema enviado à OpenAI (Structured Outputs, strict). Usa só palavras-chave
 * simples; os limites finos (tamanho, quantidade de hashtags) são conferidos pelo
 * nosso validador depois.
 */
export const CAPTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "caption", "cta", "hashtags", "alt_text"],
  properties: {
    headline: {
      type: "string",
      description: "Título curto (até 60 caracteres), sem números de dezenas.",
    },
    caption: {
      type: "string",
      description:
        "Texto da legenda em português do Brasil, tom direto, sem listar dezenas, valores ou datas.",
    },
    cta: { type: "string", description: "Chamada para ação curta." },
    hashtags: {
      type: "array",
      items: { type: "string" },
      description: "No máximo 5 hashtags começando com #.",
    },
    alt_text: { type: "string", description: "Descrição acessível da imagem (texto alternativo)." },
  },
} as const;

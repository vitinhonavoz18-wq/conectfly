import { z } from "zod";

export const TEMPLATES = ["RESULT", "PREDICTION", "CHECK", "EDUCATIONAL"] as const;
export const FORMATS = {
  feed: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
} as const;

const numbers = z.array(z.number().int().min(0).max(999)).max(100);

export const renderRequestSchema = z
  .object({
    template: z.enum(TEMPLATES),
    format: z.enum(["feed", "story"]).default("feed"),
    game: z.string().regex(/^[a-z0-9_]+$/),
    game_name: z.string().min(1).max(40).optional(),
    brand_name: z.string().min(1).max(40).optional(),
    brand_color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    contest: z.number().int().positive(),
    numbers: numbers.default([]),
    headline: z.string().min(1).max(40),
    cta: z.string().max(160).default(""),
    draw_day: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullish(),
    accumulated: z.boolean().nullish(),
    estimated_prize: z.number().nonnegative().nullish(),
    prediction_numbers: numbers.nullish(),
    matching_numbers: numbers.nullish(),
    hits: z.number().int().nonnegative().nullish(),
    educational: z
      .object({ title: z.string().min(1).max(60), text: z.string().min(1).max(300) })
      .nullish(),
    storage_path: z
      .string()
      .regex(/^[a-z0-9_]+\/[a-z_]+\/[a-z0-9_-]+\.(jpg|png)$/, "storage_path inválido")
      .optional(),
    store: z.boolean().default(false),
    output_format: z.enum(["jpeg", "png"]).default("jpeg"),
  })
  .superRefine((v, ctx) => {
    const need = (cond: boolean, path: string, message: string) => {
      if (!cond) ctx.addIssue({ code: "custom", path: [path], message });
    };
    if (v.template === "RESULT")
      need(v.numbers.length > 0, "numbers", "RESULT exige as dezenas do resultado");
    if (v.template === "PREDICTION")
      need(v.numbers.length > 0, "numbers", "PREDICTION exige as dezenas do palpite");
    if (v.template === "CHECK") {
      need(v.numbers.length > 0, "numbers", "CHECK exige as dezenas do resultado");
      need(
        !!v.prediction_numbers?.length,
        "prediction_numbers",
        "CHECK exige as dezenas do palpite",
      );
    }
    if (v.template === "EDUCATIONAL")
      need(!!v.educational, "educational", "EDUCATIONAL exige título e texto");
    if (v.store) need(!!v.storage_path, "storage_path", "store=true exige storage_path");
    for (const key of ["numbers", "prediction_numbers"] as const) {
      const arr = v[key] ?? [];
      if (new Set(arr).size !== arr.length)
        ctx.addIssue({ code: "custom", path: [key], message: "dezenas repetidas" });
    }
  });

export type RenderRequest = z.infer<typeof renderRequestSchema>;

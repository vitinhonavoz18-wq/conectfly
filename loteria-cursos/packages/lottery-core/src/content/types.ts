import { z } from "zod";
import { CONTENT_TYPES } from "./content-types.ts";

const numbers = z.array(z.number().int().nonnegative()).min(1).max(100);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const gameInputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  numbers_per_bet: z.number().int().positive(),
  numbers_drawn: z.number().int().positive(),
  min_number: z.number().int().nonnegative(),
  max_number: z.number().int().positive(),
  brand_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  hashtags: z.array(z.string()).default([]),
});

export const drawInputSchema = z.object({
  id: z.string().optional(),
  contest: z.number().int().positive(),
  draw_day: isoDay,
  numbers,
  accumulated: z.boolean(),
  estimated_prize: z.number().nonnegative().nullable().optional(),
  next_draw_day: isoDay.nullable().optional(),
  next_contest: z.number().int().positive().nullable().optional(),
});

export const predictionInputSchema = z.object({
  id: z.string().optional(),
  contest: z.number().int().positive(),
  numbers,
  method: z.string().min(1),
  algorithm_version: z.string().min(1),
});

export const planInputSchema = z.object({
  content_type: z.enum(
    Object.keys(CONTENT_TYPES) as [
      keyof typeof CONTENT_TYPES,
      ...Array<keyof typeof CONTENT_TYPES>,
    ],
  ),
  format: z.enum(["feed", "story"]).default("feed"),
  dry_run: z.boolean(),
  brand_name: z.string().min(1).default("LOTERIA CURSOS"),
  default_cta: z.string().min(1),
  openai_model: z.string().default(""),
  game: gameInputSchema,
  draw: drawInputSchema.nullish(),
  prediction: predictionInputSchema.nullish(),
  contest: z.number().int().positive().optional(),
  educational: z
    .object({ title: z.string().min(1).max(60), text: z.string().min(1).max(300) })
    .optional(),
});

export type PlanInput = z.infer<typeof planInputSchema>;

/** Retrato dos dados oficiais usados no post (gravado em social_posts.content_data). */
export interface ContentData {
  content_type: keyof typeof CONTENT_TYPES;
  brand_name: string;
  game_slug: string;
  game_name: string;
  contest: number;
  draw_day: string | null;
  numbers: number[] | null;
  accumulated: boolean | null;
  estimated_prize: number | null;
  next_draw_day: string | null;
  prediction_numbers: number[] | null;
  hits: number | null;
  matching_numbers: number[] | null;
  default_cta: string;
  hashtags: string[];
  educational?: { title: string; text: string };
}

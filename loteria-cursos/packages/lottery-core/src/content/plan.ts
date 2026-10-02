import { buildIdempotencyKey } from "../idempotency.ts";
import { matchPrediction } from "../matcher.ts";
import { validateNumberSet } from "../validator.ts";
import type { GameRules } from "../games.ts";
import { buildCaptionRequest, fallbackCaption, defaultAltText } from "./caption.ts";
import { CONTENT_TYPES } from "./content-types.ts";
import { planInputSchema, type ContentData, type PlanInput } from "./types.ts";

export class PlanError extends Error {
  constructor(
    message: string,
    readonly issues: unknown[] = [],
  ) {
    super(message);
    this.name = "PlanError";
  }
}

export const FORMAT_SIZES = {
  feed: { width: 1080, height: 1350, mediaType: "IMAGE" },
  story: { width: 1080, height: 1920, mediaType: "STORIES" },
} as const;

/** Caminho determinístico no Storage: megasena/results/megasena-result-3065-feed.jpg */
export function storagePathFor(
  game: string,
  contentType: keyof typeof CONTENT_TYPES,
  contest: number,
  format: string,
  dryRun: boolean,
) {
  const folder = CONTENT_TYPES[contentType].storageFolder;
  const file = `${game}-${contentType.toLowerCase()}-${contest}-${format}${dryRun ? "-dryrun" : ""}.jpg`;
  return { storage_path: `${game}/${folder}/${file}`, file_name: file };
}

/**
 * Planeja um post a partir de dados oficiais já validados: chave de idempotência,
 * caminho do arquivo, dados da arte, pedido de legenda à IA e legenda de reserva.
 * Tudo determinístico — a mesma entrada gera sempre o mesmo plano.
 */
export function planContent(rawInput: unknown) {
  const parsed = planInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new PlanError("entrada do plano inválida", parsed.error.issues);
  const input: PlanInput = parsed.data;
  const def = CONTENT_TYPES[input.content_type];
  const rules: GameRules = {
    slug: input.game.slug,
    name: input.game.name,
    numbersDrawn: input.game.numbers_drawn,
    numbersPerBet: input.game.numbers_per_bet,
    minNumber: input.game.min_number,
    maxNumber: input.game.max_number,
  };

  if (def.needsDraw) {
    if (!input.draw) throw new PlanError(`${input.content_type} exige o resultado oficial (draw)`);
    const check = validateNumberSet(input.draw.numbers, rules, "draw", "draw.numbers");
    if (!check.ok) throw new PlanError("dezenas do resultado inválidas", check.issues);
  }
  if (def.needsPrediction) {
    if (!input.prediction)
      throw new PlanError(`${input.content_type} exige o palpite (prediction)`);
    const check = validateNumberSet(input.prediction.numbers, rules, "bet", "prediction.numbers");
    if (!check.ok) throw new PlanError("dezenas do palpite inválidas", check.issues);
  }
  if (
    input.content_type === "CHECK" &&
    input.draw &&
    input.prediction &&
    input.draw.contest !== input.prediction.contest
  ) {
    throw new PlanError(
      `palpite do concurso ${input.prediction.contest} não pode ser conferido com o concurso ${input.draw.contest}`,
    );
  }

  const contest = input.draw?.contest ?? input.prediction?.contest ?? input.contest;
  if (!contest) throw new PlanError("não foi possível determinar o concurso");

  const match =
    input.content_type === "CHECK" && input.draw && input.prediction
      ? matchPrediction(input.prediction.numbers, input.draw.numbers, rules)
      : null;

  const content: ContentData = {
    content_type: input.content_type,
    brand_name: input.brand_name,
    game_slug: input.game.slug,
    game_name: input.game.name,
    contest,
    draw_day: input.draw?.draw_day ?? null,
    numbers: input.draw?.numbers ?? null,
    accumulated: input.draw?.accumulated ?? null,
    estimated_prize: input.draw?.estimated_prize ?? null,
    next_draw_day: input.draw?.next_draw_day ?? null,
    prediction_numbers: input.prediction?.numbers ?? null,
    hits: match?.hits ?? null,
    matching_numbers: match?.matching_numbers ?? null,
    default_cta: input.default_cta,
    hashtags: input.game.hashtags,
    ...(input.educational ? { educational: input.educational } : {}),
  };

  const size = FORMAT_SIZES[input.format];
  const key = buildIdempotencyKey({
    contentType: input.content_type,
    game: input.game.slug,
    contest,
    format: input.format,
    dryRun: input.dry_run,
  });
  const { storage_path, file_name } = storagePathFor(
    input.game.slug,
    input.content_type,
    contest,
    input.format,
    input.dry_run,
  );

  const render_payload = {
    template: def.template,
    format: input.format,
    game: input.game.slug,
    game_name: input.game.name,
    brand_name: input.brand_name,
    brand_color: input.game.brand_color,
    contest,
    headline: def.imageHeadline,
    cta: input.default_cta,
    numbers:
      input.content_type === "PREDICTION"
        ? (input.prediction?.numbers ?? [])
        : (input.draw?.numbers ?? []),
    draw_day: input.draw?.draw_day ?? null,
    accumulated: input.draw?.accumulated ?? null,
    estimated_prize: input.draw?.estimated_prize ?? null,
    prediction_numbers: input.prediction?.numbers ?? null,
    matching_numbers: match?.matching_numbers ?? null,
    hits: match?.hits ?? null,
    educational: input.educational ?? null,
    storage_path,
  };

  return {
    idempotency_key: key,
    content_type: input.content_type,
    game: input.game.slug,
    contest,
    format: input.format,
    media_type: size.mediaType,
    width: size.width,
    height: size.height,
    dry_run: input.dry_run,
    storage_path,
    file_name,
    draw_id: input.draw?.id ?? null,
    prediction_id: input.prediction?.id ?? null,
    content_data: content,
    render_payload,
    caption_request: buildCaptionRequest(content, input.openai_model),
    fallback_caption: fallbackCaption(content),
    alt_text_default: defaultAltText(content),
  };
}

export type ContentPlan = ReturnType<typeof planContent>;

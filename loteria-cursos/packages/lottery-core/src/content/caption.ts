import { computeBackoffMs, parseRetryAfter } from "@lc/shared";
import {
  CAPTION_JSON_SCHEMA,
  captionOutputSchema,
  MAX_HASHTAGS,
  type CaptionOutput,
} from "./caption-schema.ts";
import { checkCompliance, checkDataIntegrity, FORBIDDEN_PHRASES } from "./compliance.ts";
import { formatBrDay, formatMoney, formatNumbers } from "./format.ts";
import type { ContentData } from "./types.ts";

export const INSTAGRAM_CAPTION_LIMIT = 2200;

export const DISCLAIMER =
  "Conteúdo informativo e recreativo. Confira sempre o resultado oficial no site das Loterias CAIXA. " +
  "Jogue com responsabilidade. Proibido para menores de 18 anos.";

/** Bloco com dados oficiais — montado por código, nunca pela IA. */
export function officialBlock(c: ContentData): string {
  const lines: string[] = [];
  const day = c.draw_day ? ` • ${formatBrDay(c.draw_day)}` : "";
  switch (c.content_type) {
    case "RESULT":
      lines.push(`${c.game_name} • Concurso ${c.contest}${day}`);
      lines.push(`Dezenas sorteadas: ${formatNumbers(c.numbers ?? [])}`);
      if (c.accumulated) {
        lines.push(
          c.estimated_prize
            ? `Acumulou! Estimativa oficial para o próximo concurso: ${formatMoney(c.estimated_prize)}.`
            : "Acumulou!",
        );
      }
      break;
    case "PREDICTION":
      lines.push(`Palpite ${c.game_name} • Concurso ${c.contest}`);
      lines.push(`Dezenas: ${formatNumbers(c.prediction_numbers ?? [])}`);
      lines.push(
        "Palpite gerado com auxílio de critérios estatísticos e IA. Conteúdo recreativo: as apostas continuam tendo natureza aleatória e não há garantia de acerto.",
      );
      break;
    case "CHECK":
      lines.push(`CONFIRA NOSSO PALPITE — ${c.game_name} • Concurso ${c.contest}${day}`);
      lines.push(`Palpite: ${formatNumbers(c.prediction_numbers ?? [])}`);
      lines.push(`Resultado: ${formatNumbers(c.numbers ?? [])}`);
      lines.push(
        `Coincidências: ${c.hits ?? 0} ${c.hits === 1 ? "dezena" : "dezenas"}` +
          (c.matching_numbers && c.matching_numbers.length
            ? ` (${formatNumbers(c.matching_numbers)})`
            : ""),
      );
      lines.push(
        "Coincidência não significa prêmio. Confira a premiação oficial no site das Loterias CAIXA.",
      );
      break;
    case "EDUCATIONAL":
      if (c.educational) lines.push(c.educational.text);
      break;
  }
  return lines.join("\n");
}

export function normalizeHashtags(primary: string[], fallback: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of [...primary, ...fallback]) {
    const t = tag.trim();
    if (!/^#[\p{L}\p{N}_]{2,40}$/u.test(t)) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= MAX_HASHTAGS) break;
  }
  return out;
}

export function assembleCaption(
  c: ContentData,
  parts: { headline: string; body: string; cta: string; hashtags: string[] },
): string {
  const blocks = [
    parts.headline,
    officialBlock(c),
    parts.body,
    parts.cta,
    DISCLAIMER,
    parts.hashtags.join(" "),
  ].filter((b) => b && b.trim().length > 0);
  let caption = blocks.join("\n\n");
  if (caption.length > INSTAGRAM_CAPTION_LIMIT) {
    // Corta só o texto livre; dados oficiais, CTA e aviso ficam intactos.
    const overflow = caption.length - INSTAGRAM_CAPTION_LIMIT + 1;
    const body = parts.body.slice(0, Math.max(0, parts.body.length - overflow)).trimEnd() + "…";
    caption = [
      parts.headline,
      officialBlock(c),
      body,
      parts.cta,
      DISCLAIMER,
      parts.hashtags.join(" "),
    ]
      .filter((b) => b && b.trim().length > 0)
      .join("\n\n");
  }
  return caption;
}

export interface FinalCaption {
  source: "openai" | "fallback";
  headline: string;
  caption_body: string;
  cta: string;
  hashtags: string[];
  alt_text: string;
  caption: string;
}

export function defaultAltText(c: ContentData): string {
  switch (c.content_type) {
    case "RESULT":
      return `Arte da ${c.brand_name} com o resultado da ${c.game_name}, concurso ${c.contest}: dezenas ${formatNumbers(c.numbers ?? [], ", ")}.`;
    case "PREDICTION":
      return `Arte da ${c.brand_name} com o palpite recreativo para a ${c.game_name}, concurso ${c.contest}: dezenas ${formatNumbers(c.prediction_numbers ?? [], ", ")}.`;
    case "CHECK":
      return `Arte da ${c.brand_name} comparando o palpite com o resultado da ${c.game_name}, concurso ${c.contest}: ${c.hits ?? 0} coincidências.`;
    default:
      return `Arte informativa da ${c.brand_name} sobre ${c.game_name}.`;
  }
}

/** Legenda de reserva, 100% determinística (usada quando a IA falha). */
export function fallbackCaption(c: ContentData): FinalCaption {
  const game = c.game_name.toUpperCase();
  let headline: string;
  let body: string;
  switch (c.content_type) {
    case "RESULT":
      headline = `RESULTADO ${game}`;
      body = "Confira sempre as informações oficiais.";
      break;
    case "PREDICTION":
      headline = `PALPITE ${game}`;
      body = "Combinação criada a partir de critérios estatísticos. Conteúdo recreativo.";
      break;
    case "CHECK":
      headline = `CONFIRA NOSSO PALPITE — ${game}`;
      body = "Confira sempre as informações oficiais.";
      break;
    default:
      headline = c.educational?.title ?? game;
      body = "Confira sempre as informações oficiais.";
  }
  const hashtags = normalizeHashtags([], c.hashtags);
  const cta = c.default_cta;
  return {
    source: "fallback",
    headline,
    caption_body: body,
    cta,
    hashtags,
    alt_text: defaultAltText(c),
    caption: assembleCaption(c, { headline, body, cta, hashtags }),
  };
}

export function captionInstructions(c: ContentData): string {
  return [
    `Você escreve legendas de Instagram para a marca ${c.brand_name}, que publica conteúdo sobre loterias brasileiras.`,
    "Regras obrigatórias:",
    "- Português do Brasil, tom direto e amigável, no máximo 3 frases curtas no campo caption.",
    "- NÃO escreva dezenas, listas de números, valores em reais, datas nem número de concurso: esses dados oficiais são inseridos automaticamente pelo sistema.",
    "- NÃO prometa prêmio nem resultado. Nunca use: " +
      FORBIDDEN_PHRASES.slice(0, 12).join(", ") +
      ".",
    "- Para palpites, deixe claro que é conteúdo recreativo e que as apostas têm natureza aleatória.",
    "- Coincidência entre palpite e resultado NÃO é prêmio; não diga que alguém ganhou.",
    `- O campo cta deve ser exatamente: ${c.default_cta}`,
    "- No máximo 5 hashtags, cada uma começando com #, sem acentos ou espaços.",
    "- alt_text descreve a imagem para acessibilidade, sem inventar dados.",
    "Responda apenas no formato JSON solicitado.",
  ].join("\n");
}

/** Corpo da chamada à OpenAI Responses API com Structured Outputs (json_schema, strict). */
export function buildCaptionRequest(c: ContentData, model: string) {
  const facts = {
    tipo_de_conteudo: c.content_type,
    marca: c.brand_name,
    modalidade: c.game_name,
    acumulou: c.accumulated,
    coincidencias: c.hits,
    observacao:
      "Os dados oficiais (dezenas, concurso, datas e valores) são exibidos pelo sistema; não os repita.",
  };
  return {
    model,
    instructions: captionInstructions(c),
    input: `Escreva a legenda para este post:\n${JSON.stringify(facts)}`,
    text: {
      format: {
        type: "json_schema",
        name: "instagram_caption",
        strict: true,
        schema: CAPTION_JSON_SCHEMA,
      },
    },
    max_output_tokens: 2000,
    store: false,
  };
}

export interface OpenAiHttpResult {
  status_code?: number | null;
  body?: unknown;
  headers?: Record<string, unknown> | null;
  error?: string | null;
}

export interface FinalizeOptions {
  attempt: number;
  maxAttempts: number;
  random?: () => number;
}

export type FinalizeResult =
  | ({
      outcome: "ok" | "fallback";
      attempt: number;
      reason: string | null;
      warnings: string[];
    } & FinalCaption)
  | { outcome: "retry"; attempt: number; delay_seconds: number; reason: string };

/** Extrai o texto final de uma resposta da Responses API (ignora itens de raciocínio). */
export function extractOutputText(body: unknown): {
  text?: string;
  refusal?: string;
  status?: string;
} {
  if (!body || typeof body !== "object") return {};
  const b = body as { status?: string; output?: unknown; output_text?: unknown };
  const out: { text?: string; refusal?: string; status?: string } = { status: b.status };
  if (Array.isArray(b.output)) {
    for (const item of b.output) {
      if (!item || typeof item !== "object" || (item as { type?: string }).type !== "message")
        continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        const p = part as { type?: string; text?: string; refusal?: string };
        if (p.type === "output_text" && typeof p.text === "string")
          out.text = (out.text ?? "") + p.text;
        if (p.type === "refusal" && typeof p.refusal === "string") out.refusal = p.refusal;
      }
    }
  }
  if (out.text === undefined && typeof b.output_text === "string") out.text = b.output_text;
  return out;
}

/**
 * Decide o que fazer com a resposta da OpenAI: aceitar, tentar de novo (erro
 * transitório) ou usar a legenda de reserva. Dado oficial nunca depende da IA.
 */
export function finalizeCaption(
  c: ContentData,
  http: OpenAiHttpResult,
  options: FinalizeOptions,
): FinalizeResult {
  const { attempt, maxAttempts } = options;
  const canRetry = attempt < maxAttempts;
  const retry = (reason: string, hintMs?: number): FinalizeResult => {
    if (!canRetry) return withFallback(`${reason} (tentativas esgotadas)`);
    const delayMs =
      hintMs ??
      computeBackoffMs(
        attempt,
        { baseMs: 5000, factor: 3, maxMs: 60000, jitterRatio: 0.2 },
        options.random,
      );
    return {
      outcome: "retry",
      attempt,
      delay_seconds: Math.max(1, Math.round(Math.min(delayMs, 120000) / 1000)),
      reason,
    };
  };
  const withFallback = (reason: string): FinalizeResult => ({
    outcome: "fallback",
    attempt,
    reason,
    warnings: [reason],
    ...fallbackCaption(c),
  });

  const status = typeof http.status_code === "number" ? http.status_code : 0;
  if (status === 0 || http.error)
    return retry(`falha de rede/timeout na OpenAI: ${http.error ?? "sem resposta"}`);
  if (status === 429 || status >= 500 || status === 408) {
    const retryAfter = parseRetryAfter(
      String((http.headers?.["retry-after"] as string | undefined) ?? ""),
    );
    return retry(`OpenAI respondeu HTTP ${status}`, retryAfter);
  }
  if (status !== 200)
    return withFallback(
      `OpenAI respondeu HTTP ${status} (erro permanente: chave, modelo ou requisição)`,
    );

  const extracted = extractOutputText(http.body);
  if (extracted.refusal) return withFallback("modelo recusou a solicitação");
  if (extracted.status && extracted.status !== "completed")
    return retry(`resposta da OpenAI com status ${extracted.status}`);
  if (!extracted.text) return retry("resposta da OpenAI sem texto");

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted.text);
  } catch {
    return retry("resposta da OpenAI não é JSON válido");
  }
  const schema = captionOutputSchema.safeParse(parsed);
  if (!schema.success)
    return retry(
      `JSON fora do schema: ${schema.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`,
    );
  const out: CaptionOutput = schema.data;

  const issues = [
    ...checkCompliance({
      headline: out.headline,
      caption: out.caption,
      cta: out.cta,
      alt_text: out.alt_text,
      hashtags: out.hashtags,
    }),
    ...checkDataIntegrity(`${out.headline}\n${out.caption}\n${out.cta}`, c.contest),
  ];
  if (issues.length)
    return retry(
      `legenda reprovada nas regras editoriais: ${issues.map((i) => i.message).join("; ")}`,
    );

  const hashtags = normalizeHashtags(out.hashtags, c.hashtags);
  const cta = c.default_cta; // CTA padrão configurável prevalece
  const warnings =
    out.cta.trim() !== cta.trim() ? ["CTA da IA substituído pelo CTA padrão configurado"] : [];
  return {
    outcome: "ok",
    attempt,
    reason: null,
    warnings,
    source: "openai",
    headline: out.headline,
    caption_body: out.caption,
    cta,
    hashtags,
    alt_text: out.alt_text,
    caption: assembleCaption(c, { headline: out.headline, body: out.caption, cta, hashtags }),
  };
}

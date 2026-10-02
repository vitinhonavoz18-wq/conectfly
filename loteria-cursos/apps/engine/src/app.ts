import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { correlationId, createLogger, type Logger } from "@lc/shared";
import {
  ALGORITHM_VERSION,
  PREDICTION_METHOD,
  PlanError,
  classifyMetaResponse,
  createSourceAdapter,
  decideResultPoll,
  fallbackCaption,
  finalizeCaption,
  generatePredictions,
  matchPrediction,
  planContent,
  validateNumberSet,
  buildContainerRequest,
  type GameRules,
  type LotterySourceAdapter,
  type SourceGameConfig,
} from "@lc/lottery-core";

/**
 * Lottery Core API ("engine"): expõe ao n8n as funções determinísticas do
 * pacote lottery-core. Não guarda estado e não tem segredos: banco e
 * credenciais ficam com o n8n.
 */

const gameSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  numbers_per_bet: z.number().int().positive(),
  numbers_drawn: z.number().int().positive(),
  min_number: z.number().int().nonnegative(),
  max_number: z.number().int().positive(),
  source_code: z.string().min(1).optional(),
  source_game_type: z.string().min(1).optional(),
  timezone: z.string().min(1).default("America/Bahia"),
});
type GameInput = z.infer<typeof gameSchema>;

/** Dados do laço de repetição devolvidos intactos (o n8n não precisa "lembrar" nada). */
const contextSchema = z.record(z.string(), z.unknown()).default({});

const toRules = (g: GameInput): GameRules => ({
  slug: g.slug,
  name: g.name,
  numbersDrawn: g.numbers_drawn,
  numbersPerBet: g.numbers_per_bet,
  minNumber: g.min_number,
  maxNumber: g.max_number,
});

const toSourceConfig = (g: GameInput): SourceGameConfig => ({
  ...toRules(g),
  sourceCode: g.source_code ?? g.slug,
  sourceGameType: g.source_game_type ?? g.slug.toUpperCase(),
  timezone: g.timezone,
});

export interface EngineOptions {
  source?: LotterySourceAdapter;
  logger?: Logger;
  rendererUrl?: string;
}

export function buildEngine(options: EngineOptions = {}): FastifyInstance {
  const log = options.logger ?? createLogger({ service: "engine" });
  const source =
    options.source ??
    createSourceAdapter(process.env.LOTTERY_SOURCE ?? "caixa", {
      baseUrl: process.env.CAIXA_BASE_URL || undefined,
      timeoutMs: Number(process.env.CAIXA_TIMEOUT_MS ?? 15000),
      maxAttempts: Number(process.env.CAIXA_MAX_ATTEMPTS ?? 3),
    });
  const app = Fastify({ logger: false, bodyLimit: 2 * 1024 * 1024 });

  app.addHook("onRequest", async (req, reply) => {
    const cid = correlationId(req.headers["x-correlation-id"]);
    (req as unknown as { cid: string }).cid = cid;
    reply.header("x-correlation-id", cid);
  });
  app.addHook("onResponse", async (req, reply) => {
    log.info("http_request", {
      correlation_id: (req as unknown as { cid: string }).cid,
      method: req.method,
      url: req.url.split("?")[0],
      status: reply.statusCode,
      duration_ms: Math.round(reply.elapsedTime),
    });
  });
  app.setErrorHandler((error, req, reply) => {
    const cid = (req as unknown as { cid?: string }).cid;
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        ok: false,
        error_code: "INVALID_INPUT",
        issues: error.issues,
        correlation_id: cid,
      });
    }
    if (error instanceof PlanError) {
      return reply.status(422).send({
        ok: false,
        error_code: "INVALID_CONTENT",
        message: error.message,
        issues: error.issues,
        correlation_id: cid,
      });
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    log.error("unhandled_error", { correlation_id: cid, message: (error as Error).message });
    return reply.status(status).send({
      ok: false,
      error_code: status === 400 ? "BAD_REQUEST" : "INTERNAL_ERROR",
      message: (error as Error).message,
      correlation_id: cid,
    });
  });

  // ---------------------------------------------------------------- saúde
  app.get("/health", async () => ({
    status: "ok",
    service: "engine",
    source: source.name,
    time: new Date().toISOString(),
  }));

  // Saúde profunda: fonte de loteria (1 requisição leve, com cache) + renderer/storage.
  let sourceCache: { at: number; value: unknown } | null = null;
  app.get("/v1/health/deep", async () => {
    const services: Record<string, string> = { engine: "ok" };
    const details: Record<string, unknown> = {};
    if (!sourceCache || Date.now() - sourceCache.at > 5 * 60_000) {
      const r = await source.fetchLatest(
        toSourceConfig({
          slug: "megasena",
          name: "Mega-Sena",
          numbers_per_bet: 6,
          numbers_drawn: 6,
          min_number: 1,
          max_number: 60,
          source_code: "megasena",
          source_game_type: "MEGA_SENA",
          timezone: "America/Bahia",
        }),
      );
      sourceCache = {
        at: Date.now(),
        value: r.ok
          ? { status: "ok", latest_contest: r.draw.contest }
          : { status: "down", error: r.errorCode, message: r.message },
      };
    }
    const s = sourceCache.value as { status: string };
    services.lottery_source = s.status;
    details.lottery_source = sourceCache.value;
    const rendererUrl = options.rendererUrl ?? process.env.RENDERER_URL;
    if (rendererUrl) {
      for (const [name, path] of [
        ["renderer", "/health"],
        ["storage", "/health/storage"],
      ] as const) {
        try {
          const res = await fetch(`${rendererUrl}${path}`, { signal: AbortSignal.timeout(8000) });
          const body = (await res.json().catch(() => ({}))) as { status?: string };
          services[name] = res.ok && body.status === "ok" ? "ok" : "down";
          details[name] = body;
        } catch (error) {
          services[name] = "down";
          details[name] = { error: (error as Error).message };
        }
      }
    }
    const status = Object.values(services).every((v) => v === "ok") ? "ok" : "degraded";
    return { status, services, details };
  });

  // ---------------------------------------------------------------- resultados
  const fetchSchema = z.object({
    game: gameSchema,
    contest: z.number().int().positive().optional(),
  });
  app.post("/v1/results/fetch", async (req, reply) => {
    const input = fetchSchema.parse(req.body);
    const cfg = toSourceConfig(input.game);
    const started = Date.now();
    const result = input.contest
      ? await source.fetchContest(cfg, input.contest)
      : await source.fetchLatest(cfg);
    log.info("lottery_fetch", {
      correlation_id: (req as unknown as { cid: string }).cid,
      game: cfg.slug,
      contest: result.ok ? result.draw.contest : (input.contest ?? null),
      status: result.ok ? "success" : result.errorCode,
      duration_ms: Date.now() - started,
    });
    if (result.ok) return { ok: true, outcome: "FETCHED", draw: result.draw };
    const http =
      result.errorCode === "INVALID_PAYLOAD" ? 422 : result.errorCode === "NOT_FOUND" ? 404 : 503;
    return reply.status(http).send({
      ok: false,
      outcome: result.errorCode,
      retryable: result.retryable,
      message: result.message,
      issues: result.issues ?? [],
      source_http_status: result.httpStatus ?? null,
    });
  });

  app.post("/v1/results/poll-decision", async (req) => {
    const input = z
      .object({
        attempt: z.number().int().positive(),
        max_attempts: z.number().int().positive(),
        interval_seconds: z.number().int().positive(),
        context: contextSchema,
      })
      .parse(req.body);
    return {
      ...decideResultPoll({
        attempt: input.attempt,
        maxAttempts: input.max_attempts,
        intervalSeconds: input.interval_seconds,
      }),
      context: input.context,
    };
  });

  // ---------------------------------------------------------------- palpites
  const generateSchema = z.object({
    game: gameSchema,
    contest: z.number().int().positive(),
    history: z.array(z.unknown()).default([]),
    count: z.number().int().min(1).max(20).default(1),
    seed: z.string().min(1).optional(),
  });
  app.post("/v1/predictions/generate", async (req) => {
    const input = generateSchema.parse(req.body);
    const seed =
      input.seed ?? `${input.game.slug}:${input.contest}:${PREDICTION_METHOD}:${ALGORITHM_VERSION}`;
    const result = generatePredictions(toRules(input.game), input.history as never, {
      count: input.count,
      seed,
    });
    return { ok: true, outcome: "GENERATED", contest: input.contest, ...result };
  });

  const checkSchema = z.object({
    game: gameSchema,
    result_numbers: z.array(z.number().int()),
    predictions: z.array(z.object({ id: z.string(), numbers: z.array(z.number().int()) })),
  });
  app.post("/v1/predictions/check", async (req, reply) => {
    const input = checkSchema.parse(req.body);
    const rules = toRules(input.game);
    const draw = validateNumberSet(input.result_numbers, rules, "draw", "result_numbers");
    if (!draw.ok)
      return reply
        .status(422)
        .send({ ok: false, error_code: "INVALID_RESULT", issues: draw.issues });
    const checks = input.predictions.map((p) => ({
      id: p.id,
      ...matchPrediction(p.numbers, input.result_numbers, rules),
    }));
    return { ok: true, outcome: "CHECKED", checks };
  });

  // ---------------------------------------------------------------- conteúdo
  app.post("/v1/content/plan", async (req) => ({
    ok: true,
    outcome: "PLANNED",
    plan: planContent(req.body),
  }));

  const finalizeSchema = z.object({
    content_data: z.record(z.string(), z.unknown()),
    openai: z
      .object({
        status_code: z.number().nullable().optional(),
        body: z.unknown().optional(),
        headers: z.record(z.string(), z.unknown()).nullable().optional(),
        error: z.string().nullable().optional(),
        skipped: z.boolean().optional(),
      })
      .default({}),
    attempt: z.number().int().positive(),
    max_attempts: z.number().int().positive().max(10).default(3),
    context: contextSchema,
  });
  app.post("/v1/content/caption-finalize", async (req) => {
    const input = finalizeSchema.parse(req.body);
    const result = input.openai.skipped
      ? {
          outcome: "fallback" as const,
          attempt: input.attempt,
          reason: "OpenAI não configurada (OPENAI_MODEL vazio)",
          warnings: ["openai_not_configured"],
          ...fallbackCaption(input.content_data as never),
        }
      : finalizeCaption(input.content_data as never, input.openai, {
          attempt: input.attempt,
          maxAttempts: input.max_attempts,
        });
    return { ...result, context: input.context };
  });

  // ---------------------------------------------------------------- Meta
  const classifySchema = z.object({
    operation: z.enum([
      "create_container",
      "container_status",
      "media_publish",
      "insights",
      "me",
      "publishing_limit",
    ]),
    status_code: z.number().nullable().optional(),
    body: z.unknown().optional(),
    headers: z.record(z.string(), z.unknown()).nullable().optional(),
    error: z.string().nullable().optional(),
    attempt: z.number().int().positive(),
    max_attempts: z.number().int().positive().max(30),
    context: contextSchema,
  });
  app.post("/v1/meta/classify", async (req) => {
    const i = classifySchema.parse(req.body);
    const c = classifyMetaResponse(
      { status_code: i.status_code, body: i.body, headers: i.headers, error: i.error },
      { operation: i.operation, attempt: i.attempt, maxAttempts: i.max_attempts },
    );
    return { ...c, http_status: i.status_code ?? null, context: i.context };
  });

  app.post("/v1/meta/container-request", async (req) => {
    const i = z
      .object({
        media_type: z.enum(["IMAGE", "STORIES", "REELS", "CAROUSEL_ITEM"]),
        media_url: z.string().url(),
        caption: z.string().max(2200).optional(),
      })
      .parse(req.body);
    return { ok: true, body: buildContainerRequest(i) };
  });

  return app;
}

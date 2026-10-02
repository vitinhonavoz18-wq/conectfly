import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";

/**
 * Servidor de simulação para testes locais/E2E. Imita (apenas no que o projeto usa):
 *   • CAIXA            GET  /portaldeloterias/api/:game[/:contest]
 *   • OpenAI           POST /v1/responses, GET /v1/models/:model
 *   • Meta Graph API   POST /:v/:ig/media, GET /:v/:container, POST /:v/:ig/media_publish, insights…
 *   • Supabase Storage POST /storage/v1/object/:bucket/*, GET …/public/…, GET /storage/v1/bucket/:id
 * O comportamento é controlado por cenários (POST /__admin/scenario) e todas as
 * chamadas ficam registradas (GET /__admin/calls) para os testes conferirem —
 * por exemplo, "nenhum media_publish foi recebido".
 * NUNCA use este servidor em produção.
 */

export interface Scenario {
  caixa: {
    mode: "fixture" | "error500" | "html" | "invalid";
    /** Arquivo de fixture por modalidade para "último resultado". */
    latest: Record<string, string>;
    /** Sequência por modalidade: cada chamada consome o próximo (o último se repete). */
    sequence: Record<string, string[]>;
    invalid_fixture: string;
  };
  openai: {
    mode: "ok" | "error500" | "error401" | "forbidden" | "invalid_json" | "timeout";
    fail_times: number;
    delay_ms: number;
  };
  meta: {
    valid_token: string;
    container_mode: "finish_after" | "never" | "error" | "expired";
    finish_after_polls: number;
    publish_mode: "ok" | "rate_limit" | "invalid_token" | "server_error";
    publish_fail_times: number;
    create_mode: "ok" | "invalid_token" | "rate_limit";
    create_fail_times: number;
    fetch_media: boolean;
    supported_metrics: string[];
  };
  storage: { mode: "ok" | "error500"; key: string; bucket_public: boolean };
}

export const DEFAULT_SCENARIO = (): Scenario => ({
  caixa: {
    mode: "fixture",
    latest: {
      megasena: "caixa/megasena.json",
      lotofacil: "caixa/lotofacil.json",
      quina: "caixa/quina.json",
      lotomania: "caixa/lotomania.json",
    },
    sequence: {},
    invalid_fixture: "caixa/invalid/megasena-duplicate-numbers.json",
  },
  openai: { mode: "ok", fail_times: 0, delay_ms: 0 },
  meta: {
    valid_token: "mock-meta-token",
    container_mode: "finish_after",
    finish_after_polls: 1,
    publish_mode: "ok",
    publish_fail_times: 0,
    create_mode: "ok",
    create_fail_times: 0,
    fetch_media: true,
    supported_metrics: [
      "views",
      "reach",
      "likes",
      "comments",
      "shares",
      "saved",
      "total_interactions",
      "follows",
      "profile_visits",
    ],
  },
  storage: { mode: "ok", key: "mock-service-role-key", bucket_public: true },
});

interface Call {
  service: "caixa" | "openai" | "meta" | "storage";
  operation: string;
  method: string;
  path: string;
  status: number;
  at: string;
}

const graphError = (
  message: string,
  code: number,
  subcode?: number,
  extra: Record<string, unknown> = {},
) => ({
  error: {
    message,
    type: "OAuthException",
    code,
    ...(subcode ? { error_subcode: subcode } : {}),
    fbtrace_id: "AMockTrace",
    ...extra,
  },
});

function deepMerge<T>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return (patch ?? base) as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const cur = out[k];
    out[k] =
      cur &&
      typeof cur === "object" &&
      !Array.isArray(cur) &&
      v &&
      typeof v === "object" &&
      !Array.isArray(v)
        ? deepMerge(cur, v)
        : v;
  }
  return out as T;
}

export function buildMockServer(options: {
  fixturesDir: string;
  publicBaseUrl?: string;
}): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 20 * 1024 * 1024 });
  let scenario = DEFAULT_SCENARIO();
  let calls: Call[] = [];
  const counters = new Map<string, number>();
  const files = new Map<string, { data: Buffer; contentType: string }>();
  const containers = new Map<
    string,
    { status: string; polls: number; media_url: string; caption: string }
  >();
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}${String(++seq).padStart(10, "0")}`;
  const bump = (key: string) => {
    const v = (counters.get(key) ?? 0) + 1;
    counters.set(key, v);
    return v;
  };
  const fixture = (rel: string) => {
    const file = join(options.fixturesDir, rel);
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf8")) as unknown;
  };
  const record = (
    service: Call["service"],
    operation: string,
    req: FastifyRequest,
    status: number,
  ) => {
    calls.push({
      service,
      operation,
      method: req.method,
      path: req.url.split("?")[0] ?? req.url,
      status,
      at: new Date().toISOString(),
    });
  };

  app.addContentTypeParser(
    ["image/jpeg", "image/png", "application/octet-stream"],
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body),
  );

  // ------------------------------------------------------------------ admin
  app.get("/health", async () => ({ status: "ok", service: "mock-server" }));
  app.post("/__admin/reset", async () => {
    scenario = DEFAULT_SCENARIO();
    calls = [];
    counters.clear();
    files.clear();
    containers.clear();
    return { ok: true };
  });
  app.post("/__admin/scenario", async (req) => {
    scenario = deepMerge(scenario, req.body);
    counters.clear();
    return { ok: true, scenario };
  });
  app.get("/__admin/calls", async (req) => {
    const service = (req.query as { service?: string }).service;
    return { calls: service ? calls.filter((c) => c.service === service) : calls };
  });
  app.get("/__admin/state", async () => ({
    scenario,
    containers: Object.fromEntries(containers),
    files: [...files.keys()],
  }));

  // ------------------------------------------------------------------ CAIXA
  const caixaHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const { game, contest } = req.params as { game: string; contest?: string };
    const op = contest ? "fetch_contest" : "fetch_latest";
    const send = (status: number, body: unknown, type = "application/json") => {
      record("caixa", op, req, status);
      return reply
        .status(status)
        .type(type)
        .send(typeof body === "string" ? body : JSON.stringify(body));
    };
    if (scenario.caixa.mode === "error500") return send(500, { message: "erro interno simulado" });
    if (scenario.caixa.mode === "html")
      return send(200, "<html><body>Em manutenção</body></html>", "text/html");
    if (scenario.caixa.mode === "invalid")
      return send(200, fixture(scenario.caixa.invalid_fixture));
    if (contest) {
      const latest = fixture(scenario.caixa.latest[game] ?? `caixa/${game}.json`) as {
        numero?: number;
      } | null;
      if (latest && String(latest.numero) === contest) return send(200, latest);
      const specific = fixture(`caixa/${game}-${contest}.json`);
      return specific ? send(200, specific) : send(404, { message: "concurso não encontrado" });
    }
    const seqList = scenario.caixa.sequence[game];
    if (seqList && seqList.length) {
      const n = bump(`caixa:${game}`);
      const name = seqList[Math.min(n, seqList.length) - 1] as string;
      return send(200, fixture(name));
    }
    const body = fixture(scenario.caixa.latest[game] ?? `caixa/${game}.json`);
    return body ? send(200, body) : send(404, { message: "modalidade desconhecida" });
  };
  app.get("/portaldeloterias/api/:game", caixaHandler);
  app.get("/portaldeloterias/api/:game/:contest", caixaHandler);

  // ------------------------------------------------------------------ OpenAI
  app.get("/v1/models/:model", async (req, reply) => {
    const auth = req.headers.authorization ?? "";
    const status = auth.startsWith("Bearer ") ? 200 : 401;
    record("openai", "get_model", req, status);
    return status === 200
      ? { id: (req.params as { model: string }).model, object: "model", owned_by: "mock" }
      : reply.status(401).send(fixture("openai/error-401.json"));
  });

  app.post("/v1/responses", async (req, reply) => {
    const body = (req.body ?? {}) as {
      model?: string;
      text?: { format?: { type?: string; strict?: boolean } };
      input?: unknown;
      instructions?: string;
    };
    const reply_ = (status: number, payload: unknown) => {
      record("openai", "create_response", req, status);
      return reply.status(status).send(payload);
    };
    if (!(req.headers.authorization ?? "").startsWith("Bearer "))
      return reply_(401, fixture("openai/error-401.json"));
    // Contrato: sempre Structured Outputs estrito e modelo definido.
    if (
      !body.model ||
      body.text?.format?.type !== "json_schema" ||
      body.text?.format?.strict !== true
    ) {
      return reply_(400, {
        error: {
          message: "mock: requisição fora do contrato (model + text.format json_schema strict)",
          type: "invalid_request_error",
        },
      });
    }
    if (scenario.openai.delay_ms) await new Promise((r) => setTimeout(r, scenario.openai.delay_ms));
    const n = bump("openai");
    const failing =
      scenario.openai.fail_times > 0
        ? n <= scenario.openai.fail_times
        : scenario.openai.mode !== "ok";
    const mode =
      scenario.openai.fail_times > 0 && scenario.openai.mode === "ok"
        ? "error500"
        : scenario.openai.mode;
    if (failing) {
      if (mode === "error500") return reply_(500, fixture("openai/error-500.json"));
      if (mode === "error401") return reply_(401, fixture("openai/error-401.json"));
      if (mode === "forbidden") return reply_(200, fixture("openai/caption-forbidden.json"));
      if (mode === "invalid_json") return reply_(200, fixture("openai/caption-invalid-json.json"));
      if (mode === "timeout") {
        await new Promise((r) => setTimeout(r, 120_000));
        return reply_(504, { error: { message: "timeout" } });
      }
    }
    const facts = typeof body.input === "string" ? body.input : "";
    const game = /"modalidade":"([^"]+)"/.exec(facts)?.[1] ?? "loteria";
    const type = /"tipo_de_conteudo":"([^"]+)"/.exec(facts)?.[1] ?? "RESULT";
    const headline =
      type === "PREDICTION"
        ? `Palpite recreativo da ${game}`
        : type === "CHECK"
          ? `Conferimos o palpite da ${game}`
          : `Saiu o resultado da ${game}`;
    const caption = {
      headline,
      caption:
        "Confira os dados oficiais na arte e acompanhe com a gente. Conteúdo informativo e recreativo.",
      cta: 'Comente "EU QUERO" para continuar acompanhando nossos palpites e resultados.',
      hashtags: ["#loteria", "#loteriacursos"],
      alt_text: `Arte da Loteria Cursos sobre a ${game} com os dados oficiais do concurso.`,
    };
    const base = fixture("openai/caption.json") as Record<string, unknown>;
    return reply_(200, {
      ...base,
      model: body.model,
      output: [
        {
          id: "msg_mock",
          type: "message",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: JSON.stringify(caption), annotations: [] }],
        },
      ],
    });
  });

  // ------------------------------------------------------------------ Supabase Storage
  app.get("/storage/v1/bucket/:bucket", async (req, reply) => {
    const ok = req.headers.apikey === scenario.storage.key;
    record("storage", "get_bucket", req, ok ? 200 : 401);
    if (!ok) return reply.status(401).send({ message: "Invalid API key" });
    const { bucket } = req.params as { bucket: string };
    return { id: bucket, name: bucket, public: scenario.storage.bucket_public };
  });
  app.post("/storage/v1/object/:bucket/*", async (req, reply) => {
    const { bucket } = req.params as { bucket: string };
    const path = (req.params as { "*": string })["*"];
    if (req.headers.apikey !== scenario.storage.key) {
      record("storage", "upload", req, 401);
      return reply.status(401).send({ message: "Invalid API key" });
    }
    if (scenario.storage.mode === "error500") {
      record("storage", "upload", req, 500);
      return reply.status(500).send({ message: "storage indisponível (simulado)" });
    }
    const data = req.body as Buffer;
    files.set(`${bucket}/${path}`, {
      data,
      contentType: String(req.headers["content-type"] ?? "application/octet-stream"),
    });
    record("storage", "upload", req, 200);
    return { Key: `${bucket}/${path}`, Id: nextId("obj_") };
  });
  app.get("/storage/v1/object/public/:bucket/*", async (req, reply) => {
    const { bucket } = req.params as { bucket: string };
    const path = (req.params as { "*": string })["*"];
    const f = files.get(`${bucket}/${path}`);
    record("storage", "public_get", req, f ? 200 : 404);
    if (!f) return reply.status(404).send({ message: "not found" });
    return reply.type(f.contentType).send(f.data);
  });

  // ------------------------------------------------------------------ Meta Graph API
  const metaAuth = (req: FastifyRequest) => {
    const h = req.headers.authorization ?? "";
    return h === `Bearer ${scenario.meta.valid_token}`;
  };
  const metaReply = (
    req: FastifyRequest,
    reply: FastifyReply,
    op: string,
    status: number,
    body: unknown,
  ) => {
    record("meta", op, req, status);
    return reply.status(status).send(body);
  };

  app.get("/:version/me", async (req, reply) => {
    if (!metaAuth(req))
      return metaReply(req, reply, "me", 400, fixture("meta/error-invalid-token.json"));
    return metaReply(req, reply, "me", 200, fixture("meta/me.json"));
  });

  app.post("/:version/:node/media", async (req, reply) => {
    if (!metaAuth(req) || scenario.meta.create_mode === "invalid_token") {
      return metaReply(
        req,
        reply,
        "create_container",
        400,
        fixture("meta/error-invalid-token.json"),
      );
    }
    if (
      scenario.meta.create_mode === "rate_limit" &&
      bump("meta:create") <= scenario.meta.create_fail_times
    ) {
      reply.header("retry-after", "1");
      return metaReply(req, reply, "create_container", 429, fixture("meta/error-rate-limit.json"));
    }
    const body = (req.body ?? {}) as {
      image_url?: string;
      video_url?: string;
      caption?: string;
      media_type?: string;
    };
    const mediaUrl = body.image_url ?? body.video_url;
    if (!mediaUrl || !/^https?:\/\//.test(mediaUrl)) {
      return metaReply(
        req,
        reply,
        "create_container",
        400,
        graphError("Invalid parameter: image_url", 100, 2207004),
      );
    }
    if (scenario.meta.fetch_media) {
      // Simula a "ingestão": a Meta baixa a mídia pela URL pública. Exige JPEG.
      try {
        const res = await fetch(mediaUrl, { signal: AbortSignal.timeout(10_000) });
        const buf = Buffer.from(await res.arrayBuffer());
        if (!res.ok || buf[0] !== 0xff || buf[1] !== 0xd8) {
          return metaReply(
            req,
            reply,
            "create_container",
            400,
            graphError(
              "Media download has failed. The media URI doesn't meet our requirements.",
              9004,
              2207052,
            ),
          );
        }
      } catch {
        return metaReply(
          req,
          reply,
          "create_container",
          400,
          graphError("Media download has failed.", 9004, 2207052),
        );
      }
    }
    const id = nextId("1790");
    containers.set(id, {
      status: "IN_PROGRESS",
      polls: 0,
      media_url: mediaUrl,
      caption: body.caption ?? "",
    });
    return metaReply(req, reply, "create_container", 200, { id });
  });

  app.post("/:version/:node/media_publish", async (req, reply) => {
    if (!metaAuth(req) || scenario.meta.publish_mode === "invalid_token") {
      return metaReply(req, reply, "media_publish", 400, fixture("meta/error-invalid-token.json"));
    }
    if (
      scenario.meta.publish_mode === "rate_limit" &&
      bump("meta:publish") <= scenario.meta.publish_fail_times
    ) {
      reply.header("retry-after", "1");
      return metaReply(req, reply, "media_publish", 429, fixture("meta/error-rate-limit.json"));
    }
    if (
      scenario.meta.publish_mode === "server_error" &&
      bump("meta:publish") <= scenario.meta.publish_fail_times
    ) {
      return metaReply(req, reply, "media_publish", 500, fixture("meta/error-server.json"));
    }
    const { creation_id } = (req.body ?? {}) as { creation_id?: string };
    const c = creation_id ? containers.get(creation_id) : undefined;
    if (!c)
      return metaReply(
        req,
        reply,
        "media_publish",
        400,
        graphError("Invalid parameter: creation_id", 100),
      );
    if (c.status === "PUBLISHED")
      return metaReply(
        req,
        reply,
        "media_publish",
        400,
        graphError("Media already published", 100, 2207006),
      );
    if (c.status !== "FINISHED")
      return metaReply(
        req,
        reply,
        "media_publish",
        400,
        fixture("meta/error-media-not-ready.json"),
      );
    c.status = "PUBLISHED";
    return metaReply(req, reply, "media_publish", 200, { id: nextId("1780") });
  });

  app.get("/:version/:node/content_publishing_limit", async (req, reply) => {
    if (!metaAuth(req))
      return metaReply(
        req,
        reply,
        "publishing_limit",
        400,
        fixture("meta/error-invalid-token.json"),
      );
    return metaReply(req, reply, "publishing_limit", 200, fixture("meta/publishing-limit.json"));
  });

  app.get("/:version/:node/insights", async (req, reply) => {
    if (!metaAuth(req))
      return metaReply(req, reply, "insights", 400, fixture("meta/error-invalid-token.json"));
    const metrics = String((req.query as { metric?: string }).metric ?? "")
      .split(",")
      .filter(Boolean);
    const unknown = metrics.filter((m) => !scenario.meta.supported_metrics.includes(m));
    if (!metrics.length || unknown.length) {
      return metaReply(
        req,
        reply,
        "insights",
        400,
        graphError(
          `(#100) metric[0] must be one of the following values: ${scenario.meta.supported_metrics.join(", ")}`,
          100,
        ),
      );
    }
    return metaReply(req, reply, "insights", 200, {
      data: metrics.map((name, i) => ({
        name,
        period: "lifetime",
        values: [{ value: 100 + i * 7 }],
        title: name,
        id: `x/insights/${name}/lifetime`,
      })),
    });
  });

  // Status do container (rota genérica por último).
  app.get("/:version/:node", async (req, reply) => {
    if (!metaAuth(req))
      return metaReply(
        req,
        reply,
        "container_status",
        400,
        fixture("meta/error-invalid-token.json"),
      );
    const { node: containerId } = req.params as { node: string };
    const c = containers.get(containerId);
    if (!c)
      return metaReply(
        req,
        reply,
        "container_status",
        400,
        graphError("Unsupported get request.", 100, 33),
      );
    c.polls += 1;
    if (c.status !== "PUBLISHED") {
      if (scenario.meta.container_mode === "error") c.status = "ERROR";
      else if (scenario.meta.container_mode === "expired") c.status = "EXPIRED";
      else if (
        scenario.meta.container_mode === "finish_after" &&
        c.polls >= scenario.meta.finish_after_polls
      )
        c.status = "FINISHED";
    }
    return metaReply(req, reply, "container_status", 200, {
      status_code: c.status,
      id: containerId,
      ...(c.status === "ERROR" ? { status: "Error: simulated" } : {}),
    });
  });

  return app;
}

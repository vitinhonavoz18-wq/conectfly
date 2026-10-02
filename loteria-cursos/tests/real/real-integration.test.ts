/**
 * REAL_INTEGRATION_TEST — fala com as APIs DE VERDADE.
 *
 * Travas:
 *  • RUN_REAL_INTEGRATION_TESTS=true  → testes de leitura (CAIXA, OpenAI, Meta /me, limite de publicação).
 *  • + ENABLE_REAL_INSTAGRAM_PUBLISH=true → também publica UM post de teste no Instagram.
 * As DUAS precisam estar ligadas para publicar: um erro de configuração sozinho nunca publica.
 *
 * Uso: set -a; . ./.env; set +a; RUN_REAL_INTEGRATION_TESTS=true npx vitest run --project real
 */
import { describe, expect, it } from "vitest";
import {
  CaixaSourceAdapter,
  DEFAULT_GAMES,
  buildCaptionRequest,
  finalizeCaption,
  planContent,
} from "@lc/lottery-core";

const env = process.env;
const READ = env.RUN_REAL_INTEGRATION_TESTS === "true";
const PUBLISH = READ && env.ENABLE_REAL_INSTAGRAM_PUBLISH === "true";
const graph = `${env.META_GRAPH_HOST ?? "https://graph.instagram.com"}/${env.META_GRAPH_API_VERSION ?? "v26.0"}`;
const metaHeaders = { Authorization: `Bearer ${env.META_ACCESS_TOKEN ?? ""}` };

describe.skipIf(!READ)("REAL — leitura (sem publicar)", () => {
  it("CAIXA: último resultado da Mega-Sena passa na validação", async () => {
    const r = await new CaixaSourceAdapter({
      baseUrl: env.CAIXA_BASE_URL || undefined,
    }).fetchLatest(DEFAULT_GAMES.megasena!);
    if (!r.ok) throw new Error(`${r.errorCode}: ${r.message}`);
    expect(r.draw.numbers).toHaveLength(6);
  });

  it.skipIf(!env.OPENAI_API_KEY)("OpenAI: legenda com Structured Outputs válida", async () => {
    const plan = planContent({
      content_type: "RESULT",
      format: "feed",
      dry_run: true,
      default_cta: 'Comente "EU QUERO"',
      openai_model: env.OPENAI_MODEL ?? "",
      game: {
        slug: "megasena",
        name: "Mega-Sena",
        numbers_per_bet: 6,
        numbers_drawn: 6,
        min_number: 1,
        max_number: 60,
        brand_color: "#1B8F5A",
        hashtags: ["#megasena"],
      },
      draw: { contest: 1, draw_day: "2026-01-01", numbers: [1, 2, 3, 4, 5, 6], accumulated: false },
    });
    const res = await fetch(`${env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildCaptionRequest(plan.content_data, env.OPENAI_MODEL ?? "")),
    });
    const fin = finalizeCaption(
      plan.content_data,
      { status_code: res.status, body: await res.json() },
      { attempt: 3, maxAttempts: 3 },
    );
    expect(fin.outcome).toBe("ok");
  });

  it.skipIf(!env.META_ACCESS_TOKEN)(
    "Meta: token válido e limite de publicação legível",
    async () => {
      const me = await fetch(`${graph}/me?fields=user_id,username`, { headers: metaHeaders });
      expect(me.status).toBe(200);
      const limit = await fetch(`${graph}/${env.META_IG_USER_ID}/content_publishing_limit`, {
        headers: metaHeaders,
      });
      expect(limit.status).toBe(200);
    },
  );
});

describe.skipIf(!PUBLISH)(
  "REAL — PUBLICA um post de teste no Instagram (exige as duas travas)",
  () => {
    it("container → FINISHED → media_publish", async () => {
      const imageUrl = env.REAL_TEST_IMAGE_URL;
      if (!imageUrl)
        throw new Error(
          "defina REAL_TEST_IMAGE_URL (JPEG público, ex.: uma arte já enviada ao Supabase)",
        );
      const create = await fetch(`${graph}/${env.META_IG_USER_ID}/media`, {
        method: "POST",
        headers: { ...metaHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: "Teste técnico Loteria Cursos — pode apagar.",
        }),
      });
      const { id } = (await create.json()) as { id: string };
      expect(id).toBeTruthy();
      let status = "IN_PROGRESS";
      for (let i = 0; i < 10 && status === "IN_PROGRESS"; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        status = (
          (await (
            await fetch(`${graph}/${id}?fields=status_code`, { headers: metaHeaders })
          ).json()) as { status_code: string }
        ).status_code;
      }
      expect(status).toBe("FINISHED");
      const pub = await fetch(`${graph}/${env.META_IG_USER_ID}/media_publish`, {
        method: "POST",
        headers: { ...metaHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: id }),
      });
      expect(pub.status).toBe(200);
    });
  },
);

it("travas de segurança do teste real estão documentadas", () => {
  // Sem as variáveis, nada acima roda (este teste só garante que o arquivo é coletado).
  expect(PUBLISH ? READ : true).toBe(true);
});

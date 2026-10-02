import { describe, expect, it } from "vitest";
import {
  planContent,
  finalizeCaption,
  fallbackCaption,
  checkCompliance,
  checkDataIntegrity,
  captionOutputSchema,
  extractOutputText,
  CAPTION_JSON_SCHEMA,
  INSTAGRAM_CAPTION_LIMIT,
  assembleCaption,
  DEFAULT_GAMES,
  PlanError,
} from "../src/index.ts";
import { fixture } from "./helpers.ts";

const CTA = 'Comente "EU QUERO" para continuar acompanhando nossos palpites e resultados.';
const gameInput = (slug: string) => {
  const g = DEFAULT_GAMES[slug]!;
  return {
    slug: g.slug,
    name: g.name,
    numbers_per_bet: g.numbersPerBet,
    numbers_drawn: g.numbersDrawn,
    min_number: g.minNumber,
    max_number: g.maxNumber,
    brand_color: g.brandColor,
    hashtags: g.hashtags,
  };
};
const draw = {
  contest: 3065,
  draw_day: "2026-10-01",
  numbers: [4, 17, 28, 39, 44, 57],
  accumulated: true,
  estimated_prize: 45000000,
  next_draw_day: "2026-10-04",
  next_contest: 3066,
};
const basePlan = {
  content_type: "RESULT",
  format: "feed",
  dry_run: true,
  brand_name: "LOTERIA CURSOS",
  default_cta: CTA,
  openai_model: "gpt-test",
  game: gameInput("megasena"),
  draw,
};

describe("planContent", () => {
  it("RESULT: chave, caminho, arte e pedido de legenda determinísticos", () => {
    const plan = planContent(basePlan);
    expect(plan.idempotency_key).toBe("result:megasena:3065:feed:dryrun");
    expect(plan.storage_path).toBe("megasena/results/megasena-result-3065-feed-dryrun.jpg");
    expect(plan.render_payload).toMatchObject({
      template: "RESULT",
      game: "megasena",
      contest: 3065,
      numbers: [4, 17, 28, 39, 44, 57],
      format: "feed",
      headline: "RESULTADO",
      cta: CTA,
    });
    expect(plan.width).toBe(1080);
    expect(plan.height).toBe(1350);
    expect(plan.media_type).toBe("IMAGE");
    expect(plan.caption_request.model).toBe("gpt-test");
    expect(plan.caption_request.text.format.type).toBe("json_schema");
    expect(plan.caption_request.text.format.strict).toBe(true);
    expect(plan.fallback_caption.caption).toContain("RESULTADO MEGA-SENA");
    expect(planContent(basePlan)).toEqual(plan);
  });
  it("produção (dry_run=false) usa a chave do enunciado", () => {
    expect(planContent({ ...basePlan, dry_run: false }).idempotency_key).toBe(
      "result:megasena:3065:feed",
    );
  });
  it("story usa 1080x1920", () => {
    const p = planContent({ ...basePlan, format: "story" });
    expect([p.width, p.height, p.media_type]).toEqual([1080, 1920, "STORIES"]);
  });
  it("CHECK recalcula coincidências deterministicamente", () => {
    const plan = planContent({
      ...basePlan,
      content_type: "CHECK",
      draw: { ...draw, numbers: [4, 10, 28, 39, 51, 60] },
      prediction: {
        contest: 3065,
        numbers: [4, 17, 28, 39, 44, 57],
        method: "m",
        algorithm_version: "1",
      },
    });
    expect(plan.content_data.hits).toBe(3);
    expect(plan.content_data.matching_numbers).toEqual([4, 28, 39]);
    expect(plan.fallback_caption.caption).toContain("Coincidências: 3 dezenas");
    expect(plan.fallback_caption.caption).toContain("Coincidência não significa prêmio");
  });
  it("recusa dados oficiais inválidos ou incoerentes", () => {
    expect(() =>
      planContent({ ...basePlan, draw: { ...draw, numbers: [4, 4, 28, 39, 44, 57] } }),
    ).toThrow(PlanError);
    expect(() => planContent({ ...basePlan, draw: undefined })).toThrow(PlanError);
    expect(() =>
      planContent({
        ...basePlan,
        content_type: "CHECK",
        prediction: {
          contest: 3000,
          numbers: [1, 2, 3, 4, 5, 6],
          method: "m",
          algorithm_version: "1",
        },
      }),
    ).toThrow(/não pode ser conferido/);
    expect(() => planContent({ ...basePlan, content_type: "UNKNOWN" })).toThrow(PlanError);
  });
});

describe("schema da legenda (Structured Outputs)", () => {
  it("JSON Schema é strict-compatível: todos os campos obrigatórios e sem campos extras", () => {
    expect(CAPTION_JSON_SCHEMA.additionalProperties).toBe(false);
    expect([...CAPTION_JSON_SCHEMA.required].sort()).toEqual(
      Object.keys(CAPTION_JSON_SCHEMA.properties).sort(),
    );
  });
  it("fixture de legenda passa no validador", () => {
    const text = extractOutputText(fixture("openai/caption.json")).text!;
    expect(captionOutputSchema.safeParse(JSON.parse(text)).success).toBe(true);
  });
  it("mais de 5 hashtags é rejeitado", () => {
    const r = captionOutputSchema.safeParse({
      headline: "abc",
      caption: "x".repeat(30),
      cta: "cta",
      hashtags: ["#a1", "#b1", "#c1", "#d1", "#e1", "#f1"],
      alt_text: "descrição longa",
    });
    expect(r.success).toBe(false);
  });
});

describe("finalizeCaption", () => {
  const content = planContent(basePlan).content_data;
  const opts = { attempt: 1, maxAttempts: 3, random: () => 0.5 };

  it("aceita resposta válida e monta legenda com dados oficiais inseridos por código", () => {
    const r = finalizeCaption(
      content,
      { status_code: 200, body: fixture("openai/caption.json") },
      opts,
    );
    expect(r.outcome).toBe("ok");
    if (r.outcome === "retry") return;
    expect(r.source).toBe("openai");
    expect(r.caption).toContain("Dezenas sorteadas: 04 · 17 · 28 · 39 · 44 · 57");
    expect(r.caption).toContain("Concurso 3065");
    expect(r.caption).toContain(CTA);
    expect(r.hashtags.length).toBeLessThanOrEqual(5);
  });
  it.each([
    ["linguagem proibida", "openai/caption-forbidden.json"],
    ["IA listando dezenas", "openai/caption-lists-numbers.json"],
    ["texto que não é JSON", "openai/caption-invalid-json.json"],
    ["JSON fora do schema", "openai/caption-wrong-schema.json"],
    ["resposta incompleta", "openai/incomplete.json"],
  ])("%s → tenta de novo", (_l, file) => {
    const r = finalizeCaption(content, { status_code: 200, body: fixture(file) }, opts);
    expect(r.outcome).toBe("retry");
  });
  it("na última tentativa cai para a legenda de reserva (sem perder dado oficial)", () => {
    const r = finalizeCaption(
      content,
      { status_code: 200, body: fixture("openai/caption-forbidden.json") },
      { ...opts, attempt: 3 },
    );
    expect(r.outcome).toBe("fallback");
    if (r.outcome === "retry") return;
    expect(r.caption).toContain("RESULTADO MEGA-SENA");
    expect(r.caption).toContain("04 · 17 · 28 · 39 · 44 · 57");
  });
  it("OpenAI fora do ar (500/timeout) → retry com backoff; 401 → reserva imediata", () => {
    const r500 = finalizeCaption(
      content,
      { status_code: 500, body: fixture("openai/error-500.json") },
      opts,
    );
    expect(r500).toMatchObject({ outcome: "retry", delay_seconds: 5 });
    const rNet = finalizeCaption(
      content,
      { status_code: 0, error: "ETIMEDOUT" },
      { ...opts, attempt: 2 },
    );
    expect(rNet).toMatchObject({ outcome: "retry", delay_seconds: 15 });
    expect(
      finalizeCaption(content, { status_code: 401, body: fixture("openai/error-401.json") }, opts)
        .outcome,
    ).toBe("fallback");
    expect(
      finalizeCaption(content, { status_code: 200, body: fixture("openai/refusal.json") }, opts)
        .outcome,
    ).toBe("fallback");
  });
  it("fallback do enunciado", () => {
    const f = fallbackCaption(content);
    expect(f.caption.startsWith("RESULTADO MEGA-SENA\n\nMega-Sena • Concurso 3065")).toBe(true);
    expect(f.caption).toContain("Confira sempre as informações oficiais.");
  });
  it("legenda nunca passa do limite do Instagram", () => {
    const long = assembleCaption(content, {
      headline: "T",
      body: "a".repeat(5000),
      cta: CTA,
      hashtags: [],
    });
    expect(long.length).toBeLessThanOrEqual(INSTAGRAM_CAPTION_LIMIT);
    expect(long).toContain(CTA);
  });
});

describe("compliance editorial", () => {
  it.each([
    "Números garantidos!",
    "palpite CERTEIRO",
    "Você vai ganhar",
    "chance garantida",
    "Método infalível",
    "Isso aumenta suas chances",
  ])("bloqueia: %s", (t) => {
    expect(checkCompliance({ caption: t }).length).toBeGreaterThan(0);
  });
  it.each([
    "Palpite gerado com auxílio de IA",
    "Combinação criada a partir de critérios estatísticos",
    "Conteúdo recreativo, sem garantia de acerto",
  ])("permite: %s", (t) => {
    expect(checkCompliance({ caption: t })).toEqual([]);
  });
  it("integridade: IA não pode citar outro concurso, listar dezenas ou valores", () => {
    expect(checkDataIntegrity("Concurso 3066 chegando!", 3065).map((i) => i.code)).toContain(
      "CONTEST_MISMATCH",
    );
    expect(checkDataIntegrity("Concurso 3065 saiu!", 3065)).toEqual([]);
    expect(checkDataIntegrity("Saíram 04 - 17 - 28", 3065).map((i) => i.code)).toContain(
      "NUMBER_LIST",
    );
    expect(checkDataIntegrity("Prêmio de R$ 45 milhões", 3065).map((i) => i.code)).toContain(
      "MONEY_VALUE",
    );
    expect(checkDataIntegrity("6 dezenas e 1 sonho", 3065)).toEqual([]);
  });
});

import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it, beforeAll } from "vitest";
import { createLogger } from "@lc/shared";
import { buildRenderer } from "../src/app.ts";
import { LocalStorage, safeJoin } from "../src/storage.ts";
import { headlineSize, shade } from "../src/templates/index.ts";

const out = mkdtempSync(join(tmpdir(), "lc-render-"));
const silent = createLogger({ service: "test", sink: () => {} });
const app = buildRenderer({
  outputDir: out,
  storage: new LocalStorage(out, "http://renderer.test"),
  logger: silent,
});
const CTA = 'Comente "EU QUERO" para continuar acompanhando nossos palpites e resultados.';

const RESULT = {
  template: "RESULT",
  game: "megasena",
  contest: 3065,
  numbers: [4, 17, 28, 39, 44, 57],
  headline: "RESULTADO",
  cta: CTA,
  format: "feed",
};

const CASES: Record<string, Record<string, unknown>> = {
  "megasena-result-feed": {
    ...RESULT,
    draw_day: "2026-10-01",
    accumulated: true,
    estimated_prize: 45000000,
  },
  "lotofacil-prediction-feed": {
    template: "PREDICTION",
    game: "lotofacil",
    contest: 3503,
    numbers: [1, 2, 4, 5, 7, 9, 11, 12, 14, 16, 18, 20, 22, 23, 25],
    headline: "PALPITE DO DIA",
    cta: CTA,
  },
  "quina-check-feed": {
    template: "CHECK",
    game: "quina",
    contest: 6870,
    numbers: [3, 18, 41, 62, 77],
    prediction_numbers: [3, 10, 41, 55, 77],
    matching_numbers: [3, 41, 77],
    hits: 3,
    headline: "CONFIRA NOSSO PALPITE",
    cta: CTA,
  },
  "lotomania-result-story": {
    template: "RESULT",
    game: "lotomania",
    contest: 2860,
    format: "story",
    numbers: [0, 3, 11, 12, 21, 23, 34, 45, 47, 56, 59, 61, 67, 72, 78, 84, 88, 90, 95, 99],
    headline: "RESULTADO",
    cta: CTA,
  },
  "megasena-educational-feed": {
    template: "EDUCATIONAL",
    game: "megasena",
    contest: 1,
    headline: "VOCÊ SABIA?",
    educational: {
      title: "Todas as combinações",
      text: "Numa loteria justa, toda combinação tem a mesma chance de sair.",
    },
  },
};

const render = (payload: Record<string, unknown>) =>
  app.inject({ method: "POST", url: "/render", payload });

describe("renderer HTTP", () => {
  it("GET /health", async () => {
    const r = await app.inject({ method: "GET", url: "/health" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      status: "ok",
      templates: ["RESULT", "PREDICTION", "CHECK", "EDUCATIONAL"],
    });
  });

  it("feed: HTTP 200, 1080x1350, JPEG real, arquivo existe e não está vazio", async () => {
    const r = await render({
      ...RESULT,
      storage_path: "megasena/results/megasena-result-3065-feed.jpg",
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body).toMatchObject({
      success: true,
      width: 1080,
      height: 1350,
      mime_type: "image/jpeg",
      storage_path: "megasena/results/megasena-result-3065-feed.jpg",
    });
    expect(existsSync(body.file)).toBe(true);
    expect(statSync(body.file).size).toBeGreaterThan(10_000);
    const buf = readFileSync(body.file);
    expect([...buf.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]); // assinatura JPEG
    const meta = await sharp(buf).metadata();
    expect([meta.format, meta.width, meta.height, meta.space]).toEqual([
      "jpeg",
      1080,
      1350,
      "srgb",
    ]);
    expect(body.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("story: 1080x1920", async () => {
    const r = await render({ ...RESULT, format: "story" });
    expect([r.json().width, r.json().height]).toEqual([1080, 1920]);
  });

  it("PNG opcional", async () => {
    const r = await render({ ...RESULT, output_format: "png" });
    expect(r.json().mime_type).toBe("image/png");
    expect([...readFileSync(r.json().file).subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("é determinístico (mesma entrada ⇒ mesmo arquivo)", async () => {
    const a = (await render(RESULT)).json();
    const b = (await render(RESULT)).json();
    expect(a.sha256).toBe(b.sha256);
  });

  it("cor de fundo vem da configuração/payload, não do código", async () => {
    const green = (
      await render({ ...RESULT, storage_path: "megasena/colors/megasena-green.jpg" })
    ).json();
    const custom = (
      await render({
        ...RESULT,
        brand_color: "#C0392B",
        storage_path: "megasena/colors/megasena-red.jpg",
      })
    ).json();
    const corner = async (file: string) => {
      const { data } = await sharp(file)
        .extract({ left: 4, top: 4, width: 1, height: 1 })
        .raw()
        .toBuffer({ resolveWithObject: true });
      return [...data];
    };
    const [r1, g1] = await corner(green.file);
    const [r2, g2] = await corner(custom.file);
    expect(g1!).toBeGreaterThan(r1!); // verde da Mega-Sena
    expect(r2!).toBeGreaterThan(g2!); // vermelho passado no payload
  });

  it("guarda no storage e devolve URL pública", async () => {
    const r = await render({
      ...RESULT,
      store: true,
      storage_path: "megasena/results/megasena-result-3065-feed.jpg",
    });
    expect(r.json().public_url).toBe(
      "http://renderer.test/files/megasena/results/megasena-result-3065-feed.jpg",
    );
    const served = await app.inject({
      method: "GET",
      url: "/files/megasena/results/megasena-result-3065-feed.jpg",
    });
    expect(served.statusCode).toBe(200);
    expect(served.headers["content-type"]).toBe("image/jpeg");
  });

  it.each([
    ["template inválido", { ...RESULT, template: "MEME" }],
    ["dezena repetida", { ...RESULT, numbers: [4, 4, 28, 39, 44, 57] }],
    ["dezena como texto", { ...RESULT, numbers: ["04", 17] }],
    ["sem dezenas", { ...RESULT, numbers: [] }],
    ["CHECK sem palpite", { ...RESULT, template: "CHECK" }],
    ["store sem caminho", { ...RESULT, store: true }],
    ["caminho malicioso", { ...RESULT, storage_path: "../../etc/passwd.jpg" }],
    ["concurso negativo", { ...RESULT, contest: -1 }],
    ["formato desconhecido", { ...RESULT, format: "tiktok" }],
  ])("payload inválido (%s) → 400", async (_l, payload) => {
    const r = await render(payload as Record<string, unknown>);
    expect(r.statusCode).toBe(400);
    expect(r.json().success).toBe(false);
  });

  it("não serve arquivos fora da pasta", async () => {
    expect((await app.inject({ method: "GET", url: "/files/../../etc/passwd" })).statusCode).toBe(
      404,
    );
    expect(() => safeJoin(out, "../x.jpg")).toThrow();
  });

  it("helpers de layout", () => {
    expect(headlineSize("RESULTADO", false)).toBe(92);
    expect(headlineSize("CONFIRA NOSSO PALPITE", false)).toBeLessThan(92);
    expect(shade("#ffffff", 0.5)).toBe("#808080");
  });
});

// Regressão visual pragmática: hash das artes de referência. Se mudar de propósito,
// rode UPDATE_RENDER_SNAPSHOTS=1 npm test e confira as imagens em .tmp/render-snapshots/.
describe("regressão visual (hash das artes de referência)", () => {
  const snapFile = join(import.meta.dirname, "__snapshots__", "render-hashes.json");
  let stored: Record<string, string> = {};
  beforeAll(() => {
    stored = existsSync(snapFile) ? JSON.parse(readFileSync(snapFile, "utf8")) : {};
  });
  it("todas as artes de referência batem com o snapshot", async () => {
    const current: Record<string, string> = {};
    for (const [name, payload] of Object.entries(CASES)) {
      const r = await render(payload);
      expect(r.statusCode, name).toBe(200);
      current[name] = r.json().sha256;
    }
    if (process.env.UPDATE_RENDER_SNAPSHOTS === "1" || Object.keys(stored).length === 0) {
      writeFileSync(snapFile, JSON.stringify(current, null, 2) + "\n");
      return;
    }
    expect(current).toEqual(stored);
  });
});

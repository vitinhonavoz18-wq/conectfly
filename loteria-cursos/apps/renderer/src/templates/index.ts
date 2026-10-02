import type { BrandConfig } from "../brand.ts";
import type { RenderRequest } from "../schema.ts";
import { h, text, type SatoriNode } from "./h.ts";

const pad = (n: number) => String(n).padStart(2, "0");
const brDay = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : null);
const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

/** Escurece uma cor hex (para o degradê de fundo). */
export function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) =>
    Math.max(0, Math.min(255, Math.round(x * factor))),
  );
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function ballSize(count: number, story: boolean): number {
  const base = count <= 6 ? 150 : count <= 15 ? 120 : count <= 20 ? 104 : 74;
  return story ? Math.round(base * 1.05) : base;
}

function balls(
  numbers: number[],
  opts: {
    color: string;
    brand: BrandConfig;
    highlight?: Set<number>;
    story: boolean;
    size?: number;
    perRow?: number;
  },
) {
  const size = opts.size ?? ballSize(numbers.length, opts.story);
  const perRow = opts.perRow ?? (numbers.length <= 6 ? 3 : numbers.length <= 20 ? 5 : 10);
  const gap = Math.round(size * 0.18);
  return h(
    "div",
    { flexWrap: "wrap", justifyContent: "center", width: perRow * size + (perRow - 1) * gap, gap },
    ...numbers.map((n) => {
      const hit = opts.highlight?.has(n);
      return h(
        "div",
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: hit
            ? opts.brand.colors.match_highlight
            : opts.brand.colors.ball_background,
          color: hit ? opts.brand.colors.match_text : opts.color,
          fontSize: Math.round(size * 0.42),
          fontWeight: 800,
        },
        pad(n),
      );
    }),
  );
}

/** Título encolhe para caber em uma linha (até ~20 caracteres). */
export function headlineSize(headline: string, story: boolean): number {
  const n = headline.length;
  const base = story ? 104 : 92;
  if (n <= 12) return base;
  return Math.max(48, Math.min(base, Math.floor(1300 / n)));
}

export interface TemplateContext {
  req: RenderRequest;
  brand: BrandConfig;
  width: number;
  height: number;
}

/** Monta a arte. Todo texto vem de dados oficiais/configuração — nada gerado por IA. */
export function buildTemplate({ req, brand, width, height }: TemplateContext): SatoriNode {
  const story = req.format === "story";
  const gameCfg = brand.games[req.game];
  const color = req.brand_color ?? gameCfg?.color ?? brand.default_game_color;
  const gameName = req.game_name ?? gameCfg?.name ?? req.game;
  const brandName = req.brand_name ?? brand.brand_name;
  const day = brDay(req.draw_day);
  const fg = brand.colors.text_on_brand;
  const pad64 = story ? 80 : 64;

  const header = h(
    "div",
    { width: "100%", justifyContent: "space-between", alignItems: "center" },
    text({ fontSize: 34, fontWeight: 800, letterSpacing: 6, color: fg }, brandName),
    h(
      "div",
      { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 40, padding: "12px 28px" },
      text({ fontSize: 30, fontWeight: 700, color: fg }, gameName),
    ),
  );

  const subtitle = text(
    { fontSize: story ? 44 : 40, fontWeight: 700, color: fg, opacity: 0.95 },
    `Concurso ${req.contest}${day ? ` • ${day}` : ""}`,
  );

  let body: SatoriNode;
  switch (req.template) {
    case "CHECK": {
      const hits = new Set(req.matching_numbers ?? []);
      const pred = req.prediction_numbers ?? [];
      const many = Math.max(pred.length, req.numbers.length) > 15;
      const size = many
        ? story
          ? 68
          : 56
        : Math.min(ballSize(Math.max(pred.length, req.numbers.length), story), 110);
      const perRow = (n: number) => (many ? 10 : n <= 6 ? 6 : 5);
      const hitCount = req.hits ?? hits.size;
      body = h(
        "div",
        { flexDirection: "column", alignItems: "center", gap: story ? 40 : 24 },
        text({ fontSize: 32, fontWeight: 700, color: fg }, "Palpite"),
        balls(pred, { color, brand, highlight: hits, story, size, perRow: perRow(pred.length) }),
        text({ fontSize: 32, fontWeight: 700, color: fg }, "Resultado oficial"),
        balls(req.numbers, {
          color,
          brand,
          highlight: hits,
          story,
          size,
          perRow: perRow(req.numbers.length),
        }),
        h(
          "div",
          { backgroundColor: brand.colors.match_highlight, borderRadius: 24, padding: "14px 34px" },
          text(
            { fontSize: 40, fontWeight: 800, color: brand.colors.match_text },
            `${hitCount} ${hitCount === 1 ? "coincidência" : "coincidências"}`,
          ),
        ),
      );
      break;
    }
    case "EDUCATIONAL":
      body = h(
        "div",
        { flexDirection: "column", alignItems: "center", gap: 30, maxWidth: width - 2 * pad64 },
        text(
          { fontSize: 56, fontWeight: 800, color: fg, textAlign: "center" },
          req.educational?.title ?? "",
        ),
        text(
          { fontSize: 36, fontWeight: 400, color: fg, textAlign: "center", lineHeight: 1.4 },
          req.educational?.text ?? "",
        ),
      );
      break;
    default: {
      const extra =
        req.template === "RESULT" && req.accumulated
          ? h(
              "div",
              {
                flexDirection: "column",
                alignItems: "center",
                backgroundColor: "rgba(0,0,0,0.22)",
                borderRadius: 28,
                padding: "22px 40px",
                marginTop: 20,
              },
              text(
                {
                  fontSize: 46,
                  fontWeight: 800,
                  color: brand.colors.match_highlight,
                  letterSpacing: 3,
                },
                "ACUMULOU!",
              ),
              req.estimated_prize
                ? text(
                    { fontSize: 32, fontWeight: 700, color: fg },
                    `Estimativa oficial: ${money(req.estimated_prize)}`,
                  )
                : null,
            )
          : req.template === "PREDICTION"
            ? text(
                {
                  fontSize: 28,
                  fontWeight: 400,
                  color: fg,
                  textAlign: "center",
                  maxWidth: width - 2 * pad64,
                  marginTop: 20,
                },
                brand.prediction_note,
              )
            : null;
      body = h(
        "div",
        { flexDirection: "column", alignItems: "center", gap: story ? 50 : 34 },
        balls(req.numbers, { color, brand, story }),
        extra,
      );
    }
  }

  return h(
    "div",
    {
      width,
      height,
      flexDirection: "column",
      justifyContent: "space-between",
      alignItems: "center",
      padding: pad64,
      backgroundColor: color,
      backgroundImage: `linear-gradient(160deg, ${color} 0%, ${shade(color, 0.62)} 100%)`,
      fontFamily: brand.font_family,
    },
    header,
    h(
      "div",
      { flexDirection: "column", alignItems: "center", gap: story ? 60 : 36 },
      text(
        {
          fontSize: headlineSize(req.headline, story),
          fontWeight: 900,
          color: fg,
          letterSpacing: 2,
          textAlign: "center",
        },
        req.headline,
      ),
      subtitle,
      body,
    ),
    h(
      "div",
      { flexDirection: "column", alignItems: "center", gap: 16, width: "100%" },
      req.cta
        ? text(
            {
              fontSize: 30,
              fontWeight: 700,
              color: fg,
              textAlign: "center",
              maxWidth: width - 2 * pad64,
            },
            req.cta,
          )
        : null,
      text(
        {
          fontSize: 20,
          fontWeight: 400,
          color: brand.colors.footer_text,
          textAlign: "center",
          opacity: 0.85,
          maxWidth: width - 2 * pad64,
        },
        brand.disclaimer,
      ),
    ),
  );
}

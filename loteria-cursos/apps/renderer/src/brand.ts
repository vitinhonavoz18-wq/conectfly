import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface BrandConfig {
  brand_name: string;
  font_family: string;
  colors: {
    text_on_brand: string;
    ball_background: string;
    match_highlight: string;
    match_text: string;
    footer_text: string;
  };
  games: Record<string, { name: string; color: string }>;
  default_game_color: string;
  disclaimer: string;
  prediction_note: string;
}

/** Identidade visual vem de configuração (config/brand.json ou BRAND_CONFIG_PATH), não do código. */
export function loadBrandConfig(path = process.env.BRAND_CONFIG_PATH): BrandConfig {
  const file = path ?? findDefault();
  return JSON.parse(readFileSync(file, "utf8")) as BrandConfig;
}

function findDefault(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    join(here, "..", "config", "brand.json"),
    join(here, "config", "brand.json"),
    join(process.cwd(), "config", "brand.json"),
  ]) {
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error("config/brand.json não encontrado");
}

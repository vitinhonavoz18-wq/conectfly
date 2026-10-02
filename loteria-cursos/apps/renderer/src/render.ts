import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { sha256Hex } from "@lc/shared";
import type { BrandConfig } from "./brand.ts";
import { FORMATS, type RenderRequest } from "./schema.ts";
import { buildTemplate } from "./templates/index.ts";

type FontWeight = 400 | 700 | 800 | 900;
const FONT_FILES: Record<FontWeight, string> = {
  400: "Montserrat_400Regular.ttf",
  700: "Montserrat_700Bold.ttf",
  800: "Montserrat_800ExtraBold.ttf",
  900: "Montserrat_900Black.ttf",
};
let fontsCache: Array<{ name: string; data: Buffer; weight: FontWeight; style: "normal" }> | null =
  null;

function fontsDir(): string {
  if (process.env.FONTS_DIR) return process.env.FONTS_DIR;
  const here = dirname(fileURLToPath(import.meta.url));
  // src/ (desenvolvimento) ou dist/ (imagem Docker): as fontes ficam em ../assets/fonts
  for (const candidate of [
    join(here, "..", "assets", "fonts"),
    join(process.cwd(), "assets", "fonts"),
  ]) {
    if (existsSync(join(candidate, FONT_FILES[400]))) return candidate;
  }
  throw new Error("fontes não encontradas (defina FONTS_DIR)");
}

/**
 * Fonte Montserrat (SIL Open Font License, ver assets/fonts/OFL-LICENSE.txt) em TTF, embarcada no
 * renderer: não depende de fontes do sistema nem da descompressão de WOFF.
 */
export function loadFonts() {
  if (fontsCache) return fontsCache;
  const dir = fontsDir();
  fontsCache = (Object.keys(FONT_FILES).map(Number) as FontWeight[]).map((weight) => ({
    name: "Montserrat",
    data: readFileSync(join(dir, FONT_FILES[weight])),
    weight,
    style: "normal" as const,
  }));
  return fontsCache;
}

export interface RenderedImage {
  buffer: Buffer;
  width: number;
  height: number;
  mime_type: "image/jpeg" | "image/png";
  sha256: string;
}

/** Template → SVG (Satori, texto vira vetor) → PNG (resvg) → JPEG sRGB (sharp). Determinístico. */
export async function renderImage(req: RenderRequest, brand: BrandConfig): Promise<RenderedImage> {
  const { width, height } = FORMATS[req.format];
  const tree = buildTemplate({ req, brand, width, height });
  const svg = await satori(tree as never, { width, height, fonts: loadFonts() });
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng();
  const buffer =
    req.output_format === "png"
      ? await sharp(png).png({ compressionLevel: 9 }).toBuffer()
      : await sharp(png)
          .flatten({ background: "#ffffff" })
          .toColorspace("srgb")
          .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
          .toBuffer();
  const meta = await sharp(buffer).metadata();
  if (meta.width !== width || meta.height !== height) {
    throw new Error(
      `dimensão inesperada ${meta.width}x${meta.height} (esperado ${width}x${height})`,
    );
  }
  return {
    buffer,
    width,
    height,
    mime_type: req.output_format === "png" ? "image/png" : "image/jpeg",
    sha256: sha256Hex(buffer),
  };
}

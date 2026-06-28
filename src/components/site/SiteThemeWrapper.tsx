import type { CSSProperties, ReactNode } from "react";

interface Props {
  primaryColor: string; // HSL "h s% l%"
  secondaryColor: string;
  template?: string;
  children: ReactNode;
}

/**
 * Injects per-restaurant brand colors as CSS variables for the generated site.
 * Uses HSL so users can pick simple hue/saturation/lightness values.
 */
export function SiteThemeWrapper({ primaryColor, secondaryColor, template = "black", children }: Props) {
  const isWhite = template === "white";
  const isPizzaRed = template === "pizza_hut_style";
  const isBurger = template === "burger_style";
  const isBarPrime = template === "bar_prime";

  // Base tokens for different templates
  let themeTokens = {
    bg: "0 0% 1%", // Quase preto puro para máximo contraste
    fg: "0 0% 98%", // Branco gelo
    card: "0 0% 4%", // Um pouco mais claro que o bg
    border: "0 0% 12%",
    muted: "0 0% 6%",
    mutedFg: "0 0% 65%", // Texto secundário com boa leitura
    primary: primaryColor || "38 92% 50%", // Amarelo/Ouro premium
    primaryFg: "0 0% 0%", // Texto preto sobre primário (contraste total)
    secondary: secondaryColor || "142 71% 45%",
    success: "142 70% 45%",
    danger: "0 84% 60%",
    headerBg: "0 0% 2% / 95%", // Mais opaco para legibilidade
    headerFg: "0 0% 98%",
  };

  if (isWhite) {
    themeTokens = {
      ...themeTokens,
      bg: "0 0% 98%", // #FAFAFA
      fg: "222 47% 11%", // #0f172a
      card: "0 0% 100%", // White
      border: "214 32% 91%", // #e2e8f0
      muted: "210 40% 96%", // #f1f5f9
      mutedFg: "215 16% 47%", // #64748b
      primaryFg: "0 0% 100%",
      headerBg: "0 0% 100% / 80%",
      headerFg: "222 47% 11%",
    };
  } else if (isPizzaRed) {
    themeTokens = {
      ...themeTokens,
      bg: "30 100% 99%", // #FFF9F6
      fg: "0 0% 7%", // #111111
      card: "0 0% 100%", // White
      border: "24 25% 91%", // #EFE7E2
      muted: "24 25% 98%",
      mutedFg: "0 0% 33%", // #555555
      primary: "358 92% 46%", // #E50914 (Vermelho Pizza vibrante)
      primaryFg: "0 0% 100%", // Texto branco sobre vermelho
      headerBg: "358 92% 46% / 100%",
      headerFg: "0 0% 100%",
    };
  } else if (isBurger) {
    themeTokens = {
      ...themeTokens,
      bg: "210 20% 98%",
      fg: "0 0% 10%",
      card: "0 0% 100%",
      border: "45 100% 90%",
      muted: "0 0% 95%",
      mutedFg: "0 0% 45%",
      primary: "35 100% 43%",
      primaryFg: "0 0% 100%",
      headerBg: "0 0% 7% / 100%",
      headerFg: "0 0% 100%",
    };
  } else if (isBarPrime) {
    themeTokens = {
      ...themeTokens,
      bg: "0 0% 4%", // Background profundo para bares/eventos
      fg: "0 0% 98%",
      card: "0 0% 7%",
      border: "0 0% 15%",
      muted: "0 0% 10%",
      mutedFg: "0 0% 60%",
      primary: primaryColor || "38 92% 50%", // Ouro ou cor do restaurante
      primaryFg: "0 0% 0%",
      headerBg: "0 0% 5% / 95%",
      headerFg: "0 0% 98%",
    };
  }

  const style: CSSProperties = {
    ["--site-bg" as string]: themeTokens.bg,
    ["--site-fg" as string]: themeTokens.fg,
    ["--site-card" as string]: themeTokens.card,
    ["--site-border" as string]: themeTokens.border,
    ["--site-muted" as string]: themeTokens.muted,
    ["--site-muted-fg" as string]: themeTokens.mutedFg,
    ["--site-primary" as string]: themeTokens.primary,
    ["--site-primary-fg" as string]: themeTokens.primaryFg,
    ["--site-secondary" as string]: themeTokens.secondary,
    ["--site-success" as string]: themeTokens.success,
    ["--site-danger" as string]: themeTokens.danger,
    ["--site-header-bg" as string]: themeTokens.headerBg,
    ["--site-header-fg" as string]: themeTokens.headerFg,
  };

  return (
    <div
      style={style}
      className="site-root min-h-screen text-[hsl(var(--site-fg))] bg-[hsl(var(--site-bg))] selection:bg-[hsl(var(--site-primary)/0.3)]"
    >
      {children}
    </div>
  );
}
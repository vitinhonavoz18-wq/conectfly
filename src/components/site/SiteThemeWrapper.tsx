import type { CSSProperties, ReactNode } from "react";
import {
  apagadoSobre,
  bordaSobre,
  letraLegivelSobre,
  receitaDeCor,
  superficieSobre,
  textoApagadoSobre,
  textoPrincipalSobre,
} from "@/lib/site/brandColor";

interface Props {
  /** Vem do painel. Pode chegar como "38 92% 50%" ou como "#D7AC32". */
  primaryColor: string;
  secondaryColor: string;
  /**
   * A cor de fundo do cardápio, vinda de `site_settings.background_color`.
   * Quando existe, ela arrasta card, borda e cor do texto junto — senão um
   * fundo preto ficaria com card branco e letra preta por cima.
   */
  backgroundColor?: string | null;
  template?: string;
  children: ReactNode;
}

/**
 * Pinta o site do restaurante.
 *
 * Cada modelo visual traz um conjunto de cores de fábrica. Por cima dele, a
 * cor que o restaurante escolheu no painel SEMPRE vence.
 *
 * ISSO MUDOU, E É DE PROPÓSITO
 *
 * Antes, Pizza Red e Burger Showcase forçavam a própria cor e engoliam a
 * escolha do lojista: ele trocava a cor no painel, salvava, abria o site e
 * não via diferença nenhuma — como pedir sem cebola e receber com cebola
 * toda vez. Agora a escolha dele manda.
 *
 * Quem nunca escolheu cor continua exatamente como está: `receitaDeCor`
 * devolve nulo para campo vazio e para o `#FF7A00` que a tabela preenche
 * sozinha, e aí a cor do modelo permanece.
 */
export function SiteThemeWrapper({
  primaryColor,
  secondaryColor,
  backgroundColor,
  template = "black",
  children,
}: Props) {
  const isWhite = template === "white";
  const isPizzaRed = template === "pizza_hut_style";
  const isBurger = template === "burger_style";
  const isBarPrime = template === "bar_prime";

  const escolhidaPrimaria = receitaDeCor(primaryColor);
  const escolhidaSecundaria = receitaDeCor(secondaryColor);
  const escolhidoFundo = receitaDeCor(backgroundColor);

  // Base tokens for different templates
  let themeTokens = {
    bg: "0 0% 1%", // Quase preto puro para máximo contraste
    fg: "0 0% 98%", // Branco gelo
    card: "0 0% 4%", // Um pouco mais claro que o bg
    border: "0 0% 12%",
    muted: "0 0% 6%",
    mutedFg: "0 0% 65%", // Texto secundário com boa leitura
    primary: "38 92% 50%", // Amarelo/Ouro premium
    primaryFg: "0 0% 0%", // Texto preto sobre primário (contraste total)
    secondary: "142 71% 45%",
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
      card: "0 0% 7%",
      border: "0 0% 15%",
      muted: "0 0% 10%",
      mutedFg: "0 0% 60%",
      headerBg: "0 0% 5% / 95%",
    };
  }

  // O fundo entra antes das outras cores porque ele arrasta o resto: card,
  // borda, área apagada e cor do texto saem dele. O cabeçalho perde a
  // transparência de propósito — sobre um fundo escolhido pelo lojista, o
  // "/95%" do modelo deixaria passar a cor errada por baixo.
  if (escolhidoFundo) {
    themeTokens.bg = escolhidoFundo;
    themeTokens.fg = textoPrincipalSobre(escolhidoFundo);
    themeTokens.card = superficieSobre(escolhidoFundo);
    themeTokens.muted = apagadoSobre(escolhidoFundo);
    themeTokens.mutedFg = textoApagadoSobre(escolhidoFundo);
    themeTokens.border = bordaSobre(escolhidoFundo);
    themeTokens.headerBg = superficieSobre(escolhidoFundo);
    themeTokens.headerFg = textoPrincipalSobre(escolhidoFundo);
  }

  // A escolha do restaurante entra por último, por cima de qualquer modelo.
  if (escolhidaPrimaria) {
    themeTokens.primary = escolhidaPrimaria;
    // A letra dos botões acompanha: cor clara pede letra preta, cor escura
    // pede letra branca. Sem isto, alguém escolhendo amarelo ganharia botão
    // amarelo com letra branca — ilegível na rua, com sol na tela.
    themeTokens.primaryFg = letraLegivelSobre(escolhidaPrimaria);
  }
  if (escolhidaSecundaria) {
    themeTokens.secondary = escolhidaSecundaria;
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

    // Nomes curtos, apontando para os mesmos valores. Deixam explícita a
    // separação de papéis — fundo da página, card, texto, marca — sem
    // precisar renomear as `--site-*` que todo componente do cardápio já usa.
    ["--background" as string]: themeTokens.bg,
    ["--surface" as string]: themeTokens.card,
    ["--foreground" as string]: themeTokens.fg,
    ["--primary" as string]: themeTokens.primary,
    ["--secondary" as string]: themeTokens.secondary,
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

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { SiteBrandLogo } from "./SiteBrandLogo";
import { useCapaDoHero } from "@/lib/site/useCapaDoHero";
import { apresentacaoCorrida, horarioLegivel } from "@/lib/site/capaDaLoja";

interface Props {
  name: string;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  heroMediaType?: string;
  heroVideoUrl?: string | null;
  buttonText?: string;
  showButton?: boolean;
  hasCombos?: boolean;
  combosVisibility?: "auto" | "always" | "hide";
  /**
   * O pacotinho de configurações da loja. É de onde sai a capa programada.
   * Sem ele, vale a capa fixa de sempre — nenhuma loja antiga muda.
   */
  siteSettings?: unknown;
  /**
   * Aberta ou fechada, do jeito que o banco respondeu. Só vira selo quando a
   * resposta é explícita: sem o campo, a capa não afirma nada — dizer
   * "aberto" sem saber é como pendurar a placa sem olhar se a cozinha ligou.
   */
  isOpen?: boolean | null;
  /** O horário escrito no painel. Aparece no selo quando existe. */
  hours?: string | null;
}

/** Quem pediu ao sistema para reduzir animações não ganha rolagem animada. */
function comportamentoDeRolagem(): ScrollBehavior {
  if (typeof window === "undefined" || !window.matchMedia) return "smooth";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/**
 * A CAPA DO CARDÁPIO — a primeira coisa que o cliente vê.
 *
 * O QUE ELA PRECISA RESOLVER EM TRÊS SEGUNDOS
 *
 * "Que loja é essa? Está aberta? Onde eu peço?" A capa antiga ocupava a tela
 * inteira com uma logo enorme e um texto longo, e o cardápio ficava lá
 * embaixo, fora da vista. Era a vitrine tão grande que escondia a porta.
 *
 * Agora a altura é a do conteúdo, a logo é do tamanho de uma placa de
 * fachada, a apresentação mostra só as primeiras linhas (com "ler mais") e o
 * botão de pedir aparece logo na primeira tela, inclusive no celular.
 *
 * A FOTO DE FUNDO
 *
 * Antes, a foto era coberta por uma névoa da cor do fundo da página. Em loja
 * de fundo claro, isso deixava a foto lavada, quase branca. Agora a foto
 * aparece com a cor dela e ganha um véu escuro suave por cima — só o
 * suficiente para a letra branca ser lida sobre qualquer foto, clara ou
 * escura. Sem foto, a capa usa as cores da própria loja.
 *
 * Tudo sai das variáveis de cor da loja (`--site-*`), então a mesma capa
 * serve a confeitaria rosa e a hamburgueria preta sem nenhuma cor fixa.
 */
export function SiteHero({
  name,
  tagline,
  description,
  logoUrl,
  heroImageUrl,
  heroMediaType = "image",
  heroVideoUrl,
  buttonText = "Explorar Pizzas",
  showButton = true,
  hasCombos = false,
  combosVisibility = "auto",
  siteSettings,
  isOpen,
  hours,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const showCombos = combosVisibility === "always" || (combosVisibility === "auto" && hasCombos);
  const showHeroButton = showButton;

  // A capa do momento. No modo fixo — que é o padrão — devolve exatamente a
  // mídia que a loja já escolheu, então nada muda para quem não programou nada.
  const capa = useCapaDoHero(siteSettings, {
    tipo: heroMediaType === "video" ? "video" : "imagem",
    url: heroMediaType === "video" ? (heroVideoUrl ?? null) : heroImageUrl,
  });

  const showVideo = capa.tipo === "video" && !!capa.url;
  const urlDaImagem = capa.tipo === "imagem" ? capa.url || null : heroImageUrl;
  const temMidia = showVideo || !!urlDaImagem;

  const horario = horarioLegivel(hours);
  const mostrarSelo = typeof isOpen === "boolean" || !!horario;

  // A apresentação mostra as primeiras linhas; "ler mais" abre o resto, com
  // as quebras de parágrafo que o lojista escreveu.
  const resumo = apresentacaoCorrida(description);
  const [apresentacaoAberta, setApresentacaoAberta] = useState(false);
  const [apresentacaoCortada, setApresentacaoCortada] = useState(false);
  const apresentacaoRef = useRef<HTMLParagraphElement>(null);

  // Mede depois de pintar se o texto passou do limite de linhas. Só aí o
  // "ler mais" aparece — em apresentação curta ele nem existe.
  useLayoutEffect(() => {
    if (apresentacaoAberta) return;
    const medir = () => {
      const el = apresentacaoRef.current;
      if (el) setApresentacaoCortada(el.scrollHeight > el.clientHeight + 1);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [resumo, apresentacaoAberta]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Ensure video is muted and plays inline for mobile autoplay support
    video.muted = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    const attemptPlay = async () => {
      try {
        await video.play();
      } catch {
        // Autoplay bloqueado pelo navegador: fica a imagem de capa (poster).
      }
    };

    if (showVideo) {
      attemptPlay();
    }
  }, [showVideo, capa.url]);

  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    let targetId = id;

    // If we're looking for pizzas but it doesn't exist, try cardapio
    if (id === "pizzas" && !document.getElementById("pizzas")) {
      targetId = "cardapio";
    }

    const element = document.getElementById(targetId);
    if (element) {
      const offset = 72;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: comportamentoDeRolagem(),
      });
    }
  };

  // Sobre foto, a letra é sempre branca (o véu garante o contraste). Sem
  // foto, a letra segue as cores da loja.
  const corDoNome = temMidia ? "text-white" : "text-[hsl(var(--site-fg))]";
  const corDoSlogan = temMidia ? "text-white/90" : "text-[hsl(var(--site-primary))]";
  const corDoTexto = temMidia ? "text-white/85" : "text-[hsl(var(--site-muted-fg))]";

  const botao =
    "inline-flex min-h-12 items-center justify-center rounded-full px-7 py-3 text-sm sm:text-base font-bold tracking-wide site-btn-primary shadow-lg transition-transform motion-safe:hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--site-primary))]";

  return (
    <section aria-label={`Apresentação de ${name}`} className="relative isolate overflow-hidden">
      {temMidia ? (
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          {showVideo ? (
            <video
              // A chave amarra o elemento ao endereço: quando a capa programada
              // troca, o navegador monta um vídeo novo em vez de tentar remendar
              // o antigo, que às vezes fica congelado no último quadro.
              key={capa.url}
              ref={videoRef}
              src={capa.url}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              controls={false}
              poster={heroImageUrl ?? undefined}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ pointerEvents: "none" }}
            />
          ) : urlDaImagem ? (
            <img
              key={urlDaImagem}
              src={urlDaImagem}
              alt=""
              // É a imagem mais importante da primeira tela: o navegador a
              // busca antes das fotos dos produtos, que ficam mais abaixo.
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
            />
          ) : null}
          {/* O véu: escuro o bastante para ler, claro o bastante para ver a foto. */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/65" />
          {/* Um toque da cor da loja, para a capa conversar com o resto do site. */}
          <div className="absolute inset-0 bg-[hsl(var(--site-primary)/0.14)] mix-blend-multiply" />
        </div>
      ) : (
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--site-primary)/0.12),transparent_65%)]"
          aria-hidden="true"
        />
      )}

      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-8 pt-7 text-center sm:pb-12 sm:pt-10 lg:pb-14 lg:pt-12">
        {logoUrl && (
          <SiteBrandLogo
            name={name}
            logoUrl={logoUrl}
            variant="capa"
            priority
            className="mb-3 drop-shadow-[0_6px_18px_rgba(0,0,0,0.25)] sm:mb-4"
          />
        )}

        <h1
          className={`max-w-full text-balance text-[1.65rem] font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-4xl lg:text-[2.75rem] ${corDoNome} ${temMidia ? "drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]" : ""}`}
        >
          {name}
        </h1>

        {tagline && (
          <p
            className={`mt-1.5 text-balance text-base font-semibold leading-snug sm:mt-2 sm:text-xl ${corDoSlogan}`}
          >
            {tagline}
          </p>
        )}

        {mostrarSelo && (
          <p
            className={`mt-3 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full px-3.5 py-1.5 text-xs font-semibold sm:text-sm ${
              temMidia
                ? "bg-black/35 text-white ring-1 ring-white/20 backdrop-blur-sm"
                : "bg-[hsl(var(--site-card))] text-[hsl(var(--site-fg))] ring-1 ring-[hsl(var(--site-border))]"
            }`}
          >
            {typeof isOpen === "boolean" && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${isOpen ? "bg-emerald-400" : "bg-red-500"}`}
                />
                {isOpen ? "Aberto agora" : "Fechado agora"}
              </span>
            )}
            {typeof isOpen === "boolean" && horario && (
              <span aria-hidden="true" className="opacity-50">
                •
              </span>
            )}
            {horario && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
                <span className="sr-only">Horário de funcionamento: </span>
                {horario}
              </span>
            )}
          </p>
        )}

        {resumo && (
          <div className="mt-3 max-w-xl sm:mt-4">
            <p
              ref={apresentacaoRef}
              id="apresentacao-da-loja"
              className={`text-sm leading-relaxed sm:text-base ${corDoTexto} ${
                apresentacaoAberta ? "whitespace-pre-line" : "line-clamp-3 sm:line-clamp-2"
              }`}
            >
              {apresentacaoAberta ? description?.trim() : resumo}
            </p>
            {(apresentacaoCortada || apresentacaoAberta) && (
              <button
                type="button"
                onClick={() => setApresentacaoAberta((v) => !v)}
                aria-expanded={apresentacaoAberta}
                aria-controls="apresentacao-da-loja"
                className={`mt-1 min-h-8 px-2 text-xs font-semibold underline underline-offset-4 sm:text-sm ${
                  temMidia ? "text-white" : "text-[hsl(var(--site-primary))]"
                }`}
              >
                {apresentacaoAberta ? "Ler menos" : "Ler mais"}
              </button>
            )}
          </div>
        )}

        {(showHeroButton || showCombos) && (
          <div className="mt-5 flex flex-wrap justify-center gap-3 sm:mt-6">
            {showHeroButton && (
              <a href="#pizzas" onClick={(e) => scrollTo(e, "pizzas")} className={botao}>
                {buttonText}
              </a>
            )}
            {showCombos && (
              <a href="#combos" onClick={(e) => scrollTo(e, "combos")} className={botao}>
                Combos Premium
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

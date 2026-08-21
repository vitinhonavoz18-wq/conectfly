/**
 * Rolagem suave entre as seções do site do advogado.
 *
 * Por que não deixar o navegador cuidar sozinho: o `scroll-behavior: smooth`
 * teria de ser aplicado na página inteira, e isso afetaria também o painel do
 * SiteCreatorFly. Aqui a suavidade fica restrita aos links deste site.
 *
 * Quem configurou o sistema para reduzir animações (recurso de acessibilidade
 * do celular/computador) recebe o salto direto, sem deslizamento.
 */
export function scrollToAnchor(ancora: string) {
  if (typeof document === "undefined") return;

  const alvo = document.getElementById(ancora);
  if (!alvo) return;

  const prefereMenosMovimento =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  alvo.scrollIntoView({
    behavior: prefereMenosMovimento ? "auto" : "smooth",
    block: "start",
  });
}

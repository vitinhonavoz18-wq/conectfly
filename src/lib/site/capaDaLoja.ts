/**
 * O horário de funcionamento pronto para aparecer no site.
 *
 * O painel já gravou horários com um "[]" grudado na frente
 * ("[]14:30 as 22:00") — resto de uma lista vazia de dias. Na tela isso
 * apareceria como lixo, então os colchetes vazios saem. Qualquer outro texto
 * que o lojista escreveu fica exatamente como está: é o garçom passar o pano
 * no cardápio, não reescrever o prato.
 *
 * Devolve `null` quando não sobra nada para mostrar.
 */
export function horarioLegivel(hours: string | null | undefined): string | null {
  if (!hours) return null;
  const limpo = hours
    .replace(/\[\s*\]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
  return limpo || null;
}

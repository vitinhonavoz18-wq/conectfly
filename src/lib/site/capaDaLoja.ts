/**
 * Os textos que a capa do cardápio mostra logo de cara: o horário e a
 * apresentação da loja.
 *
 * NADA AQUI INVENTA INFORMAÇÃO
 *
 * Os dois vêm do cadastro da loja. Aqui só se arruma a apresentação — tirar
 * sujeira de digitação e juntar parágrafos — sem trocar o sentido de nada. É
 * o garçom passar o pano no cardápio, não reescrever o prato.
 */

/**
 * O horário de funcionamento pronto para aparecer na capa.
 *
 * O painel já gravou horários com um "[]" grudado na frente
 * ("[]14:30 as 22:00") — resto de uma lista vazia de dias. Na capa isso
 * apareceria como lixo, então os colchetes vazios saem. Qualquer outro texto
 * que o lojista escreveu fica exatamente como está.
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

/**
 * A apresentação da loja em um parágrafo só.
 *
 * A capa mostra só as primeiras linhas (com "ler mais" para o resto). Com os
 * parágrafos separados por linhas em branco, essas poucas linhas seriam
 * gastas com espaço vazio — então, no resumo, os parágrafos viram um só. O
 * texto completo, com as quebras originais, continua disponível.
 */
export function apresentacaoCorrida(description: string | null | undefined): string | null {
  if (!description) return null;
  const corrida = description
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return corrida || null;
}

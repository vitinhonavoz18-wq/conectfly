/**
 * O endereço que abre o WhatsApp do restaurante com o pedido já escrito.
 *
 * POR QUE ISTO PRECISOU VIRAR UM ARQUIVO SÓ PARA ELE
 *
 * O link do WhatsApp (`wa.me`) só funciona com o número COMPLETO, no formato
 * internacional: país + DDD + número. "71992064951" não abre nada — o
 * WhatsApp responde que o número é inválido, e o cliente, que acabou de
 * confirmar o pedido, cai numa tela de erro achando que deu tudo errado.
 *
 * E o cadastro do painel aceita as duas formas. Hoje, a maioria das lojas
 * está cadastrada SEM o 55 na frente: para elas, o link nunca abriu direito.
 *
 * É o telefone anotado no guardanapo sem o DDD: certíssimo para quem mora na
 * mesma cidade, e inútil para quem liga de fora.
 *
 * O CONSERTO É NO CAMINHO, NÃO NO CADASTRO
 *
 * Completar o número na hora de montar o link conserta TODAS as lojas de uma
 * vez, inclusive as que ainda vão ser cadastradas amanhã por alguém com
 * pressa. Corrigir loja por loja no banco arruma o problema de hoje e deixa
 * a porta aberta para ele voltar.
 */

/** O código do Brasil. Todas as lojas do sistema são brasileiras. */
const BRASIL = "55";

/**
 * Um telefone brasileiro tem 10 dígitos (fixo: DDD + 8) ou 11 (celular: DDD
 * + 9). Menos que isso é digitação pela metade; mais que isso já vem com
 * código de país e não deve ser mexido.
 */
const DIGITOS_SEM_PAIS = [10, 11];

/**
 * O número pronto para o `wa.me`, ou `null` quando não dá para montar um.
 *
 * `null` é resposta de primeira classe aqui: é o que permite a quem chama
 * simplesmente PULAR o WhatsApp em vez de abrir uma página quebrada na cara
 * do cliente.
 */
export function numeroParaWhatsApp(bruto: string | null | undefined): string | null {
  const digitos = String(bruto ?? "").replace(/\D/g, "");
  if (!digitos) return null;

  // Já veio com o código do país e tem tamanho de telefone de verdade.
  if (digitos.startsWith(BRASIL) && digitos.length >= 12 && digitos.length <= 13) {
    return digitos;
  }

  // Faltou só o país: completamos.
  if (DIGITOS_SEM_PAIS.includes(digitos.length)) {
    return BRASIL + digitos;
  }

  // Qualquer outra coisa é número pela metade ou digitação errada. Abrir o
  // WhatsApp com isso é pior do que não abrir: o cliente vê "número
  // inválido" logo depois de confirmar o pedido e acha que perdeu a compra.
  return null;
}

/** O endereço completo, com o texto do pedido já preenchido. */
export function linkDoWhatsApp(
  numeroBruto: string | null | undefined,
  mensagem: string,
): string | null {
  const numero = numeroParaWhatsApp(numeroBruto);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

/**
 * Um relógio que não depende do celular do cliente estar com a hora certa.
 *
 * O PROBLEMA
 *
 * A capa do cardápio agora troca conforme a hora. Se a hora viesse só do
 * aparelho de quem está olhando, um celular com o relógio adiantado veria a
 * promoção da noite às três da tarde. Quem decide qual promoção está no ar é
 * o restaurante, não o aparelho do cliente.
 *
 * COMO ISSO É RESOLVIDO
 *
 * Toda resposta que o servidor manda traz, no cabeçalho, a hora dele — do
 * mesmo jeito que uma carta traz o carimbo do correio. O cardápio já faz
 * várias dessas chamadas para carregar os produtos; aqui a gente só lê o
 * carimbo que já vinha junto e anota a diferença para o relógio do aparelho.
 *
 * Depois disso, "que horas são" passa a ser: a hora do aparelho, corrigida
 * por essa diferença. Não custa uma chamada a mais, não atrasa nada e
 * funciona mesmo se o cliente estiver com o relógio errado.
 *
 * SE O CARIMBO NÃO CHEGAR
 *
 * Fica valendo o relógio do aparelho. É pior, mas é o que existe — e um
 * cardápio com a capa da tarde é melhor que um cardápio que não abre.
 */

/**
 * Quantos milissegundos o aparelho está adiantado (positivo) ou atrasado
 * (negativo) em relação ao servidor. Zero enquanto ninguém carimbou nada.
 */
let diferenca = 0;
let jaCarimbado = false;

/**
 * Anota a hora que veio no cabeçalho de uma resposta.
 *
 * Chamado a cada resposta do Supabase. A diferença é recalculada sempre: se o
 * aparelho ficar horas com a página aberta e o relógio dele derivar, a
 * próxima resposta corrige.
 */
export function anotarHoraDoServidor(cabecalhoDate: string | null | undefined): void {
  if (!cabecalhoDate) return;
  const doServidor = Date.parse(cabecalhoDate);
  if (!Number.isFinite(doServidor)) return;

  const nova = Date.now() - doServidor;
  // Diferenças minúsculas são só o tempo de viagem da resposta pela internet,
  // não relógio errado. Ignorar evita ficar corrigindo o relógio à toa.
  if (!jaCarimbado || Math.abs(nova - diferenca) > 30_000) {
    diferenca = nova;
    jaCarimbado = true;
  }
}

/** Que horas são de verdade, na medida do possível. */
export function agora(): Date {
  return new Date(Date.now() - diferenca);
}

/** O relógio já foi acertado pelo servidor alguma vez? */
export function relogioAcertado(): boolean {
  return jaCarimbado;
}

/**
 * Embrulha o `fetch` do navegador para ler o carimbo de hora de cada resposta.
 *
 * Passado ao cliente do Supabase na criação. Não muda nada no que é enviado
 * nem no que é recebido — só olha o cabeçalho de passagem.
 */
export function fetchQueAnotaAHora(base: typeof fetch = fetch): typeof fetch {
  return async (entrada: RequestInfo | URL, opcoes?: RequestInit) => {
    const resposta = await base(entrada, opcoes);
    try {
      anotarHoraDoServidor(resposta.headers.get("date"));
    } catch {
      // Cabeçalho inacessível (resposta opaca, por exemplo). Segue sem ele.
    }
    return resposta;
  };
}

/** Só para os testes: volta ao estado de quem nunca viu um carimbo. */
export function reiniciarRelogio(): void {
  diferenca = 0;
  jaCarimbado = false;
}

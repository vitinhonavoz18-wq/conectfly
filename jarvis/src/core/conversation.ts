/**
 * Modo conversa: depois de "Jarvis", ele continua ouvindo as respostas até
 * você encerrar com uma despedida ("valeu bonitão", "obrigado Jarvis"…),
 * até terminar uma tarefa pedida, ou até ficar em silêncio.
 */

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Expressões que, sozinhas, já significam "pode encerrar". */
const CLOSERS: string[] = [
  'valeu',
  'vlw',
  'obrigado',
  'obrigada',
  'brigado',
  'brigada',
  'brigadao',
  'obg',
  'falou',
  'flw',
  'tchau',
  'tchauzinho',
  'xau',
  'fui',
  'ate mais',
  'ate logo',
  'ate depois',
  'ate a proxima',
  'encerrar',
  'encerra',
  'encerrado',
  'dispensado',
  'pode ir',
  'pode parar',
  'pode descansar',
  'pode desligar',
  'pode encerrar',
  'e isso',
  'era isso',
  'so isso',
  'era so',
  'nada mais',
  'mais nada',
  'tamo junto',
  'tmj',
  'fechou',
  'boa noite',
  'chega por hoje',
  'por hoje e so',
  'missao cumprida',
];

/**
 * Palavras "de enfeite" que podem acompanhar a despedida sem mudar o sentido
 * ("valeu, bonitão", "obrigado, Jarvis, era só isso mesmo").
 */
const FILLERS = new Set(
  (
    'jarvis bonitao bonito meu mano manito parca parceiro parca chefe chefia patrao brother bro mestre querido amigo amigao irmao ' +
    'ok okay beleza blz show top perfeito otimo massa demais tranquilo suave certo entendi isso entao ta bom muito muitissimo ' +
    'mesmo ai la e o a de por hoje cara velho vei gente pessoal sim hein viu tudo ja pronto excelente maravilha'
  ).split(' '),
);

const CLOSER_WORDS = new Set(CLOSERS.flatMap((c) => c.split(' ')));

/** Verdadeiro quando a fala é só uma despedida/agradecimento, sem novo pedido. */
export function isEndPhrase(text: string): boolean {
  const t = norm(text);
  if (!t) return false;
  const padded = ` ${t} `;
  const hasCloser = CLOSERS.some((c) => padded.includes(` ${c} `));
  if (!hasCloser) return false;
  // Qualquer palavra fora do vocabulário de despedida indica um pedido novo
  // ("obrigado, agora abre o YouTube" não encerra).
  return t.split(' ').every((w) => CLOSER_WORDS.has(w) || FILLERS.has(w));
}

const FAREWELLS = [
  'Valeu! Tô por aqui, é só chamar.',
  'Tamo junto! Qualquer coisa, diz "Jarvis".',
  'De nada! Até mais.',
  'Falou! Fico de olho aqui.',
  'Sempre às ordens. Até já!',
];

export function farewell(seed = Date.now()): string {
  return FAREWELLS[Math.abs(Math.floor(seed)) % FAREWELLS.length];
}

/**
 * Depois de uma tarefa concluída, a conversa encerra sozinha — a menos que o
 * Jarvis tenha feito uma pergunta (aí ele espera sua resposta).
 */
export function shouldEndAfterTurn(turn: { completedActions: number; reply: string }): boolean {
  const asked = /\?\s*$/.test(turn.reply.trim());
  return turn.completedActions > 0 && !asked;
}

/** Perguntas que se referem ao que está na tela ("esse vídeo", "essa cena"). */
export function refersToScreen(text: string): boolean {
  const t = ` ${norm(text)} `;
  return /\b(esse|essa|este|esta|isso|isto|aqui|nessa|nesse|desse|dessa|deste|desta)\b/.test(t) &&
    /\b(video|cena|tela|imagem|foto|post|pagina|filme|serie|episodio|musica|clipe|aula|parte|momento|isso|isto|aqui|cara|pessoa|lugar)\b/.test(t)
    ? true
    : /\b(o que (e|eh) isso|que isso|ta vendo|esta vendo|vendo isso|olha isso|olha so)\b/.test(t);
}

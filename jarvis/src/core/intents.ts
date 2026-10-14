import { MediaCommand, SettingsPanel, ToolArgs, ToolName } from './contract';

/**
 * Entendimento local de comandos em português — funciona sem backend.
 * Cobre apenas comandos diretos; o resto vai para a IA quando conectada.
 */
export type LocalParse =
  | { kind: 'action'; tool: ToolName; args: ToolArgs[ToolName]; spoken: string }
  | { kind: 'clarify'; message: string }
  | null;

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Remove "Jarvis," do início e pontuação final, preservando o restante. */
export function stripWakeWord(text: string): string {
  return text
    .trim()
    .replace(/^(ei|ok|oi|ola|olá)?[\s,]*jarvis[\s,:!.-]*/i, '')
    .replace(/[.!?]+$/, '')
    .trim();
}

const PANEL_WORDS: [RegExp, SettingsPanel][] = [
  [/bluetooth|blutu/, 'bluetooth'],
  [/wi-?fi|wireless|internet sem fio|rede/, 'wifi'],
  [/acessibilidade/, 'accessibility'],
  [/localiza|gps/, 'location'],
  [/som|volume|toque/, 'sound'],
  [/tela|brilho|display/, 'display'],
  [/bateria|energia/, 'battery'],
  [/notifica/, 'notifications'],
  [/(deste|do) (app|aplicativo)|jarvis/, 'app_details'],
];

const MEDIA_WORDS: [RegExp, MediaCommand][] = [
  [/^(pausa|pausar|pause|pare a musica|para a musica)\b/, 'pause'],
  [/^(proxima|pula|pular|avanca|avancar)( musica| faixa)?\b/, 'next'],
  [/^(musica anterior|faixa anterior|volta a musica|voltar a musica|anterior)\b/, 'previous'],
  [/^(continua|continuar|retoma|retomar|toca|tocar|play|despausa)( a)?( musica)?$/, 'play'],
  [/^(parar|para) (a )?(reproducao|midia)\b/, 'stop'],
];

const DOMAIN_RE = /\b((https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|br|net|org|io|dev|app|gov|edu|me|tv|info)(\.br)?(\/\S*)?)\b/i;

export function parseLocalCommand(input: string): LocalParse {
  const original = stripWakeWord(input);
  const t = norm(original);
  if (!t) return null;

  // Permissões
  if (/(quais|verifica|verificar|checar|consultar|ver) (as )?permiss/.test(t) || /^permissoes$/.test(t)) {
    return { kind: 'action', tool: 'check_permissions', args: {}, spoken: original };
  }

  // Configurações
  if (/configurac|ajustes|definic/.test(t) || /^(ligar|ativar|desligar|desativar) (o )?(bluetooth|wi-?fi)/.test(t)) {
    for (const [re, panel] of PANEL_WORDS) {
      if (re.test(t)) return { kind: 'action', tool: 'open_settings', args: { panel }, spoken: original };
    }
    return { kind: 'action', tool: 'open_settings', args: { panel: 'general' }, spoken: original };
  }

  // Mídia
  for (const [re, command] of MEDIA_WORDS) {
    if (re.test(t)) return { kind: 'action', tool: 'media_control', args: { command }, spoken: original };
  }

  // Mapa / rota
  const map =
    /^(?:abr\w*|mostr\w*)?\s*(?:o\s+)?mapa\s*(?:com|para|de|do|da|no|na|ate)?\s*(?:o\s+|este\s+|esse\s+)?(?:endereco\s*)?[:,]?\s*(.*)$/.exec(t) ??
    /^(?:como (?:eu )?chego|navegar|rota|ir)\s+(?:ate|para|pra|em|no|na|ao|a)\s+(.+)$/.exec(t);
  if (map) {
    // Recupera o endereço no texto original (com acentos e maiúsculas).
    const addr = original.slice(original.length - map[1].length).trim();
    if (!addr) return { kind: 'clarify', message: 'Qual endereço devo abrir no mapa?' };
    return { kind: 'action', tool: 'open_map', args: { address: addr }, spoken: original };
  }

  // Discador
  const dial = /^(?:ligar|liga|ligue|discar|disca|disque|telefonar|chamar)\s*(?:para|pra|pro|o numero|ao numero)?\s*([+\d][\d\s().-]{2,})$/.exec(t);
  if (dial) return { kind: 'action', tool: 'open_dialer', args: { phone: dial[1] }, spoken: original };
  if (/^(ligar|liga|ligue|telefonar) (para|pra|pro) /.test(t)) {
    return { kind: 'clarify', message: 'Por enquanto preciso do número. Diga, por exemplo: "ligar para 11 99999-0000".' };
  }

  // Compartilhar texto
  const share = /^(?:prepar\w*|compartilh\w*|envi\w* por)\s+(?:este |esse |o |um )?(?:texto|mensagem)(?:\s+para\s+compartilhar)?\s*[:,-]?\s*(.*)$/.exec(t);
  if (share) {
    const text = original.slice(original.length - share[1].length).trim().replace(/^["“]|["”]$/g, '');
    if (!text) return { kind: 'clarify', message: 'Qual texto devo preparar? Digite ou dite depois de "texto:".' };
    return { kind: 'action', tool: 'share_text', args: { text }, spoken: original };
  }

  // Abrir site
  const open = /^(?:abr\w*|inici\w*|execut\w*|entr\w*\s+n[oa]|ir\s+para|vai\s+para|acess\w*)\s+(?:o\s+|a\s+)?(?:site\s+|link\s+|pagina\s+)?(.+)$/.exec(t);
  if (open) {
    const target = open[1].trim();
    const domain = DOMAIN_RE.exec(target);
    if (domain && domain[0].length >= target.length - 1) {
      return { kind: 'action', tool: 'open_url', args: { url: domain[1] }, spoken: original };
    }
    const app = original
      .slice(original.length - target.length)
      .replace(/^(o |a )?(app|aplicativo)\s+/i, '')
      .replace(/^(o |a )/i, '')
      .trim();
    if (!app) return { kind: 'clarify', message: 'Qual aplicativo devo abrir?' };
    return { kind: 'action', tool: 'open_app', args: { app }, spoken: original };
  }

  return null;
}

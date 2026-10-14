import {
  ActionRequest,
  ActionSource,
  MEDIA_COMMANDS,
  SETTINGS_PANELS,
  ToolArgs,
  ToolName,
  UI_STEP_KINDS,
  UiSelector,
  isToolName,
} from './contract';

export type ValidationResult =
  | { ok: true; action: ActionRequest }
  | { ok: false; error: string };

const MAX_TEXT = 2000;
const MAX_SHORT = 200;
const PACKAGE_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/;
const ID_RE = /^[A-Za-z0-9_-]{8,80}$/;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(o: Obj, key: string, max: number, required = true): string | undefined {
  const v = o[key];
  if (v === undefined || v === null) {
    if (required) throw new Error(`campo "${key}" obrigatório`);
    return undefined;
  }
  if (typeof v !== 'string') throw new Error(`campo "${key}" deve ser texto`);
  const t = v.trim();
  if (required && t.length === 0) throw new Error(`campo "${key}" vazio`);
  if (t.length > max) throw new Error(`campo "${key}" muito longo`);
  // Bloqueia caracteres de controle (exceto quebra de linha e tab).
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(t)) {
    throw new Error(`campo "${key}" contém caracteres inválidos`);
  }
  return t;
}

function oneOf<T extends string>(o: Obj, key: string, options: readonly T[]): T {
  const v = o[key];
  if (typeof v !== 'string' || !(options as readonly string[]).includes(v)) {
    throw new Error(`campo "${key}" deve ser um de: ${options.join(', ')}`);
  }
  return v as T;
}

function onlyKeys(o: Obj, allowed: string[]): void {
  for (const k of Object.keys(o)) {
    if (!allowed.includes(k)) throw new Error(`campo inesperado "${k}"`);
  }
}

export function isPackageName(v: string): boolean {
  return PACKAGE_RE.test(v) && v.length <= 150;
}

/** Aceita somente http(s). Recusa javascript:, intent:, file:, content: etc. */
export function sanitizeUrl(raw: string): string {
  let url = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
  const m = /^(https?):\/\/([^/\s?#]+)([^\s]*)$/i.exec(url);
  if (!m) throw new Error('endereço inválido: apenas links http ou https');
  const host = m[2].toLowerCase();
  if (host.includes('@')) throw new Error('endereço com credenciais não é aceito');
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/.test(host) && !/^\[[0-9a-f:]+\](:\d{1,5})?$/.test(host)) {
    throw new Error('domínio inválido');
  }
  return `${m[1].toLowerCase()}://${host}${m[3]}`;
}

/** Mantém só dígitos, + inicial, *, # — o discador apenas recebe o número. */
export function sanitizePhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  const digits = trimmed.replace(/[^0-9*#]/g, '');
  if (digits.length < 3 || digits.length > 20) throw new Error('número de telefone inválido');
  return plus + digits;
}

function validateSelector(raw: unknown): UiSelector {
  if (!isObj(raw)) throw new Error('seletor inválido');
  onlyKeys(raw, ['text', 'contentDescription', 'viewId', 'className']);
  const sel: UiSelector = {
    text: str(raw, 'text', MAX_SHORT, false),
    contentDescription: str(raw, 'contentDescription', MAX_SHORT, false),
    viewId: str(raw, 'viewId', MAX_SHORT, false),
    className: str(raw, 'className', MAX_SHORT, false),
  };
  if (!sel.text && !sel.contentDescription && !sel.viewId) {
    throw new Error('seletor precisa de texto, descrição ou id do elemento');
  }
  return sel;
}

export function validateArgs<T extends ToolName>(tool: T, raw: unknown): ToolArgs[T] {
  const o: Obj = raw === undefined || raw === null ? {} : (raw as Obj);
  if (!isObj(o)) throw new Error('argumentos devem ser um objeto');
  switch (tool) {
    case 'open_app':
      onlyKeys(o, ['app']);
      return { app: str(o, 'app', MAX_SHORT)! } as ToolArgs[T];
    case 'open_url':
      onlyKeys(o, ['url']);
      return { url: sanitizeUrl(str(o, 'url', MAX_TEXT)!) } as ToolArgs[T];
    case 'open_settings':
      onlyKeys(o, ['panel']);
      return { panel: oneOf(o, 'panel', SETTINGS_PANELS) } as ToolArgs[T];
    case 'open_map':
      onlyKeys(o, ['address']);
      return { address: str(o, 'address', 500)! } as ToolArgs[T];
    case 'open_dialer':
      onlyKeys(o, ['phone']);
      return { phone: sanitizePhone(str(o, 'phone', 40)!) } as ToolArgs[T];
    case 'share_text':
      onlyKeys(o, ['text']);
      return { text: str(o, 'text', MAX_TEXT)! } as ToolArgs[T];
    case 'media_control':
      onlyKeys(o, ['command']);
      return { command: oneOf(o, 'command', MEDIA_COMMANDS) } as ToolArgs[T];
    case 'check_permissions':
      onlyKeys(o, []);
      return {} as ToolArgs[T];
    case 'ui_navigate':
      onlyKeys(o, ['app', 'goal']);
      return { app: str(o, 'app', MAX_SHORT)!, goal: str(o, 'goal', 500)! } as ToolArgs[T];
    case 'ui_step': {
      onlyKeys(o, ['kind', 'selector', 'text']);
      const kind = oneOf(o, 'kind', UI_STEP_KINDS);
      const needsSelector = kind === 'click' || kind === 'set_text';
      const selector =
        o.selector === undefined ? undefined : validateSelector(o.selector);
      if (needsSelector && !selector) throw new Error(`"${kind}" exige um seletor`);
      const text = str(o, 'text', MAX_TEXT, kind === 'set_text');
      return { kind, selector, text } as ToolArgs[T];
    }
    default:
      throw new Error('ferramenta desconhecida');
  }
}

/**
 * Valida uma ação vinda de qualquer origem. Tudo que chega do backend passa por
 * aqui antes de chegar perto do executor: campos extras são recusados e textos
 * são limitados.
 */
export function validateAction(raw: unknown, now: number = Date.now()): ValidationResult {
  try {
    if (!isObj(raw)) throw new Error('ação deve ser um objeto');
    const id = raw.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error('identificador inválido');
    if (!isToolName(raw.tool)) throw new Error('ferramenta não permitida');
    const source = raw.source;
    if (source !== 'local' && source !== 'backend' && source !== 'ui-agent') {
      throw new Error('origem inválida');
    }
    const createdAt = raw.createdAt;
    const expiresAt = raw.expiresAt;
    if (typeof createdAt !== 'number' || typeof expiresAt !== 'number') {
      throw new Error('datas inválidas');
    }
    if (expiresAt <= createdAt) throw new Error('prazo de expiração inválido');
    if (expiresAt - createdAt > 10 * 60 * 1000) throw new Error('prazo de expiração longo demais');
    if (createdAt > now + 60 * 1000) throw new Error('ação com data no futuro');
    let targetApp: string | undefined;
    if (raw.targetApp !== undefined && raw.targetApp !== null) {
      if (typeof raw.targetApp !== 'string' || !isPackageName(raw.targetApp)) {
        throw new Error('aplicativo de destino inválido');
      }
      targetApp = raw.targetApp;
    }
    const args = validateArgs(raw.tool, raw.args);
    return {
      ok: true,
      action: {
        id,
        tool: raw.tool,
        args,
        targetApp,
        createdAt,
        expiresAt,
        source: source as ActionSource,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'ação inválida' };
  }
}

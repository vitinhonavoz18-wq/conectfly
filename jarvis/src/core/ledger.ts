import { ActionErrorCode, ActionRecord, ActionRequest, ActionStatus, isTerminal } from './contract';

/** Armazenamento chave-valor mínimo (AsyncStorage no app, memória nos testes). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();
  async getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  async setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  async removeItem(key: string) {
    this.data.delete(key);
  }
}

const STORAGE_KEY = 'jarvis.actionLedger.v1';
const MAX_RECORDS = 500;

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(',')}}`;
}

/** Impressão digital do conteúdo da ação (FNV-1a 32 bits), sem guardar o conteúdo em si. */
export function fingerprintAction(a: Pick<ActionRequest, 'tool' | 'args' | 'targetApp'>): string {
  const input = `${a.tool}|${a.targetApp ?? ''}|${stableStringify(a.args)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Resumo seguro para o histórico: nunca guarda o texto digitado, senhas ou
 * conteúdo compartilhado — só o tipo da ação e o tamanho do conteúdo.
 */
export function summarizeAction(a: ActionRequest): string {
  const args = a.args as Record<string, unknown>;
  switch (a.tool) {
    case 'open_app':
      return `Abrir app: ${String(args.app)}`;
    case 'open_url': {
      const host = /^https?:\/\/([^/]+)/.exec(String(args.url))?.[1] ?? 'link';
      return `Abrir link em ${host}`;
    }
    case 'open_settings':
      return `Abrir configurações: ${String(args.panel)}`;
    case 'open_map':
      return 'Abrir mapa com endereço';
    case 'open_dialer':
      return 'Abrir discador com número';
    case 'share_text':
      return `Compartilhar texto (${String(args.text).length} caracteres)`;
    case 'media_control':
      return `Mídia: ${String(args.command)}`;
    case 'check_permissions':
      return 'Consultar permissões';
    case 'ui_navigate':
      return `Navegar em ${a.targetApp ?? String(args.app)}`;
    case 'ui_step': {
      const kind = String(args.kind);
      if (kind === 'set_text') return `Preencher campo (${String(args.text ?? '').length} caracteres)`;
      const sel = args.selector as Record<string, string> | undefined;
      const label = sel?.text || sel?.contentDescription || sel?.viewId || '';
      return kind === 'click' ? `Tocar em "${label.slice(0, 40)}"` : `Passo: ${kind}`;
    }
    default:
      return a.tool;
  }
}

export type ClaimResult = { kind: 'new'; record: ActionRecord } | { kind: 'duplicate'; record: ActionRecord };

/**
 * Livro-caixa de ações: registra cada solicitação ANTES de executar.
 *
 * Se a conexão cair e o backend reenviar a mesma ação (mesmo id), ela é
 * reconhecida e não roda de novo. Se o app fechar no meio de uma execução, ao
 * reabrir a ação fica marcada como interrompida e não é repetida sozinha.
 */
export class ActionLedger {
  private records = new Map<string, ActionRecord>();
  private loaded = false;
  private listeners = new Set<() => void>();

  constructor(
    private store: KeyValueStore,
    private now: () => number = Date.now,
  ) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    const raw = await this.store.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const list = JSON.parse(raw) as ActionRecord[];
        for (const r of list) this.records.set(r.id, r);
      } catch {
        // histórico corrompido: começa vazio, sem travar o app
      }
    }
    let changed = false;
    for (const r of this.records.values()) {
      if (!isTerminal(r.status)) {
        r.status = 'failed';
        r.errorCode = 'cancelled';
        r.message = 'Ação interrompida (app fechado ou reiniciado). Não será repetida automaticamente.';
        r.updatedAt = this.now();
        changed = true;
      }
    }
    this.loaded = true;
    if (changed) await this.persist();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  list(): ActionRecord[] {
    return [...this.records.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  get(id: string): ActionRecord | undefined {
    return this.records.get(id);
  }

  async claim(action: ActionRequest): Promise<ClaimResult> {
    await this.load();
    const existing = this.records.get(action.id);
    if (existing) return { kind: 'duplicate', record: existing };
    const t = this.now();
    const record: ActionRecord = {
      id: action.id,
      tool: action.tool,
      summary: summarizeAction(action),
      targetApp: action.targetApp,
      source: action.source,
      status: 'pending',
      message: 'Recebida',
      fingerprint: fingerprintAction(action),
      createdAt: t,
      updatedAt: t,
    };
    this.records.set(action.id, record);
    await this.persist(); // grava antes de qualquer efeito
    return { kind: 'new', record };
  }

  async update(id: string, status: ActionStatus, message: string, errorCode?: ActionErrorCode): Promise<void> {
    const r = this.records.get(id);
    if (!r) return;
    r.status = status;
    r.message = message;
    r.errorCode = errorCode;
    r.updatedAt = this.now();
    await this.persist();
  }

  /** Procura ação concluída com o mesmo conteúdo (outro id) dentro da janela. */
  findRecentEffect(fingerprint: string, exceptId: string, windowMs: number): ActionRecord | undefined {
    const limit = this.now() - windowMs;
    for (const r of this.records.values()) {
      if (r.id !== exceptId && r.fingerprint === fingerprint && r.status === 'completed' && r.updatedAt >= limit) {
        return r;
      }
    }
    return undefined;
  }

  async clear(): Promise<void> {
    this.records.clear();
    await this.store.removeItem(STORAGE_KEY);
    this.emit();
  }

  private async persist(): Promise<void> {
    let list = [...this.records.values()].sort((a, b) => a.createdAt - b.createdAt);
    if (list.length > MAX_RECORDS) {
      list = list.slice(list.length - MAX_RECORDS);
      this.records = new Map(list.map((r) => [r.id, r]));
    }
    await this.store.setItem(STORAGE_KEY, JSON.stringify(list));
    this.emit();
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }
}

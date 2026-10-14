import type { GatewayConfig } from './config';

/**
 * Cliente das interfaces REAIS do servidor OpenJarvis (`jarvis serve`),
 * verificadas no código-fonte (src/openjarvis/server/routes.py):
 *   GET  /health               → {"status":"ok"} (sem autenticação)
 *   GET  /v1/info              → {model, agent, engine}
 *   POST /v1/chat/completions  → formato OpenAI; com "tools", devolve tool_calls
 * Autenticação: "Authorization: Bearer <OPENJARVIS_API_KEY>" (auth_middleware.py).
 */

export type OJMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OJToolCall[];
  tool_call_id?: string;
};

export type OJToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string | Record<string, unknown> };
};

export type OJChoiceMessage = { role: string; content?: string | null; tool_calls?: OJToolCall[] | null };

export class OpenJarvisError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export class OpenJarvisClient {
  private cachedModel?: string;

  constructor(private cfg: GatewayConfig) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.cfg.openJarvisApiKey) h.Authorization = `Bearer ${this.cfg.openJarvisApiKey}`;
    return h;
  }

  private async request(path: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
    try {
      return await fetch(`${this.cfg.openJarvisUrl}${path}`, {
        ...init,
        headers: { ...this.headers(), ...(init.headers as Record<string, string> | undefined) },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const msg = e instanceof Error && e.name === 'TimeoutError' ? 'tempo esgotado' : 'não foi possível conectar';
      throw new OpenJarvisError(`OpenJarvis ${msg} em ${this.cfg.openJarvisUrl}`);
    }
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    try {
      const r = await this.request('/health');
      if (r.ok) return { ok: true, detail: 'ok' };
      return { ok: false, detail: `OpenJarvis respondeu ${r.status} em /health (motor de IA indisponível?)` };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }

  async info(): Promise<{ model: string; agent: string | null; engine: string }> {
    const r = await this.request('/v1/info');
    if (r.status === 401) throw new OpenJarvisError('OpenJarvis recusou a chave (OPENJARVIS_API_KEY).', 401);
    if (!r.ok) throw new OpenJarvisError(`OpenJarvis /v1/info respondeu ${r.status}`, r.status);
    return (await r.json()) as { model: string; agent: string | null; engine: string };
  }

  async model(): Promise<string> {
    if (this.cfg.openJarvisModel) return this.cfg.openJarvisModel;
    if (this.cachedModel) return this.cachedModel;
    const info = await this.info();
    if (!info.model) throw new OpenJarvisError('OpenJarvis não informou um modelo padrão; defina OPENJARVIS_MODEL.');
    this.cachedModel = info.model;
    return info.model;
  }

  async chat(messages: OJMessage[], tools: unknown[], maxTokens = 1024): Promise<OJChoiceMessage> {
    const model = await this.model();
    const r = await this.request(
      '/v1/chat/completions',
      {
        method: 'POST',
        body: JSON.stringify({ model, messages, tools, stream: false, temperature: 0.3, max_tokens: maxTokens }),
      },
      this.cfg.requestTimeoutMs,
    );
    if (r.status === 401) throw new OpenJarvisError('OpenJarvis recusou a chave (OPENJARVIS_API_KEY).', 401);
    if (!r.ok) {
      const text = (await r.text()).slice(0, 300);
      throw new OpenJarvisError(`OpenJarvis respondeu ${r.status}: ${text}`, r.status);
    }
    const body = (await r.json()) as { choices?: { message?: OJChoiceMessage }[] };
    const msg = body.choices?.[0]?.message;
    if (!msg) throw new OpenJarvisError('Resposta do OpenJarvis sem "choices[0].message".');
    return msg;
  }
}

export function parseToolArguments(raw: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (raw === undefined || raw === null || raw === '') return {};
  if (typeof raw === 'object') return raw;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('argumentos não são um objeto');
  return parsed as Record<string, unknown>;
}

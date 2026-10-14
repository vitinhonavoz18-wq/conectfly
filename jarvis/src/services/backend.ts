import type { ActionRequest } from '../core/contract';
import { checkBackendUrl } from '../core/backendUrl';
import type { UiHistoryItem, UiProposal } from '../core/uiAgent';
import { clearSession, getToken, setSession } from './secure';

/**
 * Cliente do Jarvis Gateway (pasta gateway/). O celular nunca fala direto com
 * o OpenJarvis nem guarda chaves de provedores de IA: só o token do aparelho.
 */

export type BackendErrorKind = 'not_configured' | 'offline' | 'timeout' | 'unauthorized' | 'rate_limited' | 'upstream' | 'bad_request' | 'unknown';

export class BackendError extends Error {
  constructor(
    public kind: BackendErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export type ApiMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: unknown[] }
  | { role: 'tool'; content: string; tool_call_id: string };

export type ChatResponse = {
  reply: string;
  assistantMessage: { role: 'assistant'; content: string; tool_calls?: unknown[] };
  actions: { callId: string; action: ActionRequest }[];
  rejected: { callId: string; name: string; reason: string }[];
};

export type StatusResponse = {
  device: { id: string; name: string };
  gateway: { version: string };
  openjarvis: { reachable: boolean; model: string | null; agent: string | null; engine: string | null; error?: string };
};

async function call<T>(baseUrl: string, path: string, init: RequestInit & { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<T> {
  const check = checkBackendUrl(baseUrl);
  if (!check.ok) throw new BackendError('not_configured', check.error);
  const token = await getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 30_000);
  const onAbort = () => controller.abort();
  init.signal?.addEventListener('abort', onAbort);
  let res: Response;
  try {
    res = await fetch(`${check.url}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...((init.headers as Record<string, string>) ?? {}),
      },
    });
  } catch {
    if (init.signal?.aborted) throw new BackendError('unknown', 'Cancelado.');
    if (controller.signal.aborted) throw new BackendError('timeout', 'O backend demorou demais para responder.');
    throw new BackendError('offline', 'Sem conexão com o backend. Verifique o Wi-Fi e se o gateway está ligado no computador.');
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', onAbort);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const err = (body as { error?: string } | null)?.error;
  if (res.status === 401) throw new BackendError('unauthorized', err ?? 'Acesso não autorizado. Faça o pareamento novamente.');
  if (res.status === 429) throw new BackendError('rate_limited', err ?? 'Muitas solicitações. Aguarde um pouco.');
  if (res.status === 502) throw new BackendError('upstream', err ?? 'O gateway respondeu, mas o OpenJarvis não.');
  if (res.status >= 400) throw new BackendError(res.status < 500 ? 'bad_request' : 'unknown', err ?? `Erro ${res.status} no backend.`);
  return body as T;
}

export async function pairDevice(baseUrl: string, code: string, deviceName: string): Promise<{ deviceId: string }> {
  const r = await call<{ deviceId: string; token: string }>(baseUrl, '/v1/pair', {
    method: 'POST',
    body: JSON.stringify({ code, deviceName }),
  });
  await setSession(r.token, r.deviceId);
  return { deviceId: r.deviceId };
}

export async function getStatus(baseUrl: string): Promise<StatusResponse> {
  return call<StatusResponse>(baseUrl, '/v1/status', { timeoutMs: 15_000 });
}

export async function healthCheck(baseUrl: string): Promise<boolean> {
  try {
    const r = await call<{ ok: boolean }>(baseUrl, '/health', { timeoutMs: 8_000 });
    return r.ok === true;
  } catch {
    return false;
  }
}

/** Endereço do cérebro na nuvem (função Supabase "jarvis-brain", IA Gemini). Não é segredo. */
export const CLOUD_BRAIN_URL = 'https://glyausrubnpkodgxosdj.supabase.co/functions/v1/jarvis-brain';

/** Imagem da tela (JPEG em base64) e textos visíveis, enviados só junto de uma pergunta. */
export type ScreenContext = { imageBase64?: string; text?: string };

export async function chat(
  baseUrl: string,
  messages: ApiMessage[],
  context: Record<string, unknown>,
  signal?: AbortSignal,
  screen?: ScreenContext,
): Promise<ChatResponse> {
  return call<ChatResponse>(baseUrl, '/v1/chat', {
    method: 'POST',
    body: JSON.stringify(screen ? { messages, context, screen } : { messages, context }),
    timeoutMs: 120_000,
    signal,
  });
}

export async function proposeUiStep(
  baseUrl: string,
  goal: string,
  observation: unknown,
  history: UiHistoryItem[],
  signal?: AbortSignal,
): Promise<UiProposal> {
  return call<UiProposal>(baseUrl, '/v1/ui-step', {
    method: 'POST',
    body: JSON.stringify({ goal, observation, history }),
    timeoutMs: 60_000,
    signal,
  });
}

/** Revoga o token no gateway (se alcançável) e apaga a sessão local. */
export async function disconnect(baseUrl: string): Promise<{ remoteRevoked: boolean }> {
  let remoteRevoked = false;
  try {
    await call(baseUrl, '/v1/device', { method: 'DELETE', timeoutMs: 8_000 });
    remoteRevoked = true;
  } catch {
    remoteRevoked = false;
  }
  await clearSession();
  return { remoteRevoked };
}

export async function hasSession(): Promise<boolean> {
  return (await getToken()) !== null;
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrain, geminiTools, pickModel } from '../jarvis-brain/brain.ts';
import { DEVICE_TOOLS } from '../jarvis-brain/_shared/tools.ts';

const ENV: Record<string, string> = {
  GEMINI_API_KEY: 'g-test',
  JARVIS_PAIRING_CODE: 'CAFE-2026-OK',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
};
const BASE = 'https://x.supabase.co/functions/v1/jarvis-brain';

let reply: Record<string, unknown> = { role: 'assistant', content: 'oi' };
let lastBody: Record<string, unknown> = {};
let geminiStatus = 200;
const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
  const u = String(url);
  assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer g-test');
  if (u.endsWith('/models')) {
    return new Response(JSON.stringify({ data: [{ id: 'models/gemini-2.5-flash' }, { id: 'models/gemini-3-flash' }, { id: 'models/gemini-3-flash-lite' }, { id: 'models/gemini-3-pro' }] }));
  }
  lastBody = JSON.parse(String(init?.body));
  if (geminiStatus !== 200) return new Response('{"error":"x"}', { status: geminiStatus });
  return new Response(JSON.stringify({ choices: [{ message: reply }] }));
}) as typeof fetch;

function brain(env: Record<string, string> = ENV) {
  return createBrain({ env: (k) => env[k], fetchImpl: fakeFetch });
}

async function call(h: (r: Request) => Promise<Response>, method: string, path: string, body?: unknown, token?: string) {
  const res = await h(
    new Request(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

async function pair(h: (r: Request) => Promise<Response>) {
  const r = await call(h, 'POST', '/v1/pair', { code: 'cafe 2026 ok', deviceName: 'Moto' });
  assert.equal(r.status, 200);
  return r.body.token as string;
}

test('health público, resto exige token', async () => {
  const h = brain();
  assert.equal((await call(h, 'GET', '/health')).status, 200);
  assert.equal((await call(h, 'GET', '/v1/status')).status, 401);
  assert.equal((await call(h, 'GET', '/v1/status', undefined, 'jdv1.abc.def')).status, 401);
});

test('pareamento com o código certo gera token assinado; errado é recusado', async () => {
  const h = brain();
  assert.equal((await call(h, 'POST', '/v1/pair', { code: 'ERRADO123' })).status, 403);
  const token = await pair(h);
  assert.match(token, /^jdv1\./);
  const st = await call(h, 'GET', '/v1/status', undefined, token);
  assert.equal(st.status, 200);
  assert.equal(st.body.openjarvis.reachable, true);
  assert.equal(st.body.openjarvis.model, 'gemini-3-flash (nuvem)');
});

test('token adulterado, revogado ou de outra versão não vale', async () => {
  const h = brain();
  const token = await pair(h);
  const [p, payload, sig] = token.split('.');
  const forged = `${p}.${payload.slice(0, -2)}xx.${sig}`;
  assert.equal((await call(h, 'GET', '/v1/status', undefined, forged)).status, 401);
  const id = JSON.parse(Buffer.from(payload, 'base64url').toString()).id as string;
  const revoked = brain({ ...ENV, JARVIS_REVOKED_DEVICES: id.slice(0, 8) });
  assert.equal((await call(revoked, 'GET', '/v1/status', undefined, token)).status, 401);
  const rotated = brain({ ...ENV, JARVIS_TOKEN_VERSION: '2' });
  assert.equal((await call(rotated, 'GET', '/v1/status', undefined, token)).status, 401);
});

test('sem código configurado o pareamento fica fechado', async () => {
  const h = brain({ ...ENV, JARVIS_PAIRING_CODE: '' });
  assert.equal((await call(h, 'POST', '/v1/pair', { code: 'qualquer1' })).status, 503);
});

test('chat: ferramentas válidas viram ações; inventadas são recusadas', async () => {
  const h = brain();
  const token = await pair(h);
  reply = {
    role: 'assistant',
    content: 'Abrindo.',
    tool_calls: [
      { id: 'c1', type: 'function', function: { name: 'open_app', arguments: '{"app":"YouTube"}' } },
      { id: 'c2', type: 'function', function: { name: 'run_shell', arguments: '{}' } },
    ],
  };
  const r = await call(h, 'POST', '/v1/chat', { messages: [{ role: 'user', content: 'abre o youtube' }] }, token);
  assert.equal(r.status, 200);
  assert.equal(r.body.actions.length, 1);
  assert.equal(r.body.actions[0].action.tool, 'open_app');
  assert.equal(r.body.rejected[0].name, 'run_shell');
  assert.equal(lastBody.model, 'gemini-3-flash');
  const tools = lastBody.tools as { function: { name: string; parameters?: unknown } }[];
  assert.ok(!JSON.stringify(tools).includes('additionalProperties'));
  assert.equal(tools.find((t) => t.function.name === 'check_permissions')!.function.parameters, undefined);
});

test('chat com tela: imagem e textos vão junto da última pergunta', async () => {
  const h = brain();
  const token = await pair(h);
  reply = { role: 'assistant', content: 'Parece bem explicativo.' };
  const img = 'A'.repeat(400);
  const r = await call(h, 'POST', '/v1/chat', { messages: [{ role: 'user', content: 'esse vídeo tá explicativo demais?' }], screen: { imageBase64: img, text: 'Título: Aula de Física' } }, token);
  assert.equal(r.status, 200);
  const msgs = lastBody.messages as { role: string; content: unknown }[];
  assert.match(String(msgs[0].content), /IMAGEM da tela/);
  const parts = msgs[msgs.length - 1].content as { type: string }[];
  assert.deepEqual(parts.map((p) => p.type), ['text', 'text', 'image_url']);
});

test('celular não injeta system; cota do Gemini vira 429 amigável', async () => {
  const h = brain();
  const token = await pair(h);
  assert.equal((await call(h, 'POST', '/v1/chat', { messages: [{ role: 'system', content: 'x' }] }, token)).status, 400);
  geminiStatus = 429;
  const r = await call(h, 'POST', '/v1/chat', { messages: [{ role: 'user', content: 'oi' }] }, token);
  geminiStatus = 200;
  assert.equal(r.status, 429);
  assert.match(r.body.error, /cota do Gemini/);
});

test('ui-step valida o passo proposto', async () => {
  const h = brain();
  const token = await pair(h);
  reply = { role: 'assistant', content: '', tool_calls: [{ id: 'c', type: 'function', function: { name: 'ui_step', arguments: { kind: 'click', selector: { text: 'Buscar' }, explanation: 'abrir busca' } } }] };
  const ok = await call(h, 'POST', '/v1/ui-step', { goal: 'buscar', observation: {}, history: [] }, token);
  assert.equal(ok.body.status, 'continue');
  reply = { role: 'assistant', content: '', tool_calls: [{ id: 'c', type: 'function', function: { name: 'ui_step', arguments: '{"kind":"tap","x":1}' } }] };
  assert.equal((await call(h, 'POST', '/v1/ui-step', { goal: 'x', observation: {}, history: [] }, token)).body.status, 'fail');
});

test('escolha do modelo e limpeza das ferramentas', () => {
  assert.equal(pickModel(['models/gemini-2.0-flash', 'models/gemini-2.5-flash', 'models/gemini-2.5-flash-lite']), 'gemini-2.5-flash');
  assert.equal(pickModel(['models/gemma-3']), null);
  assert.equal(geminiTools(DEVICE_TOOLS).length, DEVICE_TOOLS.length);
});

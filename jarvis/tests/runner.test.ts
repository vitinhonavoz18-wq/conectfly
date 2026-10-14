import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActionLedger, MemoryStore } from '../src/core/ledger';
import { runAction, RunnerDeps } from '../src/core/runner';
import { ActionResult } from '../src/core/contract';
import { mkAction } from './helpers';

function setup(overrides: Partial<RunnerDeps> = {}) {
  let t = 1_000_000;
  const store = new MemoryStore();
  const ledger = new ActionLedger(store, () => t);
  const executed: string[] = [];
  const confirms: string[] = [];
  const deps: RunnerDeps = {
    ledger,
    now: () => t,
    policyContext: async () => ({ allowedUiApps: new Set(['com.whatsapp']), foregroundApp: 'com.whatsapp' }),
    confirm: async (req) => {
      confirms.push(req.title);
      return true;
    },
    execute: async (a): Promise<ActionResult> => {
      executed.push(a.id);
      return { status: 'completed', message: 'ok' };
    },
    ...overrides,
  };
  return { deps, ledger, store, executed, confirms, advance: (ms: number) => (t += ms) };
}

test('mesma ação (mesmo id) nunca roda duas vezes, mesmo após reconexão', async () => {
  const s = setup();
  const a = mkAction('open_app', { app: 'YouTube' });
  assert.equal((await runAction(a, s.deps)).status, 'completed');
  const again = await runAction(a, s.deps);
  assert.equal(again.error?.code, 'duplicate');
  assert.equal(s.executed.length, 1);

  // Novo processo (app reaberto) lendo o mesmo armazenamento
  const ledger2 = new ActionLedger(s.store, () => 1_000_000);
  const again2 = await runAction(a, { ...s.deps, ledger: ledger2 });
  assert.equal(again2.error?.code, 'duplicate');
  assert.equal(s.executed.length, 1);
});

test('ação expirada é recusada sem executar', async () => {
  const s = setup();
  const a = mkAction('open_app', { app: 'YouTube' });
  s.advance(61_000);
  const r = await runAction(a, s.deps);
  assert.equal(r.status, 'expired');
  assert.equal(s.executed.length, 0);
});

test('recusa da política não executa', async () => {
  const s = setup();
  const r = await runAction(mkAction('ui_navigate', { app: 'com.nu.production', goal: 'pix' }), s.deps);
  assert.equal(r.status, 'refused');
  assert.equal(r.error?.code, 'policy_denied');
  assert.equal(s.executed.length, 0);
});

test('usuário recusa confirmação → nada é executado', async () => {
  const s = setup({ confirm: async () => false });
  const a = mkAction('ui_step', { kind: 'click', selector: { text: 'Enviar' } }, { targetApp: 'com.whatsapp' });
  const r = await runAction(a, s.deps);
  assert.equal(r.status, 'cancelled');
  assert.equal(r.error?.code, 'user_declined');
  assert.equal(s.executed.length, 0);
});

test('reenvio com id novo e mesmo conteúdo pede confirmação de novo', async () => {
  const s = setup();
  await runAction(mkAction('share_text', { text: 'Pedido pronto' }), s.deps);
  assert.equal(s.confirms.length, 0);
  await runAction(mkAction('share_text', { text: 'Pedido pronto' }), s.deps);
  assert.equal(s.confirms.length, 1);
  assert.equal(s.confirms[0], 'Repetir esta ação?');
});

test('cancelamento antes da execução', async () => {
  const s = setup({ cancel: { cancelled: true } });
  const r = await runAction(mkAction('open_app', { app: 'x' }), s.deps);
  assert.equal(r.status, 'cancelled');
  assert.equal(s.executed.length, 0);
});

test('execução interrompida (app fechado) não é repetida ao reabrir', async () => {
  const s = setup({ execute: () => new Promise(() => {}) }); // nunca termina
  const a = mkAction('share_text', { text: 'x' });
  void runAction(a, s.deps);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(s.ledger.get(a.id)?.status, 'running');
  const ledger2 = new ActionLedger(s.store, () => 1_000_000);
  await ledger2.load();
  assert.equal(ledger2.get(a.id)?.status, 'failed');
  const r = await runAction(a, { ...s.deps, ledger: ledger2, execute: async () => ({ status: 'completed', message: 'x' }) });
  assert.equal(r.error?.code, 'duplicate');
});

test('erro nativo vira "failed" com mensagem', async () => {
  const s = setup({ execute: async () => { throw new Error('ActivityNotFound'); } });
  const r = await runAction(mkAction('open_url', { url: 'https://a.com' }), s.deps);
  assert.equal(r.status, 'failed');
  assert.match(r.message, /ActivityNotFound/);
});

test('histórico não guarda o conteúdo compartilhado', async () => {
  const s = setup();
  const a = mkAction('share_text', { text: 'segredo do cliente 123' });
  await runAction(a, s.deps);
  const raw = await s.store.getItem('jarvis.actionLedger.v1');
  assert.ok(raw && !raw.includes('segredo'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runUiTask, UiObservation, UiProposal } from '../src/core/uiAgent';

const PKG = 'com.example.notes';
const obs = (fp: string, pkg = PKG): UiObservation => ({ packageName: pkg, fingerprint: fp, nodes: [], truncated: false });
let n = 0;
const base = () => ({ newId: () => `ui-step-id-${++n}`, wait: async () => {}, cancel: { cancelled: false } });

test('fluxo completo: executa, verifica mudança e conclui', async () => {
  const screens = [obs('a'), obs('b'), obs('b'), obs('c')];
  const proposals: UiProposal[] = [
    { status: 'continue', step: { kind: 'click', selector: { text: 'Nova nota' } } },
    { status: 'done', summary: 'nota aberta' },
  ];
  const r = await runUiTask(PKG, 'criar nota', {
    ...base(),
    observe: async () => screens.shift() ?? null,
    propose: async () => proposals.shift()!,
    runStep: async () => ({ status: 'completed', message: 'enviado' }),
  });
  assert.equal(r.status, 'completed');
  assert.equal(r.steps.length, 1);
  assert.equal(r.steps[0].screenChanged, true);
});

test('para quando outro app aparece', async () => {
  const r = await runUiTask(PKG, 'x', {
    ...base(),
    observe: async () => obs('a', 'com.other'),
    propose: async () => ({ status: 'done', summary: '' }),
    runStep: async () => ({ status: 'completed', message: '' }),
  });
  assert.equal(r.error?.code, 'context_changed');
});

test('detecta loop do mesmo passo na mesma tela', async () => {
  let steps = 0;
  const r = await runUiTask(PKG, 'x', {
    ...base(),
    observe: async () => obs('same'),
    propose: async () => ({ status: 'continue', step: { kind: 'click', selector: { text: 'OK' } } }),
    runStep: async () => {
      steps++;
      return { status: 'completed', message: '' };
    },
  });
  assert.equal(r.status, 'failed');
  assert.equal(steps, 2);
});

test('limite de passos', async () => {
  let i = 0;
  const r = await runUiTask(PKG, 'x', {
    ...base(),
    maxSteps: 3,
    observe: async () => obs(`s${i++}`),
    propose: async () => ({ status: 'continue', step: { kind: 'scroll_forward' } }),
    runStep: async () => ({ status: 'completed', message: '' }),
  });
  assert.match(r.message, /Limite de 3 passos/);
});

test('cancelamento interrompe', async () => {
  const cancel = { cancelled: false };
  const r = await runUiTask(PKG, 'x', {
    ...base(),
    cancel,
    observe: async () => obs('a'),
    propose: async () => {
      cancel.cancelled = true;
      return { status: 'continue', step: { kind: 'back' } };
    },
    runStep: async () => ({ status: 'completed', message: '' }),
  });
  assert.equal(r.status, 'cancelled');
});

test('passo recusado pela política encerra sem continuar', async () => {
  const r = await runUiTask(PKG, 'x', {
    ...base(),
    observe: async () => obs('a'),
    propose: async () => ({ status: 'continue', step: { kind: 'click', selector: { text: 'Enviar' } } }),
    runStep: async () => ({ status: 'cancelled', message: 'Você não confirmou', error: { code: 'user_declined', message: '' } }),
  });
  assert.equal(r.status, 'cancelled');
});

test('serviço de acessibilidade desligado', async () => {
  const r = await runUiTask(PKG, 'x', { ...base(), observe: async () => null, propose: async () => ({ status: 'done', summary: '' }), runStep: async () => ({ status: 'completed', message: '' }) });
  assert.equal(r.status, 'unavailable');
});

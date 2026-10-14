import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, isBlockedPackage } from '../src/core/policy';
import { mkAction } from './helpers';

const allowed = new Set(['com.whatsapp', 'com.google.android.youtube']);

test('ações simples são permitidas sem confirmação', () => {
  assert.equal(decide(mkAction('open_app', { app: 'YouTube' }), { allowedUiApps: allowed }).decision, 'allow');
  assert.equal(decide(mkAction('open_settings', { panel: 'bluetooth' }), { allowedUiApps: allowed }).decision, 'allow');
});

test('navegação só em apps autorizados e nunca em bancos', () => {
  assert.equal(decide(mkAction('ui_navigate', { app: 'com.whatsapp', goal: 'abrir conversa' }), { allowedUiApps: allowed }).decision, 'allow');
  assert.equal(decide(mkAction('ui_navigate', { app: 'com.instagram.android', goal: 'x' }), { allowedUiApps: allowed }).decision, 'deny');
  const bank = new Set(['com.nu.production']);
  assert.equal(decide(mkAction('ui_navigate', { app: 'com.nu.production', goal: 'x' }), { allowedUiApps: bank }).decision, 'deny');
  assert.equal(isBlockedPackage('com.itau.pf'), true);
  // Nome falado: a política adia a checagem para o executor, que resolve o pacote.
  assert.equal(decide(mkAction('ui_navigate', { app: 'YouTube', goal: 'x' }), { allowedUiApps: new Set() }).decision, 'allow');
});

test('clique em "Enviar" exige confirmação com destinatário e conteúdo exatos', () => {
  const a = mkAction('ui_step', { kind: 'click', selector: { contentDescription: 'Enviar' } }, { targetApp: 'com.whatsapp' });
  const d = decide(a, { allowedUiApps: allowed, foregroundApp: 'com.whatsapp', screenTitle: 'Maria', pendingTypedText: 'Chego às 19h' });
  assert.equal(d.decision, 'confirm');
  if (d.decision === 'confirm') {
    assert.deepEqual(d.details.find((x) => x.label === 'Destinatário / tela')?.value, 'Maria');
    assert.deepEqual(d.details.find((x) => x.label === 'Conteúdo')?.value, 'Chego às 19h');
  }
  for (const label of ['Comprar agora', 'Excluir', 'Publicar', 'Finalizar pedido', 'Pagar']) {
    const x = mkAction('ui_step', { kind: 'click', selector: { text: label } }, { targetApp: 'com.whatsapp' });
    assert.equal(decide(x, { allowedUiApps: allowed }).decision, 'confirm', label);
  }
});

test('nunca preenche senha, código ou cartão', () => {
  const pw = mkAction('ui_step', { kind: 'set_text', selector: { viewId: 'input' }, text: '123' }, { targetApp: 'com.whatsapp' });
  assert.equal(decide(pw, { allowedUiApps: allowed, targetFieldIsPassword: true }).decision, 'deny');
  const otp = mkAction('ui_step', { kind: 'set_text', selector: { text: 'Código de verificação' }, text: '123456' }, { targetApp: 'com.whatsapp' });
  assert.equal(decide(otp, { allowedUiApps: allowed }).decision, 'deny');
  const ok = mkAction('ui_step', { kind: 'set_text', selector: { text: 'Pesquisar' }, text: 'receitas' }, { targetApp: 'com.whatsapp' });
  assert.equal(decide(ok, { allowedUiApps: allowed }).decision, 'allow');
});

test('para se o app em primeiro plano mudou', () => {
  const a = mkAction('ui_step', { kind: 'click', selector: { text: 'Buscar' } }, { targetApp: 'com.whatsapp' });
  assert.equal(decide(a, { allowedUiApps: allowed, foregroundApp: 'com.android.chrome' }).decision, 'deny');
});

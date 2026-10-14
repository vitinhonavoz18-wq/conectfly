import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePhone, sanitizeUrl, validateAction } from '../src/core/validate';
import { mkAction } from './helpers';

const NOW = 1_000_000;

test('aceita ação válida e normaliza url', () => {
  const r = validateAction(mkAction('open_url', { url: 'youtube.com/watch?v=1' }), NOW);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal((r.action.args as { url: string }).url, 'https://youtube.com/watch?v=1');
});

test('recusa ferramenta desconhecida (ex.: shell)', () => {
  const r = validateAction({ ...mkAction('open_app', { app: 'x' }), tool: 'run_shell' }, NOW);
  assert.equal(r.ok, false);
});

test('recusa campos extras, inclusive tentativa de desligar confirmação', () => {
  const a = { ...mkAction('share_text', { text: 'oi' }), requireConfirmation: false };
  // campos extras no topo são ignorados, mas nos argumentos são recusados
  const r1 = validateAction(a, NOW);
  assert.equal(r1.ok, true);
  if (r1.ok) assert.equal('requireConfirmation' in r1.action, false);
  const r2 = validateAction(mkAction('share_text', { text: 'oi', skipConfirm: true } as never), NOW);
  assert.equal(r2.ok, false);
});

test('recusa esquemas perigosos de url', () => {
  for (const u of ['javascript:alert(1)', 'intent://x#Intent;end', 'file:///sdcard', 'content://a', 'https://user:pass@host.com']) {
    assert.throws(() => sanitizeUrl(u), u);
  }
});

test('telefone mantém só dígitos', () => {
  assert.equal(sanitizePhone('(11) 99999-0000'), '11999990000');
  assert.equal(sanitizePhone('+55 11 9999'), '+55119999');
  assert.throws(() => sanitizePhone('ab'));
});

test('recusa id fraco, validade longa demais e data no futuro', () => {
  assert.equal(validateAction({ ...mkAction('open_app', { app: 'x' }), id: '1' }, NOW).ok, false);
  assert.equal(validateAction(mkAction('open_app', { app: 'x' }, { expiresAt: NOW + 3_600_000 }), NOW).ok, false);
  assert.equal(validateAction(mkAction('open_app', { app: 'x' }, { createdAt: NOW + 120_000, expiresAt: NOW + 150_000 }), NOW).ok, false);
});

test('ui_step exige seletor para clique e texto para preenchimento', () => {
  assert.equal(validateAction(mkAction('ui_step', { kind: 'click' }, { targetApp: 'com.app.x' }), NOW).ok, false);
  assert.equal(validateAction(mkAction('ui_step', { kind: 'set_text', selector: { text: 'Busca' } }, { targetApp: 'com.app.x' }), NOW).ok, false);
  assert.equal(validateAction(mkAction('ui_step', { kind: 'back' }, { targetApp: 'com.app.x' }), NOW).ok, true);
  assert.equal(validateAction(mkAction('ui_step', { kind: 'click', selector: { x: 10, y: 20 } as never }, { targetApp: 'com.app.x' }), NOW).ok, false);
});

test('recusa pacote de destino inválido', () => {
  assert.equal(validateAction(mkAction('open_app', { app: 'x' }, { targetApp: 'rm -rf /' }), NOW).ok, false);
});

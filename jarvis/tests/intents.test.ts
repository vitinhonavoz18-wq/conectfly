import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalCommand } from '../src/core/intents';
import { resolveApp } from '../src/core/apps';

function action(t: string) {
  const r = parseLocalCommand(t);
  assert.ok(r && r.kind === 'action', `esperava ação para "${t}", veio ${JSON.stringify(r)}`);
  return r;
}

test('abre app', () => {
  const r = action('Jarvis, abra o YouTube.');
  assert.equal(r.tool, 'open_app');
  assert.deepEqual(r.args, { app: 'YouTube' });
});

test('configurações de bluetooth', () => {
  const r = action('Abra as configurações de Bluetooth.');
  assert.equal(r.tool, 'open_settings');
  assert.deepEqual(r.args, { panel: 'bluetooth' });
});

test('mapa com endereço preserva acentos', () => {
  const r = action('Abra o mapa com este endereço: Avenida Paulista, 1000, São Paulo');
  assert.equal(r.tool, 'open_map');
  assert.deepEqual(r.args, { address: 'Avenida Paulista, 1000, São Paulo' });
  assert.equal(parseLocalCommand('Abra o mapa com este endereço')?.kind, 'clarify');
});

test('compartilhar texto', () => {
  const r = action('Prepare este texto para compartilhar: Seu pedido saiu para entrega');
  assert.equal(r.tool, 'share_text');
  assert.deepEqual(r.args, { text: 'Seu pedido saiu para entrega' });
  assert.equal(parseLocalCommand('Prepare este texto para compartilhar.')?.kind, 'clarify');
});

test('discador e mídia e site', () => {
  assert.deepEqual(action('ligar para 11 99999-0000').args, { phone: '11 99999-0000' });
  assert.deepEqual(action('pausar').args, { command: 'pause' });
  assert.deepEqual(action('próxima música').args, { command: 'next' });
  assert.equal(action('abrir o site g1.globo.com').tool, 'open_url');
});

test('pergunta livre não vira ação local', () => {
  assert.equal(parseLocalCommand('qual a previsão do tempo amanhã?'), null);
});

test('resolve app por rótulo e catálogo', () => {
  const installed = [
    { packageName: 'com.google.android.youtube', label: 'YouTube' },
    { packageName: 'com.whatsapp', label: 'WhatsApp' },
    { packageName: 'br.com.brainweb.ifood', label: 'iFood' },
  ];
  assert.equal(resolveApp('youtube', installed)?.packageName, 'com.google.android.youtube');
  assert.equal(resolveApp('Whats App', installed), null);
  assert.equal(resolveApp('whatsapp', installed)?.packageName, 'com.whatsapp');
  assert.equal(resolveApp('ifood', installed)?.packageName, 'br.com.brainweb.ifood');
  assert.equal(resolveApp('spotify', installed), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBackendUrl } from '../src/core/backendUrl';

test('aceita IP da rede local com http e avisa', () => {
  const r = checkBackendUrl('192.168.0.10:8787');
  assert.deepEqual(r, { ok: true, url: 'http://192.168.0.10:8787', note: 'Conexão sem criptografia: use apenas na sua rede Wi-Fi de confiança.' });
});

test('recusa localhost explicando o motivo', () => {
  const r = checkBackendUrl('http://localhost:8787');
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /próprio celular/);
});

test('exige https fora da rede local', () => {
  assert.equal(checkBackendUrl('http://meujarvis.example.com').ok, false);
  assert.equal(checkBackendUrl('https://meujarvis.example.com/').ok, true);
  assert.equal(checkBackendUrl('http://8.8.8.8:8787').ok, false);
  assert.equal(checkBackendUrl('http://172.32.0.1').ok, false);
  assert.equal(checkBackendUrl('http://100.101.1.2:8787').ok, true); // Tailscale
});

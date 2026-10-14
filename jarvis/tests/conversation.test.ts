import { test } from 'node:test';
import assert from 'node:assert/strict';
import { farewell, isEndPhrase, refersToScreen, shouldEndAfterTurn } from '../src/core/conversation';

test('gírias e agradecimentos encerram a conversa', () => {
  for (const t of [
    'valeu bonitão',
    'Obrigado Jarvis.',
    'obrigada!',
    'valeu, era só isso',
    'falou mano',
    'flw',
    'tchau Jarvis',
    'beleza, valeu',
    'show, tamo junto',
    'pode ir, Jarvis',
    'é isso, obrigado',
    'brigadão chefe',
    'até mais',
    'fechou!',
    'por hoje é só',
    'Jarvis, missão cumprida',
  ]) {
    assert.equal(isEndPhrase(t), true, t);
  }
});

test('agradecimento seguido de pedido NÃO encerra', () => {
  for (const t of [
    'obrigado, agora abre o YouTube',
    'valeu, e qual a previsão do tempo?',
    'tchau não, espera, pausa o vídeo',
    'esse vídeo tá explicativo demais?',
    'ok',
    'beleza',
    'Jarvis',
    '',
  ]) {
    assert.equal(isEndPhrase(t), false, t);
  }
});

test('encerra sozinho depois de concluir tarefa, a menos que tenha perguntado algo', () => {
  assert.equal(shouldEndAfterTurn({ completedActions: 1, reply: 'Abri o YouTube.' }), true);
  assert.equal(shouldEndAfterTurn({ completedActions: 1, reply: 'Abri. Quer que eu pesquise algo?' }), false);
  assert.equal(shouldEndAfterTurn({ completedActions: 0, reply: 'Paris é a capital da França.' }), false);
});

test('despedidas variadas', () => {
  const set = new Set([0, 1, 2, 3, 4].map((i) => farewell(i)));
  assert.equal(set.size, 5);
});

test('detecta perguntas sobre o que está na tela', () => {
  assert.equal(refersToScreen('Jarvis, será que esse vídeo tá explicativo demais?'), true);
  assert.equal(refersToScreen('o que é isso?'), true);
  assert.equal(refersToScreen('quem é esse cara?'), true);
  assert.equal(refersToScreen('qual a previsão do tempo amanhã?'), false);
  assert.equal(refersToScreen('abre o YouTube'), false);
});

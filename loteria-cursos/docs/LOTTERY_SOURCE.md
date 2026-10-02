# Fonte dos resultados (LotterySourceAdapter)

## Situação da fonte da CAIXA — leia antes de tudo

O sistema usa o endpoint JSON que o **próprio portal de Loterias da CAIXA** consome:

```
GET https://servicebus2.caixa.gov.br/portaldeloterias/api/{modalidade}            → último concurso
GET https://servicebus2.caixa.gov.br/portaldeloterias/api/{modalidade}/{concurso} → concurso específico
modalidade: megasena | lotofacil | quina | lotomania   (também existem timemania, duplasena, federal…)
```

- Ele está **no domínio oficial da CAIXA**, mas **não é uma API pública documentada para
  desenvolvedores**: não há contrato, versionamento, SLA nem aviso de mudança publicados.
- Por isso **não o apresentamos como "API pública oficial"**. Ele pode mudar ou bloquear acessos sem aviso.
- Na rede de desenvolvimento deste projeto o domínio estava bloqueado: o endpoint **não pôde ser chamado
  ao vivo** — **NÃO TESTADO CONTRA API REAL**. Os nomes dos campos foram confirmados pela biblioteca pública
  `loteria-caixa` (PyPI), que consome o mesmo endpoint, e por projetos públicos que usam o mesmo JSON.
- Alguns clientes relatam cadeia de certificado TLS incompleta nesse servidor (há bibliotecas que desligam a
  verificação TLS — **nós nunca fazemos isso**). Se aparecer erro de certificado no engine, adicione a cadeia
  intermediária num `docker-compose.override.yml`:
  ```yaml
  services:
    engine:
      environment: { NODE_EXTRA_CA_CERTS: /certs/caixa-chain.pem }
      volumes: ["./certs:/certs:ro"]
  ```

## Campos usados e validações

| Campo CAIXA                    | Vira                            | Validação                                                                                                     |
| ------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `tipoJogo`                     | —                               | precisa ser o esperado (`MEGA_SENA`, `LOTOFACIL`, `QUINA`, `LOTOMANIA` — em `lottery_games.source_game_type`) |
| `numero`                       | `contest`                       | inteiro > 0; no pedido por concurso, igual ao pedido                                                          |
| `dataApuracao` (dd/mm/aaaa)    | `draw_day`, `draw_date`         | data real, não futura (fuso America/Bahia)                                                                    |
| `listaDezenas` (["04",…])      | `numbers` (inteiros, ordenados) | só dígitos, quantidade exata, intervalo, sem repetição                                                        |
| `dezenasSorteadasOrdemSorteio` | `draw_order`                    | mesmo conjunto de `listaDezenas` (checagem cruzada)                                                           |
| `acumulado`                    | `accumulated`                   | booleano                                                                                                      |
| `valorEstimadoProximoConcurso` | `estimated_prize`               | número ≥ 0                                                                                                    |
| `dataProximoConcurso`          | `next_draw_day`                 | data real, depois do sorteio                                                                                  |
| `numeroConcursoProximo`        | `next_contest`                  | = `numero + 1`                                                                                                |
| resposta inteira               | `raw_payload`                   | guardada para auditoria                                                                                       |

Lista vazia de dezenas = `RESULT_NOT_READY` (concurso aberto mas ainda sem resultado: tenta de novo).
HTTP 200 com HTML (manutenção) = `SOURCE_UNAVAILABLE` (tenta de novo). Qualquer inconsistência =
`INVALID_PAYLOAD`: **nada é gravado nem publicado** e o erro vai para `workflow_errors`.

A única transformação aplicada às dezenas oficiais é **ordenar**. Lotomania usa `00`–`99` (00 = zero).

## Hash e conflito de dados

`source_hash = SHA-256( JSON canônico de {game, contest, draw_day, numbers ordenados, accumulated} )`.

Só entra o que é **imutável** num resultado. Estimativas de prêmio ficam de fora porque a CAIXA pode revisá-las
depois do sorteio — senão uma revisão de estimativa viraria falso conflito.

Se o mesmo concurso voltar com hash diferente: **DATA_CONFLICT** — o registro original é mantido, a diferença é
gravada em `data_conflicts`, o resultado fica `data_status = CONFLICT` e nenhum conteúdo é criado/publicado até
análise manual. Para resolver: confira no site da CAIXA, corrija/apague o registro errado manualmente e marque
`data_conflicts.resolved_at`.

## Cronograma (configurável)

Desde **19/07/2026** a CAIXA passou os sorteios de sábado para **domingo às 11h** (fonte: notícias de jul/2026;
o portal da CAIXA estava inacessível no desenvolvimento — **confira** em
<https://loterias.caixa.gov.br/Paginas/regras-sorteios.aspx>).

| Modalidade | Dias e horários (America/Bahia = Brasília) |
| ---------- | ------------------------------------------ |
| Mega-Sena  | terça e quinta 21h · domingo 11h           |
| Lotofácil  | segunda a sexta 21h · domingo 11h          |
| Quina      | segunda a sexta 21h · domingo 11h          |
| Lotomania  | segunda, quarta e sexta 21h                |

Tudo fica em `lottery_games.draw_schedule` (ex.: `[{"days":[2,4],"time":"21:00"},{"days":[0],"time":"11:00"}]`,
0 = domingo). Mudou o horário? `UPDATE lottery_games SET draw_schedule = '…' WHERE slug = 'megasena';` —
nenhum workflow precisa mudar. `result_window_minutes` (padrão 20) é a espera após o sorteio antes de consultar;
`prediction_schedule.hours_before_draw` (padrão 5) é quando o palpite é gerado.

O palpite só é gerado se o **último resultado oficial** apontar (`dataProximoConcurso`) para a data do próximo
sorteio da agenda — assim o número do concurso alvo vem da fonte oficial, não de um cálculo nosso.

## Trocar ou adicionar uma fonte

1. Implemente `LotterySourceAdapter` (`packages/lottery-core/src/sources/types.ts`):
   `fetchLatest(game)` e `fetchContest(game, contest)` devolvendo `SourceResult` (normalizado + validado).
2. Registre em `createSourceAdapter()` (`sources/index.ts`).
3. Defina `LOTTERY_SOURCE=<nome>` no `.env`.

Workflows, banco, renderer e publicação não mudam. Reaproveite `validateNormalizedDraw()` e `computeSourceHash()`.

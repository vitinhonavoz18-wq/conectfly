# ZÉ CARRETO — Fase 4: motorista e rastreamento

> Para o dono do projeto. O que foi pedido, o que ficou pronto, o que foi
> verificado e o que ainda falta.

---

## O que mudou, na prática

Até a Fase 3 o cliente conseguia pedir um carreto, mas **ninguém do outro
lado conseguia pegá-lo**. Agora o ciclo fecha: o carreteiro fica online,
recebe a oferta, aceita, toca a corrida etapa por etapa — e o cliente
acompanha tudo no mapa.

### A tela de trabalho do carreteiro

Em `/zecarreto/motorista/trabalho`:

1. escolhe o veículo (quem tem mais de um) e aperta **FICAR ONLINE**;
2. o aplicativo pede permissão de localização e explica por quê;
3. as ofertas chegam com tudo o que ele precisa para decidir;
4. **ACEITAR** ou **RECUSAR**;
5. aceito, ele empurra a corrida: *estou a caminho → cheguei → carregando
   → seguindo viagem → cheguei no destino → entrega concluída*.

### O que aparece na oferta

Categoria, distância até a retirada, distância do serviço, modalidade,
horário, adicionais, quantidade de ajudantes e **quanto ele vai receber**.

O endereço de retirada aparece **aproximado** antes do aceite — bairro e
cidade, sem o número da casa. É o anúncio de imóvel: você vê a região
antes de marcar a visita. Depois do aceite, o endereço exato aparece.

### O que o cliente vê

Foto do carreteiro, nome, nota, quantos carretos já fez, o veículo com a
placa, a posição dele andando no mapa, a previsão de chegada e a etapa
atual. Tem também um **botão de compartilhar**: gera um link para mandar a
quem está esperando a carga do outro lado.

Quem abre o link vê o carreto andando — mas **não vê telefone nem valor**.
Acompanhar não é ter acesso à conta de ninguém.

### Conversa dentro da plataforma

Cliente e carreteiro conversam por ali mesmo: *"estou na portaria"*, *"a
rua é estreita, entra pela lateral"*. Ninguém precisa passar o telefone
pessoal, e se houver discussão depois, está tudo registrado. O sistema
também escreve na conversa os avisos automáticos ("o carreteiro chegou").

---

## O motor de matching

Antes de oferecer um carreto, o sistema confere seis coisas — a mesma
conferência que um despachante experiente faria antes de ligar para
alguém:

1. está **online** e com sinal recente (não sumiu do mapa);
2. cadastro **aprovado** e nota acima do mínimo;
3. tem **veículo aprovado** da categoria pedida;
4. está na **região** do carreto;
5. está **perto** o bastante da retirada;
6. **não tem conflito** — nem outro carreto rolando, nem compromisso
   marcado que cruze com aquele horário.

### A agenda dos agendados

Um carreteiro não pode estar em dois lugares ao mesmo tempo, e agora o
**banco garante isso**: dois compromissos que se cruzam simplesmente não
entram. É o caderno de reservas que só aceita um nome por horário — se
tentar marcar dois, a caneta trava.

Diferença importante: no carreto **imediato** o carreteiro fica "ocupado"
na hora. No **agendado**, ele continua livre para rodar até a hora
marcada — só aquele horário fica reservado.

---

## Rastreamento sem encher o banco

O celular sabe a posição a cada segundo. Gravar tudo isso seria filmar o
dia inteiro para depois procurar dois minutos de imagem. Então:

- a **posição atual** fica numa linha só por carreteiro, que é
  sobrescrita;
- a **trilha da corrida** só ganha um ponto quando ele realmente andou
  (60 metros, configurável) — ou quando faz muito tempo desde o último
  ponto, para provar que estava parado ali.

No teste, 10 minutos de viagem com sinal a cada 5 segundos geraram 120
sinais e menos de 60 pontos guardados. A trilha fica fiel, o banco não
incha, e ainda serve de histórico para segurança e auditoria.

**A localização só é enviada quando precisa**: o aparelho só acompanha
enquanto o carreteiro está online ou dentro de um carreto. Fora disso,
desliga — bateria é o combustível do celular dele.

---

## Quando algo dá errado

| Situação | O que o sistema faz |
|---|---|
| Carreteiro desiste depois de aceitar | O carreto **volta para a fila**, não é cancelado. O cliente é avisado na conversa e outro carreteiro é chamado. |
| Cliente cancela | Já tratado desde a Fase 1, com a taxa conforme a tarifa. |
| Perda de sinal | Depois do prazo, o carreto volta para a fila e o carreteiro sai do ar. |
| Aplicativo fechado | O aparelho informa que está em segundo plano; sem sinal, cai no caso acima. |
| Ninguém aceita | Novas rodadas com raio maior, até o limite configurado. |
| Reassociação | Cada volta para a fila é contada; passando do limite, fica um alerta para o suporte. |

---

## Dois bugs sérios que os testes pegaram

Vale contar, porque os dois só apareceram por causa dos testes pedidos
nesta fase — e os dois teriam dado dor de cabeça em produção.

### 1. O carreto que ficaria preso para sempre

Quando o carreteiro desistia, a oferta dele continuava marcada como
"aceita". Como existe uma trava de *"uma corrida, um aceite"*, **nenhum
outro carreteiro conseguiria pegar aquele carreto** — ele ficaria rodando
na fila sem que ninguém pudesse aceitar. Era a mesa reservada para quem já
foi embora, e o restaurante sem poder sentar ninguém.

### 2. O sistema travando sozinho na disputa

Com vários carreteiros apertando "aceitar" no mesmo segundo, o banco
entrava em **deadlock**: cada conexão travava primeiro a *sua oferta* e
depois a *corrida*, em ordens diferentes, formando um ciclo — como duas
pessoas num corredor estreito, cada uma esperando a outra passar.

A correção foi padronizar: **todo mundo trava a corrida primeiro**. Vira
uma fila de um por vez, e a primeira pessoa que entra leva o carreto.

De quebra, a mensagem de recusa também estava errada: dizia *"esta oferta
já foi respondida"* — culpando quem não fez nada. Agora diz o que de fato
aconteceu: *"outro carreteiro aceitou primeiro"*.

---

## O que foi verificado (de verdade)

| Verificação | Resultado |
|---|---|
| 7 migrações do zero + reaplicação | passam, sem duplicar nada |
| Testes de banco das Fases 1 a 4 | os quatro passam |
| **Teste de concorrência real** | 8, 12 e 20 conexões simultâneas: sempre 1 aceite e o resto recusado |
| 138 testes de regras | 138 passam |
| Typecheck, lint e build | limpos |

O teste de concorrência não é simulação: ele abre **conexões de verdade**
com o banco, todas programadas para apertar "aceitar" no mesmo instante. É
a diferença entre ensaiar a fila do caixa com uma pessoa e abrir a porta
do mercado no dia da promoção.

Cenários testados no banco, um a um:

- dois compromissos que se cruzam na agenda do mesmo carreteiro são
  recusados; o mesmo horário para outro carreteiro é aceito;
- o aceite confere a agenda antes de fechar e cria a reserva;
- carreteiro com compromisso não consegue pegar outro carreto no mesmo
  horário;
- desistência devolve o carreto para a fila, libera a agenda, deixa o
  carreteiro disponível de novo e avisa o cliente na conversa;
- carreto sem motorista não pode ser "devolvido";
- oferta repetida na mesma rodada é barrada;
- carreteiro sem sinal sai do ar, e o carreto dele é reassociado — nessa
  ordem, porque quem está "ocupado" precisa ser solto antes;
- link de acompanhamento é único por carreto;
- mensagem vazia não entra na conversa;
- carreto concluído libera a agenda.

---

## Conferência do que foi pedido

| Pedido | Situação |
|---|---|
| Motorista seleciona veículo e fica online | pronto |
| Localização só quando necessário e com permissão | pronto |
| Matching: online, aprovado, veículo compatível, região, proximidade, sem conflito, horário do agendamento | pronto, os 7 critérios |
| Oferta mostra categoria, distância até retirada, origem aproximada, destino, distância do serviço, modalidade, horário, adicionais, ajudantes, ganho | pronto |
| Botões ACEITAR / RECUSAR | pronto |
| Evitar dois motoristas na mesma corrida | pronto, com teste de concorrência real |
| Etapas após o aceite | pronto |
| Cliente vê motorista, foto, veículo, placa, avaliação, posição, ETA, status | pronto |
| Realtime otimizado, sem gravar demais | pronto |
| Histórico simplificado da rota | pronto |
| Comunicação cliente↔motorista + arquitetura para chat | pronto |
| Botão de compartilhar acompanhamento | pronto |
| Agendados: reserva configurável e sem conflito | pronto |
| Motorista cancela / cliente cancela / perda de sinal / offline / app fechado / não aceita / reassociação | pronto |

---

## O que você precisa fazer do seu lado

1. **Rodar a migração nova** (`20260821100000_zecarreto_dispatch_tracking.sql`).
   Ela liga uma extensão do banco (`btree_gist`) para a trava de agenda —
   o Supabase já traz essa extensão.

2. **Acionar a faxina de estado.** Existe o endereço
   `/api/zecarreto/admin/dispatch/recover`, que tira do ar quem sumiu e
   devolve os carretos abandonados para a fila. Hoje ele é acionado pelo
   admin; virar tarefa automática está na Fase 5.

3. **Conferir os prazos** nas configurações, se quiser ajustar: quanto
   tempo sem sinal conta como "sumiu" (5 min), de quantos em quantos
   metros a trilha grava um ponto (60 m) e por quantas horas o link de
   acompanhamento vale (12 h).

---

## O que fica para a FASE 5

- **A tela ainda se atualiza por conferência periódica** (de 10 em 10
  segundos), não por tempo real de verdade. As tabelas já estão publicadas
  para o tempo real do Supabase; falta a tela assinar o canal.
- **Pagamento automático** continua fora.
- **Aviso no celular** (push): as notificações são gravadas e aparecem
  dentro do aplicativo, mas ainda não tocam o celular.
- **A distância ainda é linha reta + 30%**, e a previsão de chegada usa
  velocidade média — sem trânsito real. Com um serviço de mapas pago, os
  dois ficam exatos.
- **A tarefa automática de despacho** (novas rodadas de oferta e faxina de
  estado rodando sozinhas).

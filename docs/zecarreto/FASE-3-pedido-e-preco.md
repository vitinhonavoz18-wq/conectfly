# ZÉ CARRETO — Fase 3: pedido e preço

> Para o dono do projeto. O que foi pedido, o que ficou pronto, o que foi
> verificado e o que ainda falta.

---

## O que mudou, na prática

Até a Fase 2 dava para criar conta e cadastrar carreteiro, mas **ninguém
conseguia pedir um carreto**. Agora o cliente entra, escolhe o veículo,
informa os endereços, vê o preço na hora e confirma.

O caminho tem 5 passos, um por tela:

1. **O que você precisa transportar?** — cartões de Pequeno, Médio,
   Bongo/HR, Caminhão e **"Não sei qual escolher"**.
2. **De onde para onde** — retirada, paradas no meio do caminho, entrega,
   com busca de endereço e mapa.
3. **Quando** — agora (imediato) ou marcado (agendado).
4. **Detalhes** — descrição, fotos dos objetos, observações, ajudantes e
   adicionais.
5. **Confira antes de confirmar** — o resumo com tudo e o preço final.

### "Não sei qual escolher"

O cliente marca o que vai levar ("1 geladeira, 1 sofá, 10 caixas") e o
sistema soma volume e peso para sugerir o veículo. É a mesma conta que o
carreteiro experiente faz de cabeça — só que escrita.

A sugestão **nunca decide sozinha**: aparece o motivo em português ("pelo
que você marcou, cerca de 3,2 m³ e 220 kg, o Bongo/HR dá conta") e o
cliente pode trocar na mão.

---

## O motor de tarifas

Todo valor sai de um cadastro que **você edita pela tela**, em
`/zecarreto/admin/precos`. Nada de preço escrito no sistema.

| O que dá para configurar | Exemplo |
|---|---|
| Bandeirada | R$ 35,00 |
| Km já inclusos na bandeirada | 5 km |
| Valor por km **excedente** | R$ 3,20 |
| Valor por minuto | R$ 0,60 |
| Tarifa mínima (piso) | R$ 50,00 |
| Parada extra | R$ 12,00 |
| Ajudante | R$ 45,00 |
| Acréscimo do imediato | +35% |
| Acréscimo noturno / fim de semana | 0% (você define) |
| Comissão da plataforma | 20% |
| Taxa de serviço (fixa e/ou %) | R$ 0,00 |
| Pedágio | não cobrar / valor fixo acima de X km / vindo do mapa |
| Taxa de cancelamento | R$ 15,00 |

A **franquia de km** é a novidade: a bandeirada agora pode já incluir
alguns quilômetros, como o pacote de internet que vem com uma franquia — só
depois dela começa a contar.

### Adicionais viraram cadastro

Escada, item pesado, montagem, embalagem, carregamento a distância e carga
urgente agora são **linhas de um cadastro**, com preço próprio e forma de
cobrança:

- **valor fixo** (montagem: R$ 80,00);
- **por unidade** (item pesado: R$ 50,00 cada);
- **por andar** (escada: R$ 15,00 por andar);
- **percentual** (carga urgente: +10% sobre o serviço).

Dá para criar um adicional só para uma categoria ou só para uma região — o
mais específico ganha, como o cardápio da filial que sobrepõe o da rede.

### A ordem da conta

Isso importa e está testado:

1. bandeirada + km excedente + tempo + paradas extras + ajudantes +
   adicionais de valor fixo;
2. se der menos que a tarifa mínima, cobra a mínima;
3. adicionais em percentual, sobre o valor até aqui;
4. acréscimos: **imediato (+35%)**, noturno, fim de semana, demanda;
5. **pedágio entra por fora** — é repasse, não leva os 35% nem entra na
   comissão; vai inteiro para o carreteiro;
6. taxa de serviço da plataforma;
7. arredondamento final.

---

## As travas que passaram a existir

### O preço nunca vem da tela

O aplicativo diz *"quero escada e 2 ajudantes"*. **Quanto isso custa quem
decide é o cadastro.** Se alguém adulterar o aplicativo e mandar um
adicional com preço próprio, ou um código de adicional que não existe, o
servidor simplesmente ignora — é o porteiro conferindo a lista em vez de
aceitar quem diz "pode deixar, eu sou convidado".

### Preço fechado é preço fechado

Cada orçamento guarda uma **fotografia da tarifa** do momento: os valores,
os adicionais e até o fuso da região. Quando o pedido é confirmado, essa
fotografia vai junto.

Resultado: você pode reajustar a tabela hoje à tarde que **o carreto
fechado de manhã continua valendo o que valia**. E o banco recusa qualquer
alteração de preço depois que o pedido sai do rascunho — mesmo vinda de um
erro de programação.

É como reimprimir a conta do jantar: o cardápio pode ter mudado, mas a
conta daquela noite é a daquela noite.

### O imediato só procura motorista depois de confirmado

Enquanto o cliente não confirma, **nenhum carreteiro é chamado**. O pedido
fica em "aguardando confirmação" e só então entra na fila de busca. O banco
também barra o atalho: pular do rascunho direto para "procurando motorista"
é recusado.

---

## O que foi verificado (de verdade)

| Verificação | Resultado |
|---|---|
| 6 migrações do zero + reaplicação | passam, sem duplicar nada |
| Testes de banco das Fases 1, 2 e 3 | os três passam |
| 112 testes de regras | 112 passam |
| Typecheck, lint e build | limpos |

Cenários testados no cálculo, um a um:

- **franquia de km**: 15 km com 5 inclusos cobram 10; viagem dentro da
  franquia não cobra distância; nunca fica negativo;
- **adicionais**: por andar multiplica, fixo não multiplica, quantidade
  acima do limite é cortada, código inexistente é ignorado, percentual
  incide sobre o subtotal;
- **pedágio**: só acima da distância combinada, não leva os 35% do imediato
  e não entra na comissão (vai inteiro ao carreteiro);
- **fuso horário**: o relógio é o da REGIÃO, não o do servidor; a janela
  noturna atravessa a meia-noite (22h→6h) e foi conferida minuto a minuto;
  sexta 23:30 em São Paulo não conta como fim de semana, mesmo já sendo
  sábado no horário universal;
- **arredondamento**: com passo de 10, 50 ou 100 centavos, comissão +
  carreteiro **sempre** fecham o total exato, e todo valor é centavo
  inteiro;
- **mudança de tarifa**: com a tabela aumentada, refazer a conta pelo
  snapshot dá o mesmo valor de antes;
- **casos extremos**: distância zero cai na mínima; viagem de 1.500 km não
  estoura; comissão de 100% não deixa o carreteiro negativo; dados
  impossíveis são recusados;
- **imediato**: exatamente 1,35 vez o agendado, inclusive com ajudantes,
  paradas e adicionais na conta.

---

## Conferência do que foi pedido

| Pedido | Situação |
|---|---|
| Home "O que você precisa transportar?" com os 4 cartões + "Não sei" | pronto |
| Retirada, destino, múltiplas paradas | pronto (limite configurável, hoje 6) |
| Mapa | pronto (OpenStreetMap, provedor trocável) |
| Data e horário | pronto |
| Fotos dos objetos | pronto |
| Descrição, quantidade aproximada, observações | pronto |
| Elevador, escadas | pronto (por parada; escada vira adicional por andar) |
| Ajudantes, itens pesados, outros adicionais | pronto |
| Agendado = tarifa normal / Imediato = ×1,35 | pronto e testado |
| Toda regra calculada no backend | pronto |
| Nunca confiar em valores do frontend | pronto e testado |
| Motor de tarifas configurável pelo admin | pronto, com tela |
| Tarifa por categoria, região/zona | pronto |
| Distância incluída, valor por km excedente | pronto |
| Adicionais, ajudantes, pedágio | pronto |
| Resumo antes de confirmar (11 itens pedidos) | pronto |
| Snapshot financeiro do orçamento | pronto e testado |
| Recomendação de categoria com alteração manual | pronto |
| IA visual | **não implementada**, como pedido |
| Pedidos agendados e imediatos | pronto |
| Imediato só busca motorista após confirmação | pronto e testado |

---

## O que você precisa fazer do seu lado

1. **Rodar a migração nova** (`20260820100000_zecarreto_pricing_engine.sql`).
   Ela já coloca 5 km de franquia nas tarifas padrão e cria os 6 adicionais
   e os 20 itens do catálogo.

2. **Revisar os preços** em `/zecarreto/admin/precos` antes de abrir para
   clientes. Os valores atuais são de exemplo.

3. **Conferir o mapa.** Hoje ele usa o OpenStreetMap, que é gratuito mas
   tem limite de uso e **não serve para volume alto**. Quando a plataforma
   crescer, troque o endereço em `map.tile_url` e `geocode.provider_url`
   por um serviço pago — o resto do sistema não muda.

4. **Definir o pedágio.** Nasce como "não cobrar". Se quiser cobrar, escolha
   "valor fixo acima de X km" na tela de preços.

---

## O que fica para a FASE 4

- **A distância ainda é estimada em linha reta + 30%** (rua não é régua).
  Com um serviço de mapas de verdade, ela fica exata — o lugar de plugar já
  está pronto e isolado.
- **Pagamento de verdade** (Pix automático e cartão). Hoje o cliente
  confirma e combina o acerto com o carreteiro.
- **Acompanhamento da corrida** — a tela do pedido mostra o status, mas
  ainda não mostra o carreteiro andando no mapa.
- **As rodadas de busca rodando sozinhas** — a fila existe, mas a próxima
  rodada de ofertas ainda precisa ser acionada.
- **Aviso de preço antes de agendar em horário de acréscimo** — hoje o
  cliente só vê o valor final no resumo.

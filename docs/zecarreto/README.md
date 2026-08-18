# ZÉ CARRETO — Fase 1 (fundação)

> Este documento é para o **dono do projeto**, não para programador.
> Ele explica o que foi construído, o que já funciona e o que ainda falta.

---

## O que é o ZÉ CARRETO

Um aplicativo de carreto sob demanda: o cliente pede, a plataforma calcula o
preço, o cliente paga, um motorista aceita, retira a carga, entrega, e o
dinheiro cai na carteira do motorista para ser repassado toda semana.

A ideia é a mesma do Uber/99, mas só para **transporte de carga, pequenas
entregas e mudanças**.

## O que esta fase entrega (e o que NÃO entrega)

**Entrega:** a fundação — o banco de dados, as regras de negócio, as
permissões e as portas de entrada (as "APIs") que as telas vão usar.

**Não entrega:** telas. Nesta fase não existe nenhum aplicativo para o
cliente ou o motorista abrir. É de propósito: primeiro a estrutura, depois
a fachada. Como construir a casa antes de escolher a cor da parede.

---

## Onde isso vive

O ZÉ CARRETO foi construído **dentro do mesmo projeto** do SiteCreatorFly,
mas com todas as tabelas do banco marcadas com o prefixo `zc_`.

É como abrir uma segunda gaveta no mesmo armário: nada do sistema de
restaurantes foi tocado, e é impossível confundir uma coisa com a outra.
Nenhuma tabela, tela ou regra do SiteCreatorFly foi alterada nesta fase.

---

## As regras que já estão valendo

### O preço

Nenhum valor está escrito no sistema. Tudo vem de uma **tabela de tarifas**
que o administrador edita. Cada categoria de veículo tem a sua:

| O que é cobrado | Exemplo (categoria Médio) |
|---|---|
| Bandeirada (valor de saída) | R$ 35,00 |
| Por quilômetro | R$ 3,20 |
| Por minuto de viagem | R$ 0,60 |
| Tarifa mínima (piso) | R$ 50,00 |
| Parada extra | R$ 12,00 |
| Ajudante | R$ 45,00 |
| Comissão da plataforma | 20% |

A conta é feita nesta ordem:

1. soma bandeirada + distância + tempo + paradas extras + ajudantes;
2. se der menos que a tarifa mínima, cobra a mínima;
3. **só então** aplica o acréscimo do carreto imediato (+35%).

Ou seja: o imediato encarece a tarifa normal, exatamente como combinado.
Um carreto agendado de R$ 85,00 sai por R$ 114,75 se for imediato.

### As categorias que já nascem cadastradas

- **Pequeno porte** — Saveiro, Strada, Montana e similares
- **Médio porte** — Fiorino, Kangoo, Partner e similares
- **Bongo / HR**
- **Caminhão** — VUC, 3/4, Toco e similares

Todas editáveis: dá para mudar nome, exemplos, peso máximo e ordem de
exibição, e criar novas categorias sem programador.

### A esteira do carreto

Todo carreto anda por etapas, sempre na mesma ordem:

```
rascunho → aguardando pagamento → procurando motorista → motorista designado
   → indo até a retirada → motorista no local → carregando
   → em transporte → descarregando → concluído
```

Cancelar é possível em qualquer ponto **antes** de concluído.

A trava mais importante: **não dá para pular etapa**. Se alguém tentar
marcar "em transporte" numa corrida que ainda está procurando motorista, o
sistema recusa. É como o cartão de ponto que não aceita a saída sem a
entrada.

E cada passo fica registrado com quem fez e a que horas — se um cliente
reclamar amanhã, dá para reconstruir a corrida inteira.

### Quem aceita a corrida

A oferta é enviada a vários motoristas ao mesmo tempo (por padrão, 5 dos
mais próximos, com 45 segundos para responder). Se ninguém aceitar, o raio
aumenta e uma nova rodada é chamada.

**Quem aceitar primeiro leva.** Quando dois motoristas apertam "aceitar" no
mesmo segundo, o banco tranca a corrida enquanto decide e o segundo recebe
a mensagem "outro motorista aceitou primeiro". Nunca acontece de dois
motoristas irem ao mesmo endereço.

### O dinheiro

A carteira do motorista funciona como **caderno de caixa**: cada valor
entra como uma linha nova, e linha lançada **não é apagada nem editada**. Se
algo precisa ser desfeito, entra um estorno na linha de baixo. Isso vale
inclusive para o próprio sistema — nem um erro de programação consegue
"sumir" com um lançamento.

Como fica o extrato de uma corrida de R$ 100,00 com comissão de 20%:

| Lançamento | Valor |
|---|---|
| Carreto ZC-A1B2C3D | + R$ 100,00 |
| Comissão do carreto ZC-A1B2C3D | − R$ 20,00 |
| **Saldo do motorista** | **R$ 80,00** |

Quando o pagamento é **em dinheiro na mão**, é o contrário: o motorista já
recebeu do cliente, então só a comissão entra como dívida dele.

O dinheiro fica 7 dias "maturando" antes de virar saldo disponível (prazo
configurável). Toda semana o sistema fecha a conta e gera **um** repasse
por motorista — fechar a mesma semana duas vezes não paga em dobro.

### Quem pode o quê

Três perfis, com portas separadas:

- **Cliente** — pede carreto, paga, acompanha, cancela, avalia.
- **Motorista** — recebe ofertas, aceita, marca as etapas, vê a carteira.
- **Administrador** — aprova motoristas, muda preços e configurações,
  fecha repasses, vê tudo.

Duas travas importantes:

1. **O motorista não se aprova sozinho.** Ele envia documentos e espera; só
   o administrador aprova. É como o crachá da empresa: quem usa não é quem
   emite.
2. **Cada um só enxerga o que é seu.** A trava está no banco, não só na
   tela — mesmo que alguém tente falar direto com o banco por fora do
   aplicativo, não consegue ver a corrida de outra pessoa.

---

## O que você precisa fazer do seu lado

1. **Rodar as migrações no Supabase.** São os 4 arquivos em
   `supabase/migrations/` que começam com `20260818`. Eles criam as tabelas
   novas. Nenhum toca em tabela do SiteCreatorFly.

2. **Criar o primeiro administrador.** Depois que a pessoa criar a conta,
   é preciso dar o papel de admin a ela, com este comando no Supabase:

   ```sql
   insert into public.zc_user_roles (user_id, role)
   values ('<id-do-usuario>', 'admin');
   ```

3. **Conferir os preços iniciais.** As tarifas nascem com valores de
   exemplo (a tabela lá em cima). Ajuste antes de abrir para clientes.

4. **Ligar o tempo real no Supabase.** No painel, em *Database →
   Replication*, as tabelas `zc_rides`, `zc_ride_offers`,
   `zc_driver_locations`, `zc_notifications` e `zc_ride_stops` já são
   adicionadas pela migração; só confira se a publicação está ativa.

5. **(Quando for cobrar de verdade) contratar o meio de pagamento.** Hoje o
   sistema registra o pagamento, mas não conversa com banco nenhum — quem
   confirma é o administrador. Ver "o que fica para a FASE 2".

---

## O que fica para a FASE 2 (e além)

Coisas que **ainda não existem** e precisam entrar:

- **As telas.** Aplicativo do cliente, aplicativo do motorista e painel do
  administrador. Nada disso foi feito nesta fase.
- **Pagamento de verdade.** Pix automático e cartão. Hoje existe só o
  "provedor manual": a cobrança é registrada e alguém confirma na mão. O
  lugar de plugar o provedor já está pronto e isolado.
- **Mapa e rota de verdade.** Hoje a distância é calculada em linha reta
  com um acréscimo de 30% (rua não é régua). Com um serviço de mapas, a
  estimativa fica exata. O lugar de plugar também já está pronto.
- **As rodadas de busca rodando sozinhas.** Hoje a próxima rodada de
  ofertas precisa ser acionada; falta a tarefa automática que roda de
  minuto em minuto.
- **O repasse saindo sozinho.** O fechamento semanal já existe, mas é
  acionado pelo administrador. Falta agendar e falta a transferência
  bancária automática.
- **Avisos no celular.** As notificações são gravadas e aparecem no app,
  mas ainda não saem como push, SMS ou WhatsApp.
- **Envio de foto e documento.** Falta o lugar de armazenamento dos
  arquivos (o sistema já guarda o endereço do arquivo, mas não o arquivo).

---

## Para quem for mexer no código

```
src/lib/zecarreto/
  domain/      regras puras: preço, esteira de status, dinheiro, distância
  db/          tipos das tabelas e conexão com o banco
  http/        crachá (quem é o usuário), respostas e casca dos endpoints
  services/    as regras de negócio, um arquivo por assunto
  realtime.ts  canais de tempo real (pode rodar no navegador)
  __tests__/   testes das regras puras

src/routes/api/zecarreto/    as portas de entrada (endpoints)
supabase/migrations/2026081812*  as tabelas
supabase/tests/zecarreto_smoke.sql  teste do banco de ponta a ponta
```

Comandos:

```bash
bun run test        # testes das regras (preço, esteira, validação)
bun run typecheck   # confere os tipos
bun run build       # build do projeto inteiro
```

Para rodar o teste do banco é preciso um Postgres com o ambiente do
Supabase (papéis `anon`/`authenticated`, esquema `auth` e a função
`auth.uid()`), ou uma branch do Supabase:

```bash
psql -v ON_ERROR_STOP=1 -f supabase/tests/zecarreto_smoke.sql
```

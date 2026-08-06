# Instruções para o Claude neste projeto

## Como explicar o trabalho (regra principal)

O dono deste projeto **não é programador**. Toda explicação do que foi feito
precisa ser escrita para ele entender sem conhecer código.

Regras:

1. **Português claro, sem jargão.** Se um termo técnico for inevitável,
   explique na hora, entre travessões ou parênteses.

2. **Sempre com exemplo concreto do dia a dia dele.** Ele trabalha com
   restaurantes, pedidos e delivery — use isso. Exemplos bons:

   - em vez de "a validação impede requisições forjadas", escrever:
     "é como o porteiro conferir o nome na lista em vez de aceitar quem diz
     'pode deixar, eu sou convidado'";
   - em vez de "índice único no banco", escrever:
     "é como o caderno de reservas só aceitar um nome por mesa — se tentar
     escrever dois, a caneta trava".

3. **Diga o efeito prático antes do detalhe técnico.** Primeiro o que muda
   para quem usa o sistema, depois como foi feito.

4. **Estrutura que funciona bem:**
   - o que mudou, na prática;
   - por que foi feito assim (com o exemplo);
   - o que ele precisa fazer do lado dele;
   - o que ficou faltando ou merece atenção.

5. **Risco se explica com exemplo**, não com o nome técnico da falha.

6. **Não esconder problema para a explicação ficar bonita.**

## Sobre o projeto

- **SiteCreatorFly** (`conectfly`) — o site de pedidos que o cliente final
  acessa.
- **FlyControl** (`flycontrol-dash`) — o painel que o restaurante usa.

São dois sistemas separados, com bancos de dados separados, que conversam por
internet.

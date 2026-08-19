# ZÉ CARRETO — Fase 2: cadastros

> Para o dono do projeto. O que foi pedido, o que ficou pronto, o que foi
> verificado e o que ainda falta.

---

## O que mudou, na prática

Antes: existia a fundação (banco e regras), mas **nenhuma tela**. Ninguém
conseguia criar conta.

Agora: existe o caminho completo de entrada. Uma pessoa entra em
`/zecarreto`, cria a conta, preenche os dados e — se quiser trabalhar —
cadastra o veículo e manda para análise. O administrador aprova ou recusa
**dizendo o motivo**, e só então o carreteiro consegue ficar online.

### As telas criadas

| Endereço | Para quem | O que faz |
|---|---|---|
| `/zecarreto/entrar` | todos | Criar conta, entrar, recuperar senha, login social |
| `/zecarreto` | todos | Escolhe: sou cliente, sou carreteiro, ou admin |
| `/zecarreto/conta` | cliente | Nome, telefone, e-mail, CPF, foto e termos |
| `/zecarreto/enderecos` | cliente | Endereços favoritos (Casa, Depósito, Loja) |
| `/zecarreto/motorista` | carreteiro | Cadastro, CNH, PIX, documentos e o botão de ficar online |
| `/zecarreto/motorista/veiculos` | carreteiro | Meus veículos — vários por motorista |
| `/zecarreto/admin` | administrador | Aprovar/recusar motoristas, veículos e documentos |

A tela do cliente é curta de propósito: **cinco campos e o aceite**. Nada
mais é pedido de quem só quer chamar um carreto.

---

## As travas que passaram a existir

### O carreteiro não fica online sozinho

Para o botão **FICAR ONLINE** funcionar, precisam valer as duas coisas ao
mesmo tempo:

1. o cadastro dele estar **aprovado**; e
2. ter **pelo menos um veículo aprovado**.

É como o táxi: não basta o motorista ter a carteira, o carro também
precisa estar vistoriado. Se o administrador reprovar o único veículo de
alguém que estava no ar, o sistema **tira essa pessoa do ar na hora**.

Essa regra está no banco, não só no botão. Mesmo que amanhã alguém escreva
um programa novo que esqueça de conferir, o banco recusa.

### Recusar sem motivo não é permitido

Em motorista, veículo e documento, a recusa **exige** o motivo escrito. Sem
isso o sistema não deixa concluir. Recusar sem explicar só faz a pessoa
reenviar o mesmo problema e ligar para o suporte.

### Dados sensíveis aparecem mascarados

CPF, telefone, e-mail, CNH e chave PIX **nunca aparecem inteiros** para
quem não é o dono. Na tela do administrador aparece `***.982.247-**`.

Se o administrador precisar mesmo conferir o número completo, existe a
opção de revelar — e aí fica registrado **quem abriu, quando e por quê**. É
a diferença entre consultar e bisbilhotar.

### Todo mundo tem histórico

Cada campo alterado vira uma linha: o que era, o que virou, quem mudou e
quando. Dado sensível entra no histórico **já mascarado** — o histórico
serve para saber que o CPF mudou, não para virar uma segunda cópia do CPF
de todo mundo.

### Os arquivos ficam em dois armários

- **`zc-avatars`** — foto de perfil e fotos do veículo. Podem ser vistas.
- **`zc-documents`** — CNH, selfie, comprovantes. **Trancado**: só o dono e
  o administrador abrem, e sempre por um link que vence em 5 minutos.

O arquivo **não passa pelo nosso servidor**: o aplicativo pede uma
autorização de entrega e manda direto para o armazenamento. Cada pessoa só
consegue escrever dentro da própria pasta — como o escaninho do vestiário,
cada um abre o seu.

---

## O que foi verificado (de verdade)

| Verificação | Resultado |
|---|---|
| 5 migrações aplicadas do zero | passam, e reaplicar não quebra nem duplica |
| Teste de banco da Fase 1 (fluxo do carreto) | continua passando |
| Teste de banco da Fase 2 (cadastros) | todos os cenários passaram |
| 67 testes de regras (preço, esteira, máscara, checklist) | 67 passam |
| Tipos (`typecheck`), `lint` e `build` | limpos |

Cenários testados no banco, um a um:

- motorista novo nasce como `pending`;
- motorista sem aprovação **não** fica online;
- motorista aprovado **sem veículo aprovado** também não;
- veículo aprovado libera; veículo reprovado **derruba do ar** e solta o
  "veículo em uso";
- alteração de telefone entra no histórico **mascarada** (só os 4 finais);
- motivo da recusa fica registrado;
- aceite dos termos não duplica na mesma versão, e versão nova exige novo
  aceite sem apagar o anterior;
- o armário de documentos está mesmo privado.

---

## Conferência do que foi pedido

| Pedido | Situação |
|---|---|
| Cliente: nome, telefone, e-mail, CPF, foto opcional | pronto |
| Cliente: endereços favoritos | pronto |
| Cliente: aceite dos termos | pronto, com versão e data |
| Cliente: recuperação de conta | pronto (link por e-mail) |
| Login social Google/Apple preparado | pronto — botões aparecem quando ligados |
| Motorista: nome, CPF, telefone, e-mail, foto | pronto |
| Motorista: selfie/verificação | pronto (envio da selfie + análise) |
| Motorista: CNH e validade | pronto, com CNH vencida bloqueando |
| Motorista: dados bancários/PIX | pronto |
| Motorista: aceite dos termos | pronto |
| Veículo: categoria, marca, modelo, ano, placa, capacidade, fotos, documento, observações | pronto |
| Status do motorista (5 estados) | pronto |
| Status do veículo (4 estados) | pronto |
| Online só com cadastro e veículo aprovados | pronto (trava no banco) |
| Área "Meus veículos", vários por motorista | pronto |
| Interface do cliente extremamente simples | pronto |
| Botão OFFLINE / FICAR ONLINE | pronto |
| Upload seguro | pronto (link temporário, pasta por pessoa) |
| Validações | pronto (CPF, CNPJ, placa, CNH, telefone, idade mínima) |
| Permissões | pronto (cada perfil só o que é dele) |
| Mascaramento de dados sensíveis | pronto |
| Histórico de alterações | pronto |
| Admin aprova/reprova motorista, documentos e veículos com motivo | pronto |
| Pagamento | **não implementado**, como pedido |

---

## O que você precisa fazer do seu lado

1. **Rodar a migração nova** (`20260819100000_zecarreto_onboarding.sql`).
   Ela renomeia o status `pending_documents` para `pending` — os cadastros
   existentes são preservados, é só a troca da etiqueta.

2. **Conferir os dois armários de arquivo** no Supabase (Storage): devem
   aparecer `zc-avatars` (público) e `zc-documents` (privado). A migração
   cria os dois.

3. **Ligar o login social, se quiser.** Duas coisas precisam acontecer:
   - ligar Google/Apple no painel do Supabase (Authentication → Providers);
   - colocar `["google","apple"]` na configuração `auth.social_providers`.

   Só a configuração não liga nada — ela apenas mostra o botão.

4. **Publicar os termos de uso** no endereço da configuração `terms.url`.
   Hoje aponta para `zecarreto.com.br/termos`, que ainda não existe.

5. **Conferir o e-mail de recuperação de senha** no Supabase (Authentication
   → Emails). O texto padrão vem em inglês.

---

## O que fica para a FASE 3

- **Pedir o carreto pela tela** — o cliente ainda não tem a tela de pedido
  (endereços, categoria, preço, confirmação).
- **Pagamento** — foi deixado de fora desta fase, como combinado.
- **Verificação de selfie automática** — hoje quem confere se a selfie é a
  pessoa da CNH é o administrador, olhando.
- **Confirmação de telefone por SMS** — o telefone é digitado e aceito sem
  código de confirmação.
- **Consulta automática de CEP** — o endereço é digitado inteiro à mão.
- **Aviso de CNH perto de vencer** — o sistema já sabe a validade, mas
  ainda não avisa antes.

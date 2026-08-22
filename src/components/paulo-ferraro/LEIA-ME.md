# Site do advogado Paulo Ferraro — FASES 1 e 2 concluídas

Este é o guia prático da pasta. Está escrito para ser entendido **sem saber
programar**.

---

## 1. Onde o site fica no ar

Endereço: **/paulo-ferraro**

Ele mora dentro do mesmo projeto do SiteCreatorFly, mas é totalmente
independente: cores, fontes e estilos do advogado só valem dentro da página
dele. É como dois apartamentos no mesmo prédio — mesma estrutura, instalações
separadas. Mexer num não estraga o outro.

---

## 2. Como colocar a fotografia

Salve o arquivo dentro da pasta `src/assets/` com um destes nomes exatos:

| Arquivo                              | Onde aparece                | Formato ideal                        |
| ------------------------------------ | --------------------------- | ------------------------------------ |
| `src/assets/paulo-ferraro-hero.png`  | fotografia principal (topo) | PNG recortado, fundo transparente    |
| `src/assets/paulo-ferraro-sobre.jpg` | seção "Sobre"               | JPG ou PNG, retrato em pé (vertical) |

**Nada mais precisa ser feito.** O site encontra o arquivo sozinho e passa a
exibi-lo. Enquanto ele não estiver lá, aparece uma moldura tracejada dizendo
qual arquivo falta e onde salvá-lo.

A fotografia é usada **exatamente como você enviou** — sem corte no rosto, sem
filtro, sem redesenho, sem troca por imagem gerada por computador.

---

## 3. Onde mudar os textos

Todos os textos do site estão em **um único arquivo**:

```
src/components/paulo-ferraro/content.ts
```

Nada de texto escondido no meio do código. Quer trocar uma frase da seção
"Sobre"? Está lá, escrita por extenso.

---

## 4. As etiquetas douradas "A preencher"

Onde uma informação ainda não foi enviada — telefone, WhatsApp, e-mail,
endereço, número da OAB, horário de atendimento, links de Política de
Privacidade e Termos — o site mostra uma **etiqueta dourada tracejada** no
lugar.

É de propósito, e funciona como o post-it colado na linha em branco do
formulário: o site já está montado no tamanho certo, ninguém confunde o espaço
vazio com informação verdadeira, e é impossível publicar sem notar o que falta.

Nesses casos o botão **não vira link**. Um botão de WhatsApp sem número seria
como a placa "entrada" apontando para a parede.

Para preencher, procure a palavra `PENDENTE` no arquivo `content.ts` e troque
pelo valor real. Exemplo:

```ts
// antes
valor: PENDENTE,
href: PENDENTE,

// depois
valor: "(71) 90000-0000",
href: "https://wa.me/5571900000000",
```

O que ainda está pendente hoje:

- número da OAB;
- WhatsApp (número e link);
- telefone;
- e-mail;
- endereço / localização;
- horário de atendimento;
- link da Política de Privacidade;
- link dos Termos de Uso;
- as duas fotografias.

O Instagram (`@ferrarooadv`) já está preenchido e funcionando.

---

## 5. Como a pasta está organizada

```
paulo-ferraro/
├── PauloFerraroSite.tsx     ← a ordem das seções na página
├── content.ts               ← TODOS os textos e dados de contato
├── theme.css                ← todas as cores, fontes e espaçamentos
├── assets.ts                ← encontra as fotografias na pasta src/assets
├── navigation.ts            ← rolagem suave entre as seções
├── layout/                  ← cabeçalho, rodapé e a assinatura do nome
├── primitives/              ← peças reutilizadas (botão, cartão, título...)
├── sections/                ← cada bloco do site, um arquivo por bloco
└── hooks/                   ← comportamentos (ex.: detectar a rolagem)
```

Cada seção mora no seu próprio arquivo. Mexer no "Direito Médico" não corre
risco de estragar o "Contato".

---

## 6. Regras de conteúdo respeitadas

O texto do site segue as normas de publicidade da advocacia:

- não promete resultado nem fala em "causa ganha";
- não inventa número de processos, prêmios, títulos ou depoimentos;
- não compara Paulo Ferraro com outros profissionais;
- não usa linguagem de venda agressiva;
- deixa explícito que o primeiro contato não é contratação;
- traz no rodapé o aviso de que o site é informativo.

Só foram usadas as informações efetivamente fornecidas: 7 anos de atuação,
Direito Médico como área de destaque, as cinco frentes do Direito Médico, as
cinco outras áreas, a atuação na JARI / SEMOB e o perfil `@ferrarooadv`.

---

## 7. As animações (FASE 2)

**A abertura.** Quando a página carrega, ela se monta como a abertura de um
filme: primeiro a luz da sala (o fundo), depois o halo atrás da silhueta, então
o arco, e aí o advogado é revelado de baixo para cima por uma máscara que sobe
— enquanto a imagem se assenta e o desfoque inicial se dissolve, como uma lente
encontrando o foco. Por último entram os letreiros, um a cada 0,085 segundo.

Tudo acaba em cerca de 1,5 segundo. É rápido de propósito: animação longa em
site institucional cansa mais do que impressiona.

**Ao rolar.** Cada bloco entra quando chega na tela, e não todos do mesmo jeito:
títulos emergem de baixo como letra saindo do papel, fotografias aparecem por
trás de uma máscara, fios se estendem da esquerda para a direita, cartões
crescem de leve. A variedade é proposital — se tudo se movesse igual, o site
viraria uma demonstração de animações em vez de um escritório de advocacia.

**Parallax.** As camadas de fundo do topo andam alguns pixels mais devagar que
a página, como a montanha vista do carro. É sutil de propósito: se você notar
o efeito, ele está exagerado.

**Ao passar o mouse ou tocar.** Botões sobem 2 pixels e ganham brilho discreto,
setas avançam um passo, cartões se elevam e ganham contorno, o item do menu da
seção que você está lendo fica aceso. Nada pisca, nada brilha como letreiro.

**Quem não quer movimento.** Se o celular ou o computador estiver configurado
para reduzir animações (recurso de acessibilidade do sistema), o site não anima
nada: mostra tudo pronto, parado e completo. Nenhum conteúdo fica escondido
esperando um movimento que não vai acontecer.

**Onde mexer.** Velocidade e curvas ficam em `theme.css`, nas variáveis
`--pf-dur`, `--pf-ease-out` e `--pf-stagger`. Mudar a velocidade do site
inteiro é trocar um número em um lugar só.

---

## 8. Botão flutuante de contato

Aparece no celular depois que a pessoa passa da primeira tela e fica quieto no
canto — não pisca, não pula, não abre janela nenhuma. No computador ele nem
aparece, porque o cabeçalho já mostra o botão o tempo todo.

Enquanto o número do WhatsApp não for informado, ele leva para a seção de
contato. Assim que o número entrar em `content.ts`, o mesmo botão passa a abrir
o WhatsApp direto, sem mexer em mais nada.

---

## 9. O que vem na FASE 3/3

Auditoria final, refinamento, SEO, performance e entrega. Não foi iniciada.

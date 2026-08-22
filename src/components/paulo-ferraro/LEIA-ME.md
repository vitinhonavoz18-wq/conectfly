# Site do advogado Paulo Ferraro — projeto concluído (fases 1, 2 e 3)

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

**Sobre o peso das fotos.** A fotografia principal veio com 1,9 MB. Em conexão
de celular isso é a diferença entre a foto aparecer na hora e a pessoa olhar
para um espaço vazio por alguns segundos — e é justamente a primeira coisa que
ela vê. Por isso o site guarda também uma versão leve (`.webp`, 271 KB) e é
essa que vai para o visitante. Mesma foto, mesmo rosto, mesmo enquadramento:
muda só a forma de guardar, como uma mala bem arrumada que leva a mesma roupa
em menos espaço.

O PNG original **continua na pasta**, intocado — é a matriz de onde sai
qualquer versão futura, como o negativo que fica no arquivo enquanto a cópia
vai para a moldura. Se enviar uma foto nova, salve o PNG normalmente e me avise
para eu gerar a versão leve.

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

## 9. Google, WhatsApp e redes sociais (FASE 3)

**O que o Google vê.** Título, descrição, idioma português do Brasil e uma
"ficha catalográfica" invisível (dados estruturados) dizendo quem é o
profissional, o que ele faz e em que cidade atua. É o mesmo texto da página,
escrito para máquina — o que permite ao Google mostrar um resultado rico em vez
de um link seco.

**Nada inventado, nem para o Google.** Telefone, e-mail, endereço e OAB só
entram nessa ficha depois de preenchidos de verdade em `content.ts`. Declarar
dado falso para buscador é pior do que não declarar: o Google cruza com outras
fontes e penaliza quando não bate.

**O endereço do site.** Enquanto o domínio não for definido, o site não anuncia
"endereço oficial" nem imagem de compartilhamento. Apontar para um endereço
errado é pior do que não apontar para nenhum. Assim que o domínio existir, basta
preencher `seo.dominio` em `content.ts` — o endereço oficial, o link de
compartilhamento e a ficha do Google se ajustam sozinhos.

**Uma limpeza importante.** A base do sistema (SiteCreatorFly) anunciava uma
imagem de compartilhamento própria. Sem correção, mandar o link do advogado no
WhatsApp mostraria a captura de tela de outro produto — como emprestar o cartão
de visita do vizinho. Agora, enquanto a imagem definitiva não chega, o link
aparece limpo: só título e descrição.

**Para a imagem de compartilhamento aparecer**, salve um arquivo de 1200x630 px
em `src/assets/paulo-ferraro-og.jpg`.

---

## 10. Acessibilidade e desempenho (FASE 3)

**Contraste.** Todos os textos do site foram medidos um a um contra o fundo em
que aparecem. Sete tons reprovavam na norma de acessibilidade (o mínimo é 4,5
vezes de diferença entre texto e fundo) e foram corrigidos. Hoje: zero
reprovações. Isso vale para quem lê no sol, no celular com brilho baixo ou
enxerga menos.

**Teclado.** Dá para navegar o site inteiro sem mouse. O primeiro Tab oferece
"Ir para o conteúdo", o menu do celular prende o foco enquanto está aberto, Esc
fecha, e o foco volta para o botão que abriu.

**Fontes no próprio site.** Antes vinham do servidor do Google — quatro idas e
vindas antes da primeira palavra aparecer. Agora moram junto com o site, e das
13 variações que eram baixadas o site usa 3. O site não conversa com nenhum
servidor externo.

**Velocidade medida em celular intermediário** (com o processador propositalmente
4x mais lento): a maior imagem da tela aparece em cerca de 1 segundo, e o layout
não "pula" enquanto carrega.

---

## 11. A cor da marca: bronze

O site usa o **bronze da logo oficial**. Os tons não foram escolhidos a olho: o
monograma PF da logo foi lido pixel a pixel, e a escala do site é exatamente a
que a logo usa — do escuro da sombra ao brilho do topo do relevo.

| Onde                       | Tom         | Código de tinta |
| -------------------------- | ----------- | --------------- |
| sombra, brilhos de fundo   | mais escuro | `#5f2f0b`       |
| bronze como texto no claro | escuro      | `#8a5a22`       |
| botão nas seções claras    | médio       | `#b97b44`       |
| **a cor da marca**         | **bronze**  | **`#d79c57`**   |
| destaque, foco do teclado  | brilho      | `#efb66c`       |

**Por que o tom muda conforme o fundo.** O mesmo bronze que brilha no preto
some no off-white — como caneta amarela que se lê no papel escuro e desaparece
no branco. Por isso cada superfície tem seu tom: no preto o bronze da marca
(6,95 vezes de diferença para o fundo), no off-white o bronze escuro (5,36
vezes). Ambos acima do mínimo da norma de acessibilidade.

**O botão nas seções claras usa o tom médio**, não o da marca: o bronze claro
sobre papel dá só 2,18 — a borda do botão sumiria contra a página.

**O dourado antigo foi absorvido.** Antes existiam duas cores quentes (bordô e
dourado) que faziam papéis parecidos. Agora é uma família só, usada em
claridades diferentes: fios finos, ícones, números, botões. Uma cor bem usada
soa mais cara do que duas se acotovelando.

Mudar tudo é mexer em cinco linhas de `theme.css`, no bloco **BRONZE**.

---

## 11. Sobre a palavra "especialista"

O material enviado dizia "Especialista em Direito Médico". Na publicidade da
advocacia essa palavra tem sentido específico: o Provimento nº 205/2021 da OAB
permite anunciar as **áreas de atuação** livremente, mas reserva o título de
especialista a quem tem a titulação (pós-graduação ou certificação reconhecida).

É como um restaurante: dizer "fazemos massa italiana" é sempre permitido; dizer
"chef formado na Itália" só vale com o diploma na parede.

Por isso o site usa **"Atuação principal em Direito Médico"** — a forma que vale
em qualquer caso, sem perder o destaque. Se o Dr. Paulo tiver a titulação, basta
trocar uma linha (`hero.rotuloDestaque`, em `content.ts`) e o texto original
volta.

---

## 12. O que ainda depende do cliente

- ~~fotografia principal~~ — recebida e no ar;
- fotografia da seção Sobre (`src/assets/paulo-ferraro-sobre.jpg`);
- imagem de compartilhamento 1200x630 (`src/assets/paulo-ferraro-og.jpg`);
- número da OAB;
- WhatsApp, telefone e e-mail;
- endereço e horário de atendimento;
- domínio definitivo;
- links de Política de Privacidade e Termos de Uso.

Tudo isso está marcado no site com a etiqueta dourada "A preencher" e reunido
em um arquivo só: `content.ts`.

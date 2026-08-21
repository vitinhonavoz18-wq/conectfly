# Site do advogado Paulo Ferraro — FASE 1/3

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

## 7. O que vem na FASE 2/3

A estrutura já está preparada, mas **ainda não animada**. Cada bloco que vai
se mover carrega uma marca invisível no HTML (`data-pf-reveal`) dizendo qual
movimento receberá e em que ordem. É como numerar as caixas antes da mudança:
nada se move ainda, mas quando o caminhão chegar já se sabe o que entra
primeiro.

O mesmo vale para a fotografia do Hero: halo de luz, arco, grade e retrato são
camadas separadas e empilhadas, cada uma com sua marca
(`data-pf-hero-layer`). Assim dá para mover cada uma numa velocidade diferente
sem encostar em uma linha de texto.

Os tempos e as curvas de movimento já estão definidos em `theme.css`
(`--pf-dur`, `--pf-ease-out`, `--pf-stagger`). Mudar a velocidade de todo o
site será questão de trocar um número em um lugar só.

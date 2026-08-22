# Fotografias originais

Esta pasta guarda os arquivos **como o cliente enviou**, no tamanho e na
qualidade máxima. Nada aqui é publicado no site.

É o negativo da foto: fica no arquivo, e a cópia é que vai para a moldura.

## Por que separado

O site entrega ao visitante a versão leve (`.webp`), gerada a partir destes
arquivos. A fotografia principal, por exemplo, tem 1,9 MB em PNG e 271 KB em
WebP — mesma imagem, mesmo rosto, mesmo enquadramento.

Se o original ficasse na pasta de entrega, ele seria copiado para o servidor a
cada publicação sem nunca ser baixado por ninguém: peso morto em toda subida do
site.

## O que está guardado aqui

- `paulo-ferraro-hero.png` — fotografia principal (1,9 MB)
- `paulo-ferraro-sobre.png` — segunda fotografia, a de terno preto (1,2 MB)
- `paulo-ferraro-logo.png` — logo oficial, como veio (606 KB)
- `paulo-ferraro-logo-completa.webp` — a mesma logo, leve e com a margem vazia
  recortada, **com** a linha "Advocacia e Consultoria Jurídica" (175 KB)

Da logo saíram quatro coisas:

1. a **paleta de bronze** do site inteiro, lida pixel a pixel no monograma;
2. a **assinatura usada no site** (`src/assets/paulo-ferraro-logo.webp`, 38 KB):
   monograma + barra + "PAULO FERRARO", sem a linha miúda de baixo — que, no
   tamanho do cabeçalho, ficaria com 5 pixels de altura e viraria uma mancha.
   Essa frase não sumiu: virou texto de verdade no rodapé;
3. o **ícone da aba do navegador** (`paulo-ferraro-icone.png`), que é o
   monograma PF sobre o grafite do site;
4. o **ícone de tela de início do celular** (`paulo-ferraro-icone-apple.png`).

O arquivo `paulo-ferraro-logo-completa.webp` é a versão para usar **fora** do
site: cartão de visita, papel timbrado, foto de perfil de rede social,
assinatura de e-mail. Ali sobra espaço e a linha de baixo se lê.

## Ao enviar uma foto nova

1. salve o arquivo original em `src/assets/` com o nome de sempre
   (`paulo-ferraro-hero.png`, `paulo-ferraro-sobre.png`);
2. avise, para a versão leve ser gerada e o original ser movido para cá.

Enquanto a versão leve não existir, o site usa o original mesmo — ninguém fica
sem foto. Só fica mais pesado.

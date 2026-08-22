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
- `paulo-ferraro-logo.png` — logo oficial (606 KB)

Da logo saíram duas coisas: a versão leve para uso no site
(`src/assets/paulo-ferraro-logo.webp`, 175 KB, com a margem vazia recortada) e
a paleta de bronze do site inteiro, lida diretamente dos pixels do monograma.

## Ao enviar uma foto nova

1. salve o arquivo original em `src/assets/` com o nome de sempre
   (`paulo-ferraro-hero.png`, `paulo-ferraro-sobre.jpg`);
2. avise, para a versão leve ser gerada e o original ser movido para cá.

Enquanto a versão leve não existir, o site usa o original mesmo — ninguém fica
sem foto. Só fica mais pesado.

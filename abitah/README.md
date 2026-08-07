# ABITAH — Loja virtual oficial

Loja virtual completa para academia de treino livre com marca própria de roupas e
acessórios esportivos. Construída com **Next.js (App Router) + TypeScript +
Tailwind CSS + Supabase**, pronta para implantação na Vercel.

> **Modo demonstração:** sem as variáveis do Supabase configuradas, a loja roda
> normalmente com um catálogo fictício local (20 produtos). Nenhuma página quebra
> e uma faixa no topo avisa que o modo demonstração está ativo.

---

## Índice

1. [Como iniciar o projeto](#1-como-iniciar-o-projeto)
2. [Configurar o Supabase](#2-configurar-o-supabase)
3. [Cadastrar o primeiro administrador](#3-cadastrar-o-primeiro-administrador)
4. [Trocar a logo](#4-trocar-a-logo)
5. [Adicionar imagens aos produtos](#5-adicionar-imagens-aos-produtos)
6. [Alterar preços](#6-alterar-preços)
7. [Configurar o WhatsApp](#7-configurar-o-whatsapp)
8. [Variáveis de ambiente](#8-variáveis-de-ambiente)
9. [Estrutura do projeto](#9-estrutura-do-projeto)
10. [Páginas disponíveis](#10-páginas-disponíveis)
11. [Implantação na Vercel](#11-implantação-na-vercel)
12. [Próximos passos (pagamento online)](#12-próximos-passos-pagamento-online)

---

## 1. Como iniciar o projeto

Requisitos: **Node.js 20 ou superior**.

```bash
cd abitah
npm install
cp .env.example .env.local   # opcional no início — a loja roda sem isso
npm run dev
```

Acesse http://localhost:3000.

Scripts disponíveis:

| Comando             | O que faz                                        |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Ambiente de desenvolvimento                      |
| `npm run build`     | Build de produção                                |
| `npm start`         | Sobe o build de produção                         |
| `npm run lint`      | Verificação de código (ESLint)                   |
| `npm run typecheck` | Verificação de tipos (TypeScript)                |

---

## 2. Configurar o Supabase

O Supabase cuida do banco de dados, autenticação e armazenamento das imagens.

### 2.1 Criar o projeto

1. Acesse https://supabase.com e crie um projeto (região **South America (São Paulo)**
   costuma dar a menor latência no Brasil).
2. Vá em **Project Settings → API** e copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2.2 Criar as tabelas

No painel do Supabase, abra **SQL Editor** e execute, nesta ordem:

1. `supabase/schema.sql` — cria todas as tabelas, índices, relacionamentos,
   políticas de segurança (RLS), os gatilhos de perfil e o bucket de imagens.
2. `supabase/seed.sql` — carrega os dados de demonstração (categorias, 20 produtos
   com grade completa, cupons, banners e configurações).

O `seed.sql` é opcional. Se preferir começar com o catálogo vazio, pule esta etapa
e cadastre os produtos direto no painel.

Para remover a demonstração depois:

```sql
delete from public.products where is_demo = true;
```

### 2.3 Preencher o `.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Reinicie o servidor (`npm run dev`). A faixa de "modo demonstração" desaparece
automaticamente e a loja passa a ler o banco.

### 2.4 Tabelas criadas

`profiles`, `categories`, `products`, `product_images`, `product_variants`,
`inventory`, `addresses`, `coupons`, `orders`, `order_items`, `favorites`,
`banners`, `site_settings`, `newsletter_subscribers`, `contact_messages`.

Regras de segurança (RLS) já configuradas:

- Catálogo: leitura pública, escrita apenas para administradores.
- Pedidos: qualquer visitante pode criar (checkout como convidado); o cliente vê
  somente os próprios; o administrador vê e gerencia todos.
- Endereços e favoritos: acessíveis apenas pelo próprio dono.
- Newsletter e contato: qualquer pessoa envia, somente o administrador lê.

---

## 3. Cadastrar o primeiro administrador

1. Acesse `/conta/cadastro` no site e crie uma conta normalmente.
2. Confirme o e-mail (o Supabase envia o link automaticamente).
3. No **SQL Editor** do Supabase, promova essa conta a administrador:

```sql
update public.profiles
set role = 'admin'
where email = 'seu-email@dominio.com';
```

4. Saia e entre de novo no site. O menu da conta passa a exibir
   **Painel administrativo**, e `/admin` fica liberado.

> A rota `/admin` é protegida em duas camadas: middleware no servidor (verifica a
> sessão e o papel antes de renderizar) e as políticas RLS no banco (impedem
> qualquer escrita por quem não é administrador).

---

## 4. Trocar a logo

Os arquivos ficam em `abitah/public/brand/`. **Substitua os arquivos mantendo os
mesmos nomes** — nenhum código precisa ser alterado.

| Arquivo                      | Onde aparece                                     |
| ---------------------------- | ------------------------------------------------ |
| `abitah-logo-horizontal.svg` | Cabeçalho e painel administrativo                |
| `abitah-logo-light.svg`      | Rodapé (versão empilhada, para fundo escuro)     |
| `abitah-logo.svg`            | Versão para fundo claro (e-mails, notas, impressos) |
| `abitah-mark.svg`            | Somente o símbolo                                |

O ícone da aba do navegador (favicon) fica em `src/app/icon.svg`.

Se preferir usar PNG, coloque os arquivos em `public/brand/` e atualize os
caminhos em `src/config/site.ts`:

```ts
logo: {
  horizontal: "/brand/minha-logo.png",
  full: "/brand/minha-logo-empilhada.png",
  onLight: "/brand/minha-logo-fundo-claro.png",
  mark: "/brand/meu-simbolo.png",
},
```

> As logos incluídas são uma reconstrução vetorial da identidade da marca
> (símbolo do trigo com o "B", wordmark ABITAH e a régua verde). Para fidelidade
> total, substitua pelos arquivos originais da marca.

---

## 5. Adicionar imagens aos produtos

### Pelo painel (recomendado)

1. Acesse `/admin/produtos`.
2. Clique no produto (ou em **Novo produto** e salve primeiro).
3. No bloco **Imagens do produto**, clique em **Enviar imagens** — aceita vários
   arquivos de uma vez, até 5 MB cada.
4. Use os controles de cada miniatura para:
   - ⭐ definir a **imagem principal** (a que aparece nos cards);
   - ↑ ↓ **reordenar** a galeria;
   - 🗑 **remover** a imagem.

As imagens vão para o bucket público `product-images` do Supabase Storage, criado
automaticamente pelo `schema.sql`.

Recomendações: proporção **3:4** (ex.: 1200 × 1600 px), fundo neutro, JPG/WebP
com até 300 KB.

Enquanto um produto não tem imagem, a loja mostra um placeholder elegante escrito
"Adicionar imagem" — nada de links externos quebrados.

### Por URL externa

Também é possível inserir a URL diretamente na tabela `product_images`
(colunas `url`, `alt`, `position`, `is_primary`). Se o domínio for externo,
adicione-o em `remotePatterns` no `next.config.ts`.

---

## 6. Alterar preços

**Pelo painel:** `/admin/produtos` → editar produto → bloco **Preços e códigos**.

| Campo                  | Uso                                                            |
| ---------------------- | -------------------------------------------------------------- |
| **Preço**              | Valor cheio do produto                                          |
| **Preço promocional**  | Valor com desconto. Deixe **0** para desativar a promoção       |
| **Custo (opcional)**   | Uso interno, para cálculo de margem. Nunca aparece na loja      |

Quando há preço promocional, a loja exibe automaticamente o preço antigo riscado,
o novo preço, o selo de desconto em % e o parcelamento recalculado.

**Regras de parcelamento** ficam em `src/config/site.ts`:

```ts
commerce: {
  maxInstallments: 6,       // máximo de parcelas exibido
  minInstallmentValue: 20,  // valor mínimo de cada parcela (R$)
  freeShippingThreshold: 299, // frete grátis a partir de (0 desativa)
}
```

**Cupons de desconto:** `/admin/cupons` (percentual ou valor fixo, com pedido mínimo).

---

## 7. Configurar o WhatsApp

O número usado nos botões "Comprar pelo WhatsApp", na finalização do pedido e no
botão flutuante vem de um único lugar.

**Opção A — variável de ambiente (recomendada):**

```bash
# .env.local
NEXT_PUBLIC_WHATSAPP_NUMBER=5511988887777
```

**Opção B — arquivo de configuração:** `src/config/site.ts`

```ts
contact: {
  whatsapp: "5511988887777",       // 55 + DDD + número, apenas dígitos
  whatsappLabel: "(11) 98888-7777", // como aparece na tela
}
```

Formato: **55** (Brasil) + **DDD sem zero** + número, sem espaços, traços ou
parênteses.

O que as mensagens automáticas já incluem:

- **Botão no produto:** nome, tamanho, cor, quantidade, valor e link do produto.
- **Checkout:** código do pedido, dados do cliente, endereço completo, forma de
  entrega, todos os itens com grade e valores, frete, desconto, total e observações.

---

## 8. Variáveis de ambiente

Copie `.env.example` para `.env.local`. **Nunca** versione o `.env.local` nem
coloque chaves privadas no código.

| Variável                        | Obrigatória | Descrição                                            |
| ------------------------------- | ----------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | Recomendada | URL pública (SEO, sitemap, links do WhatsApp)        |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`   | Recomendada | WhatsApp de atendimento (55 + DDD + número)          |
| `NEXT_PUBLIC_CONTACT_EMAIL`     | Opcional    | E-mail de contato exibido no site                    |
| `NEXT_PUBLIC_SUPABASE_URL`      | Sim¹        | URL do projeto Supabase                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim¹        | Chave pública (anon) do Supabase                     |
| `SUPABASE_SERVICE_ROLE_KEY`     | Opcional    | Chave de serviço — **somente servidor**, nunca `NEXT_PUBLIC_` |

¹ Sem elas a loja funciona em modo demonstração.

---

## 9. Estrutura do projeto

```
abitah/
├── public/brand/          Arquivos da logo (troque aqui)
├── supabase/
│   ├── schema.sql         Tabelas, índices, RLS, storage
│   └── seed.sql           Dados de demonstração
└── src/
    ├── app/               Rotas (App Router)
    │   ├── admin/         Painel administrativo protegido
    │   ├── api/           Rotas de API (pedidos, cupom, newsletter, contato)
    │   ├── conta/         Área do cliente
    │   ├── loja/  produto/  carrinho/  checkout/  sobre/  contato/  politicas/
    │   ├── sitemap.ts  robots.ts  icon.svg
    │   └── layout.tsx  page.tsx  globals.css
    ├── components/
    │   ├── account/  admin/  brand/  cart/  checkout/  contact/
    │   ├── home/  layout/  product/  shop/  ui/
    ├── config/            site.ts (config central) · navigation.ts
    ├── data/              Catálogo de demonstração, categorias, políticas
    ├── hooks/             use-local-storage, use-async-data, use-recently-viewed
    ├── lib/               utils, validations (Zod), whatsapp, supabase/
    ├── services/          catalog, admin, mappers, viacep
    ├── store/             Contextos de carrinho, favoritos e autenticação
    └── types/             Tipos de domínio e do banco
```

**Onde mexer para cada coisa:**

| Quero mudar…                       | Arquivo                          |
| ---------------------------------- | -------------------------------- |
| Nome, contatos, endereço, frete    | `src/config/site.ts`             |
| Menu e rodapé                      | `src/config/navigation.ts`       |
| Cores, tipografia, espaçamentos    | `src/app/globals.css` (bloco `@theme`) |
| Textos das políticas               | `src/data/policies.ts`           |
| Catálogo de demonstração           | `src/data/products.ts`           |

---

## 10. Páginas disponíveis

**Loja**

- `/` — home com hero, benefícios, categorias, lançamentos, mais vendidos,
  vitrine de roupas, vitrine de acessórios, banner da comunidade e newsletter
- `/loja` — catálogo com busca, filtros (categoria, tamanho, cor, faixa de preço,
  disponibilidade), ordenação, contagem de resultados e paginação
- `/lancamentos` — vitrine de novidades
- `/produto/[slug]` — galeria, variações, estoque, WhatsApp, tabela de medidas,
  relacionados e vistos recentemente
- `/carrinho` · `/checkout` — cupom, estimativa de frete, consulta de CEP (ViaCEP)
  e finalização pelo WhatsApp
- `/sobre` · `/contato` (com FAQ e mapa) · `/politicas/{privacidade,trocas,entrega,termos}`

**Área do cliente** — `/conta`, `/conta/entrar`, `/conta/cadastro`,
`/conta/recuperar-senha`, `/conta/redefinir-senha`, `/conta/perfil`,
`/conta/enderecos`, `/conta/pedidos`, `/conta/pedidos/[id]`, `/conta/favoritos`

**Administração** — `/admin`, `/admin/produtos` (+ `novo` e `[id]`),
`/admin/categorias`, `/admin/pedidos`, `/admin/cupons`, `/admin/banners`,
`/admin/configuracoes`

---

## 11. Implantação na Vercel

1. Suba o repositório para o GitHub.
2. Na Vercel: **Add New → Project** e importe o repositório.
3. **Importante:** em *Root Directory*, selecione a pasta **`abitah`**.
4. Em *Environment Variables*, cadastre as variáveis da seção 8.
5. **Deploy**. Framework, build e output são detectados automaticamente.
6. Depois do primeiro deploy, atualize `NEXT_PUBLIC_SITE_URL` com o domínio final
   e faça um novo deploy para que sitemap, metadados e links do WhatsApp usem a
   URL correta.

### SEO e desempenho já implementados

Metadata em todas as páginas, Open Graph, dados estruturados (JSON-LD) na página
de produto, `sitemap.xml` e `robots.txt` dinâmicos, URLs amigáveis, imagens
otimizadas com lazy loading, geração estática das páginas de produto, HTML
semântico, navegação por teclado, foco visível, textos alternativos e contraste
adequado sobre fundo escuro.

---

## 12. Próximos passos (pagamento online)

Hoje o pedido é registrado no banco e finalizado pelo WhatsApp. O checkout
**não exibe** formas de pagamento que não estejam funcionando — apenas o que
realmente existe.

Para habilitar um gateway (Mercado Pago, PIX, cartão, PagSeguro ou Stripe):

1. Adicione o método em `siteConfig.commerce.enabledPaymentMethods`
   (`src/config/site.ts`).
2. Crie a rota de criação de pagamento em `src/app/api/pagamento/route.ts`,
   usando `src/app/api/pedidos/route.ts` como referência — o pedido já é gravado
   com código, itens, valores e endereço.
3. Trate o retorno do gateway atualizando `orders.status` para `confirmado`.

A estrutura de dados (pedidos, itens, cupons, frete e endereço) já está pronta
para receber a integração sem migração adicional.

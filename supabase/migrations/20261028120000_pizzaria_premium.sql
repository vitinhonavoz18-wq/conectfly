-- ============================================================================
-- Pizzaria Premium — campos novos do cardápio (SiteCreatorFly)
-- ============================================================================
--
-- Só ACRESCENTA colunas, todas opcionais. Nada existente é apagado ou
-- alterado, e nenhum preço muda: coluna vazia = comporta-se como antes.
--
-- Espelha a migração de mesmo nome no FlyControl. ORDEM: aplicar ESTA
-- primeiro — o painel do FlyControl passa a enviar estes campos quando o
-- lojista salva, e a sincronização (routes/api/menu-sync.$.ts) grava o que
-- chega direto em `menu_items`.
--
-- Em `menu_items` moram sabores, bordas e adicionais (a categoria diz quem é
-- quem). Cada coluna só tem sentido para um deles:
--   pizza_size_prices_cents — sabor, borda ou adicional: preço por tamanho;
--   ingredients             — sabor: o que o cliente pode pedir para retirar;
--   max_quantity            — adicional: quantas vezes na mesma pizza.
--
-- As regras de acesso (RLS) de `menu_items` não mudam.
-- ============================================================================

alter table public.menu_items
  add column if not exists pizza_size_prices_cents jsonb,
  add column if not exists ingredients text[],
  add column if not exists max_quantity integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menu_items_pizza_prices_obj') then
    alter table public.menu_items add constraint menu_items_pizza_prices_obj
      check (pizza_size_prices_cents is null or jsonb_typeof(pizza_size_prices_cents) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'menu_items_ingredients_max') then
    alter table public.menu_items add constraint menu_items_ingredients_max
      check (ingredients is null or cardinality(ingredients) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'menu_items_max_quantity_faixa') then
    alter table public.menu_items add constraint menu_items_max_quantity_faixa
      check (max_quantity is null or (max_quantity between 1 and 20));
  end if;
end $$;

comment on column public.menu_items.pizza_size_prices_cents is
  'Pizzaria Premium: preço por tamanho, em centavos. Chave = nome do tamanho normalizado. Nulo = preço antigo.';
comment on column public.menu_items.ingredients is
  'Pizzaria Premium: ingredientes do sabor. Retirar ingrediente não dá desconto.';
comment on column public.menu_items.max_quantity is
  'Pizzaria Premium: quantas vezes o mesmo adicional pode entrar na mesma pizza. Nulo = 1.';

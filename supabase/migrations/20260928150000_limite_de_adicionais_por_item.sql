-- Limite de adicionais por item do cardápio (espelha a mesma coluna no
-- FlyControl, banco separado — ver max_extras em menu_products lá).
--
-- Nulo continua significando "sem limite": nenhum item já cadastrado muda de
-- comportamento até o lojista configurar um valor no painel.
alter table public.menu_items
  add column if not exists max_extras integer;

comment on column public.menu_items.max_extras is
  'Quantidade máxima de adicionais que o cliente pode escolher neste item. Nulo = sem limite.';

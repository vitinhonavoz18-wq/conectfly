-- Em quais categorias do cardápio cada adicional aparece.
--
-- O PROBLEMA
--
-- Hoje o cliente abre QUALQUER produto e recebe a lista inteira de adicionais
-- da loja. Numa pastelaria que também vende açaí, quem vai pedir açaí é
-- oferecido bacon, e quem vai pedir pastel é oferecido leite ninho.
--
-- É o garçom levando a bandeja inteira de acompanhamentos para todas as mesas.
--
-- COMO O ADICIONAL VIVE AQUI
--
-- Neste banco, adicional não é uma coisa separada: é um `menu_items` comum
-- dentro da categoria "ADICIONAIS" (ver `EXTRA_CATEGORY` em
-- `routes/api/menu-sync.$.ts`). Por isso o vínculo sai de um item para uma
-- categoria — as duas pontas são tabelas que já existem.
--
-- ═════════════════════════════════════════════════════════════════════════
-- A REGRA QUE PROTEGE QUEM JÁ ESTÁ VENDENDO
-- ═════════════════════════════════════════════════════════════════════════
--
-- ADICIONAL SEM NENHUM VÍNCULO APARECE EM TODAS AS CATEGORIAS.
--
-- Esta migração NÃO cria vínculo nenhum. Todo adicional que já existe continua
-- aparecendo exatamente onde aparecia — nenhum some do cardápio de ninguém no
-- instante em que isto entra no ar.
--
-- Fosse ao contrário (sem vínculo = não aparece), publicar isto apagaria os
-- adicionais de todas as lojas de uma vez, e o dono só descobriria pelo
-- cliente ligando para perguntar cadê o bacon.
--
-- Quem cria vínculo é o lojista, pelo FlyControl.

create table if not exists public.menu_addon_categories (
  id uuid primary key default gen_random_uuid(),

  -- O adicional (um menu_items da categoria "ADICIONAIS"/"BORDAS").
  addon_item_id uuid not null references public.menu_items(id) on delete cascade,

  -- A categoria de produto em que ele deve ser oferecido.
  category_id uuid not null references public.menu_categories(id) on delete cascade,

  created_at timestamptz not null default now(),

  -- O mesmo par não entra duas vezes: é o caderno de reservas que só aceita um
  -- nome por mesa.
  constraint menu_addon_categories_par_unico unique (addon_item_id, category_id)
);

-- "Quais adicionais esta categoria tem?" é a pergunta que o cardápio faz a
-- cada visita; "quais categorias este adicional atende?" é a que a
-- sincronização faz ao regravar.
create index if not exists menu_addon_categories_addon_idx
  on public.menu_addon_categories (addon_item_id);
create index if not exists menu_addon_categories_category_idx
  on public.menu_addon_categories (category_id);

alter table public.menu_addon_categories enable row level security;

-- Leitura pública pelas mesmas condições de `menu_items`: o cardápio precisa
-- saber onde cada adicional vale, e só de loja publicada.
drop policy if exists "Public views addon categories" on public.menu_addon_categories;
create policy "Public views addon categories"
  on public.menu_addon_categories for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.menu_items i
      join public.restaurants r on r.id = i.restaurant_id
      where i.id = menu_addon_categories.addon_item_id
        and r.published = true
    )
  );

-- Escrita só do dono da loja — a mesma trava de `menu_items`. A escrita de
-- verdade vem da sincronização, que usa a chave mestra do servidor; esta
-- política é o que impede alguém de vincular coisa na loja do vizinho pelo
-- navegador.
drop policy if exists "Owners manage addon categories" on public.menu_addon_categories;
create policy "Owners manage addon categories"
  on public.menu_addon_categories for all
  using (
    exists (
      select 1
      from public.menu_items i
      join public.restaurants r on r.id = i.restaurant_id
      where i.id = menu_addon_categories.addon_item_id
        and r.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.menu_items i
      join public.restaurants r on r.id = i.restaurant_id
      where i.id = menu_addon_categories.addon_item_id
        and r.owner_id = auth.uid()
    )
    and exists (
      -- A categoria precisa ser da MESMA loja do adicional.
      select 1
      from public.menu_categories c
      join public.menu_items i2 on i2.id = menu_addon_categories.addon_item_id
      where c.id = menu_addon_categories.category_id
        and c.restaurant_id = i2.restaurant_id
    )
  );

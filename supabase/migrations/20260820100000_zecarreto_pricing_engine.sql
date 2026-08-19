-- =====================================================================
-- ZÉ CARRETO — FASE 3: pedido e preço
-- =====================================================================
-- O que entra aqui:
--  1. o motor de tarifas ganha distância incluída, km excedente, taxa de
--     serviço e pedágio;
--  2. adicionais viram cadastro do admin (escada, item pesado, montagem...),
--     em vez de valores escritos no código;
--  3. catálogo de itens ("geladeira", "sofá") para recomendar a categoria;
--  4. o orçamento passa a guardar uma FOTOGRAFIA da tarifa usada — mudar o
--     preço amanhã não mexe em pedido já fechado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tarifa: distância incluída, km excedente, taxa e pedágio
-- ---------------------------------------------------------------------
-- Antes: todo quilômetro era cobrado desde o primeiro.
-- Agora: a bandeirada pode já incluir alguns km — como o pacote de
-- internet que vem com uma franquia, e só depois dela começa a contar.
-- Franquia zero mantém o comportamento antigo, então nada muda para as
-- tarifas que já existem.
alter table public.zc_tariffs
  add column if not exists included_km numeric(6,2) not null default 0
    check (included_km >= 0),
  add column if not exists service_fee_cents integer not null default 0
    check (service_fee_cents >= 0),
  add column if not exists service_fee_pct numeric(6,3) not null default 0
    check (service_fee_pct >= 0 and service_fee_pct <= 100),
  add column if not exists toll_policy text not null default 'none'
    check (toll_policy in ('none', 'fixed', 'route')),
  add column if not exists toll_fixed_cents integer not null default 0
    check (toll_fixed_cents >= 0),
  add column if not exists toll_applies_above_km numeric(6,2) not null default 0
    check (toll_applies_above_km >= 0);

comment on column public.zc_tariffs.included_km is
  'Quilômetros já inclusos na bandeirada. Só o que passa disso é cobrado por km.';
comment on column public.zc_tariffs.price_per_km_cents is
  'Valor de cada quilômetro EXCEDENTE (depois da distância incluída).';
comment on column public.zc_tariffs.toll_policy is
  'none = não cobra pedágio; fixed = valor fixo acima de X km; route = valor vem do serviço de mapas.';

-- ---------------------------------------------------------------------
-- 2. Adicionais configuráveis
-- ---------------------------------------------------------------------
do $$ begin
  create type public.zc_addon_pricing as enum ('fixed', 'per_unit', 'per_floor', 'percent');
exception when duplicate_object then null; end $$;

create table if not exists public.zc_tariff_addons (
  id                uuid primary key default gen_random_uuid(),
  code              text not null,
  name              text not null,
  description       text,
  -- Nulo = vale para todas as regiões / todas as categorias.
  region_id         uuid references public.zc_regions(id) on delete cascade,
  category_id       uuid references public.zc_vehicle_categories(id) on delete cascade,
  pricing_mode      public.zc_addon_pricing not null default 'fixed',
  amount_cents      integer not null default 0 check (amount_cents >= 0),
  percent           numeric(6,3) not null default 0 check (percent >= 0 and percent <= 100),
  max_quantity      smallint not null default 1 check (max_quantity >= 1),
  requires_quantity boolean not null default false,
  icon              text,
  sort_order        integer not null default 0,
  active            boolean not null default true,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

-- Um adicional com o mesmo código não pode existir duas vezes para a
-- mesma combinação de região e categoria — senão o preço fica ambíguo.
create unique index if not exists zc_tariff_addons_scope_key
  on public.zc_tariff_addons (
    code,
    coalesce(region_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where active and deleted_at is null;

create index if not exists zc_tariff_addons_lookup_idx
  on public.zc_tariff_addons (category_id, region_id, sort_order)
  where active and deleted_at is null;

drop trigger if exists zc_tariff_addons_updated_at on public.zc_tariff_addons;
create trigger zc_tariff_addons_updated_at before update on public.zc_tariff_addons
  for each row execute function public.zc_set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Catálogo de itens (para recomendar a categoria)
-- ---------------------------------------------------------------------
-- O cliente marca "geladeira, sofá, 10 caixas" e o sistema soma volume e
-- peso para sugerir o veículo. É a mesma conta que o carreteiro faz de
-- cabeça — só que escrita, e ajustável pelo admin.
create table if not exists public.zc_item_presets (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  name            text not null,
  group_name      text not null default 'Geral',
  volume_m3       numeric(6,3) not null default 0 check (volume_m3 >= 0),
  weight_kg       numeric(8,2) not null default 0 check (weight_kg >= 0),
  is_heavy        boolean not null default false,
  needs_two_people boolean not null default false,
  icon            text,
  sort_order      integer not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create unique index if not exists zc_item_presets_code_key
  on public.zc_item_presets (code) where deleted_at is null;

drop trigger if exists zc_item_presets_updated_at on public.zc_item_presets;
create trigger zc_item_presets_updated_at before update on public.zc_item_presets
  for each row execute function public.zc_set_updated_at();

-- A categoria passa a ter capacidade em volume, não só em peso.
alter table public.zc_vehicle_categories
  add column if not exists max_volume_m3 numeric(6,2) check (max_volume_m3 is null or max_volume_m3 > 0);

-- ---------------------------------------------------------------------
-- 4. Fotografia da tarifa (snapshot financeiro)
-- ---------------------------------------------------------------------
-- Sem isso, mudar a tabela de preços amanhã mudaria o valor de um pedido
-- feito ontem — como reimprimir a conta do jantar com o cardápio novo.
alter table public.zc_quotes
  add column if not exists tariff_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists addons jsonb not null default '[]'::jsonb,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists toll_cents integer not null default 0 check (toll_cents >= 0),
  add column if not exists service_fee_cents integer not null default 0 check (service_fee_cents >= 0);

alter table public.zc_rides
  add column if not exists tariff_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists addons jsonb not null default '[]'::jsonb,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists toll_cents integer not null default 0 check (toll_cents >= 0),
  add column if not exists service_fee_cents integer not null default 0 check (service_fee_cents >= 0),
  add column if not exists items_description text;

-- Pedido confirmado é preço fechado: depois que o cliente aceitou, o
-- sistema não mexe mais no valor nem na fotografia da tarifa.
create or replace function public.zc_rides_price_lock()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if old.status not in ('draft', 'awaiting_payment') then
    if new.total_cents is distinct from old.total_cents
       or new.subtotal_cents is distinct from old.subtotal_cents
       or new.surcharge_cents is distinct from old.surcharge_cents
       or new.service_fee_cents is distinct from old.service_fee_cents
       or new.toll_cents is distinct from old.toll_cents
       or new.tariff_snapshot is distinct from old.tariff_snapshot then
      raise exception
        'ZC_PRICE_LOCKED: o preco do carreto % ja foi fechado e nao pode mudar', old.code
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists zc_rides_price_lock on public.zc_rides;
create trigger zc_rides_price_lock before update on public.zc_rides
  for each row execute function public.zc_rides_price_lock();

-- ---------------------------------------------------------------------
-- 5. RLS dos cadastros novos
-- ---------------------------------------------------------------------
alter table public.zc_tariff_addons enable row level security;
alter table public.zc_item_presets  enable row level security;

drop policy if exists "zc addons public read" on public.zc_tariff_addons;
create policy "zc addons public read" on public.zc_tariff_addons
  for select to anon, authenticated using ((active and deleted_at is null) or public.zc_is_admin());

drop policy if exists "zc addons admin write" on public.zc_tariff_addons;
create policy "zc addons admin write" on public.zc_tariff_addons
  for all to authenticated using (public.zc_is_admin()) with check (public.zc_is_admin());

drop policy if exists "zc items public read" on public.zc_item_presets;
create policy "zc items public read" on public.zc_item_presets
  for select to anon, authenticated using ((active and deleted_at is null) or public.zc_is_admin());

drop policy if exists "zc items admin write" on public.zc_item_presets;
create policy "zc items admin write" on public.zc_item_presets
  for all to authenticated using (public.zc_is_admin()) with check (public.zc_is_admin());

grant select on public.zc_tariff_addons, public.zc_item_presets to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Valores iniciais
-- ---------------------------------------------------------------------
-- Capacidade em volume de cada categoria (aproximada, ajustável).
update public.zc_vehicle_categories set max_volume_m3 = 2.5  where slug = 'pequeno'  and max_volume_m3 is null;
update public.zc_vehicle_categories set max_volume_m3 = 3.5  where slug = 'medio'    and max_volume_m3 is null;
update public.zc_vehicle_categories set max_volume_m3 = 12.0 where slug = 'bongo'    and max_volume_m3 is null;
update public.zc_vehicle_categories set max_volume_m3 = 40.0 where slug = 'caminhao' and max_volume_m3 is null;

-- Franquia de 5 km já inclusa na bandeirada das tarifas padrão.
update public.zc_tariffs set included_km = 5
 where region_id is null and active and valid_to is null and included_km = 0;

-- Adicionais que valem para todas as categorias.
insert into public.zc_tariff_addons
  (code, name, description, pricing_mode, amount_cents, max_quantity, requires_quantity, icon, sort_order)
values
  ('stairs', 'Escada (sem elevador)',
   'Cobrado por andar, quando não há elevador no local.',
   'per_floor', 1500, 20, true, 'stairs', 1),
  ('heavy_item', 'Item pesado',
   'Peças acima de 80 kg, como cofre, piano ou máquina industrial.',
   'per_unit', 5000, 10, true, 'weight', 2),
  ('assembly', 'Montagem e desmontagem',
   'Desmontar no lugar de origem e montar no destino.',
   'fixed', 8000, 1, false, 'wrench', 3),
  ('packaging', 'Embalagem e proteção',
   'Plástico bolha, manta e fita para proteger a carga.',
   'fixed', 4000, 1, false, 'package', 4),
  ('long_carry', 'Carregamento a distância',
   'Quando o veículo não encosta na porta e é preciso carregar no braço.',
   'fixed', 3000, 1, false, 'footprints', 5),
  ('urgent_load', 'Carga urgente/frágil',
   'Cuidado extra no transporte, com amarração reforçada.',
   'percent', 0, 1, false, 'shield', 6)
on conflict do nothing;

update public.zc_tariff_addons set percent = 10 where code = 'urgent_load' and percent = 0;

-- Catálogo inicial de itens.
insert into public.zc_item_presets
  (code, name, group_name, volume_m3, weight_kg, is_heavy, needs_two_people, sort_order)
values
  ('caixa_pequena',   'Caixa pequena',          'Caixas',        0.06,   8, false, false, 1),
  ('caixa_grande',    'Caixa grande',           'Caixas',        0.15,  18, false, false, 2),
  ('mala',            'Mala de viagem',         'Caixas',        0.10,  15, false, false, 3),
  ('geladeira',       'Geladeira',              'Eletrodomésticos', 0.80, 80, true,  true,  10),
  ('fogao',           'Fogão',                  'Eletrodomésticos', 0.35, 40, false, true,  11),
  ('maquina_lavar',   'Máquina de lavar',       'Eletrodomésticos', 0.45, 70, true,  true,  12),
  ('microondas',      'Micro-ondas',            'Eletrodomésticos', 0.08, 15, false, false, 13),
  ('tv',              'TV',                     'Eletrônicos',   0.10,  15, false, false, 20),
  ('sofa_2',          'Sofá de 2 lugares',      'Móveis',        1.10,  45, false, true,  30),
  ('sofa_3',          'Sofá de 3 lugares',      'Móveis',        1.60,  60, true,  true,  31),
  ('cama_solteiro',   'Cama de solteiro',       'Móveis',        0.70,  35, false, true,  32),
  ('cama_casal',      'Cama de casal',          'Móveis',        1.20,  60, true,  true,  33),
  ('colchao_casal',   'Colchão de casal',       'Móveis',        0.60,  30, false, true,  34),
  ('guarda_roupa',    'Guarda-roupa',           'Móveis',        1.80,  90, true,  true,  35),
  ('mesa_jantar',     'Mesa de jantar',         'Móveis',        0.90,  40, false, true,  36),
  ('cadeira',         'Cadeira',                'Móveis',        0.12,   6, false, false, 37),
  ('estante',         'Estante / rack',         'Móveis',        0.80,  35, false, true,  38),
  ('moto',            'Moto',                   'Outros',        1.20, 150, true,  true,  50),
  ('material_obra',   'Material de construção', 'Outros',        0.50, 200, true,  false, 51),
  ('pallet',          'Palete',                 'Outros',        1.00, 300, true,  false, 52)
on conflict do nothing;

-- Configurações novas da fase.
insert into public.zc_settings (key, value, description) values
  ('pricing.packing_slack_pct', '15'::jsonb,
   'Folga aplicada ao volume somado dos itens, porque carga não encaixa perfeita.'),
  ('pricing.show_price_breakdown', 'true'::jsonb,
   'Mostrar o detalhamento do preço para o cliente antes de confirmar.'),
  ('map.tile_url', '"https://tile.openstreetmap.org/{z}/{x}/{y}.png"'::jsonb,
   'Endereço dos quadradinhos do mapa. Trocar aqui ao contratar um provedor pago.'),
  ('map.attribution', '"© OpenStreetMap"'::jsonb,
   'Crédito obrigatório do mapa, exibido no canto.'),
  ('map.default_center', '{"lat": -23.5505, "lng": -46.6333}'::jsonb,
   'Onde o mapa abre quando ainda não há endereço.'),
  ('geocode.provider_url', '"https://nominatim.openstreetmap.org/search"'::jsonb,
   'Serviço que transforma endereço escrito em coordenada no mapa.'),
  ('order.max_stops', '6'::jsonb,
   'Quantas paradas um carreto pode ter, contando retirada e entrega.'),
  ('order.min_lead_minutes', '30'::jsonb,
   'Antecedência mínima para agendar um carreto.'),
  ('order.max_lead_days', '30'::jsonb,
   'Com quantos dias de antecedência dá para agendar.')
on conflict (key) do nothing;

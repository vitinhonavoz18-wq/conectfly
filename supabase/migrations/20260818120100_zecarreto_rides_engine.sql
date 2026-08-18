-- =====================================================================
-- ZÉ CARRETO — FASE 1 (2/4): solicitações, corridas, paradas e rastreio
-- =====================================================================
-- Aqui mora o coração do produto: o pedido de carreto, a máquina de
-- status (a "esteira" por onde a corrida anda), as paradas, as ofertas
-- enviadas aos motoristas e a posição do veículo no mapa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.zc_ride_status as enum (
    'draft',
    'awaiting_payment',
    'searching_driver',
    'driver_assigned',
    'driver_to_pickup',
    'driver_arrived',
    'loading',
    'in_transit',
    'unloading',
    'completed',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_ride_modality as enum ('scheduled', 'immediate');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_stop_kind as enum ('pickup', 'stop', 'dropoff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_stop_status as enum ('pending', 'arrived', 'completed', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_offer_status as enum ('pending', 'accepted', 'declined', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_cancel_actor as enum ('client', 'driver', 'admin', 'system');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Orçamentos (estimativas) — o preço mostrado antes de confirmar
-- ---------------------------------------------------------------------
-- O orçamento congela o preço por alguns minutos. É como o caixa imprimir
-- o cupom: enquanto o cupom vale, o preço não muda no meio do caminho.
create table if not exists public.zc_quotes (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid references public.zc_profiles(id) on delete set null,
  region_id          uuid references public.zc_regions(id) on delete set null,
  category_id        uuid not null references public.zc_vehicle_categories(id) on delete restrict,
  tariff_id          uuid not null references public.zc_tariffs(id) on delete restrict,
  modality           public.zc_ride_modality not null,
  scheduled_for      timestamptz,
  distance_meters    integer not null check (distance_meters >= 0),
  duration_seconds   integer not null check (duration_seconds >= 0),
  stops_count        smallint not null default 2 check (stops_count >= 2),
  helpers_count      smallint not null default 0 check (helpers_count >= 0),
  breakdown          jsonb not null default '{}'::jsonb,
  subtotal_cents     integer not null check (subtotal_cents >= 0),
  surcharge_cents    integer not null default 0 check (surcharge_cents >= 0),
  total_cents        integer not null check (total_cents >= 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  driver_net_cents   integer not null default 0 check (driver_net_cents >= 0),
  currency           char(3) not null default 'BRL',
  expires_at         timestamptz not null,
  consumed_at        timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists zc_quotes_profile_idx on public.zc_quotes (profile_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3. Corridas / carretos — a solicitação do início ao fim
-- ---------------------------------------------------------------------
create table if not exists public.zc_rides (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null,
  customer_id             uuid not null references public.zc_customers(id) on delete restrict,
  customer_profile_id     uuid not null references public.zc_profiles(id) on delete restrict,
  driver_id               uuid references public.zc_drivers(id) on delete set null,
  vehicle_id              uuid references public.zc_vehicles(id) on delete set null,
  region_id               uuid references public.zc_regions(id) on delete set null,
  category_id             uuid not null references public.zc_vehicle_categories(id) on delete restrict,
  tariff_id               uuid references public.zc_tariffs(id) on delete set null,
  quote_id                uuid references public.zc_quotes(id) on delete set null,

  status                  public.zc_ride_status not null default 'draft',
  modality                public.zc_ride_modality not null default 'immediate',
  scheduled_for           timestamptz,

  -- Carga
  cargo_description       text,
  cargo_photos            jsonb not null default '[]'::jsonb,
  helpers_count           smallint not null default 0 check (helpers_count >= 0),
  notes                   text,

  -- Rota estimada
  distance_meters         integer not null default 0 check (distance_meters >= 0),
  duration_seconds        integer not null default 0 check (duration_seconds >= 0),

  -- Dinheiro (centavos, congelado no momento da confirmação)
  price_breakdown         jsonb not null default '{}'::jsonb,
  subtotal_cents          integer not null default 0 check (subtotal_cents >= 0),
  surcharge_cents         integer not null default 0 check (surcharge_cents >= 0),
  total_cents             integer not null default 0 check (total_cents >= 0),
  platform_fee_cents      integer not null default 0 check (platform_fee_cents >= 0),
  driver_earnings_cents   integer not null default 0 check (driver_earnings_cents >= 0),
  currency                char(3) not null default 'BRL',

  -- Marcos da esteira
  requested_at            timestamptz,
  paid_at                 timestamptz,
  searching_started_at    timestamptz,
  assigned_at             timestamptz,
  pickup_arrived_at       timestamptz,
  loading_started_at      timestamptz,
  in_transit_at           timestamptz,
  unloading_started_at    timestamptz,
  completed_at            timestamptz,

  -- Cancelamento
  cancelled_at            timestamptz,
  cancelled_by            public.zc_cancel_actor,
  cancellation_reason     text,
  cancellation_fee_cents  integer not null default 0 check (cancellation_fee_cents >= 0),

  idempotency_key         text,
  metadata                jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,

  -- Coerência de estado: certas informações são obrigatórias em
  -- determinados pontos da esteira.
  constraint zc_rides_driver_required check (
    status not in ('driver_assigned','driver_to_pickup','driver_arrived','loading','in_transit','unloading','completed')
    or driver_id is not null
  ),
  constraint zc_rides_cancel_fields check (
    status <> 'cancelled' or (cancelled_at is not null and cancelled_by is not null)
  ),
  constraint zc_rides_scheduled_fields check (
    modality <> 'scheduled' or scheduled_for is not null
  )
);

create unique index if not exists zc_rides_code_key on public.zc_rides (code);
create unique index if not exists zc_rides_idempotency_key
  on public.zc_rides (customer_profile_id, idempotency_key) where idempotency_key is not null;
create index if not exists zc_rides_customer_idx on public.zc_rides (customer_profile_id, created_at desc);
create index if not exists zc_rides_driver_idx on public.zc_rides (driver_id, created_at desc);
create index if not exists zc_rides_status_idx on public.zc_rides (status, created_at desc);
create index if not exists zc_rides_dispatch_idx
  on public.zc_rides (region_id, category_id, status) where status = 'searching_driver';
create index if not exists zc_rides_scheduled_idx
  on public.zc_rides (scheduled_for) where modality = 'scheduled' and status = 'awaiting_payment';

drop trigger if exists zc_rides_updated_at on public.zc_rides;
create trigger zc_rides_updated_at before update on public.zc_rides
  for each row execute function public.zc_set_updated_at();

-- ---------------------------------------------------------------------
-- 4. Paradas — origem, paradas intermediárias e destino
-- ---------------------------------------------------------------------
create table if not exists public.zc_ride_stops (
  id            uuid primary key default gen_random_uuid(),
  ride_id       uuid not null references public.zc_rides(id) on delete cascade,
  sequence      smallint not null check (sequence >= 0),
  kind          public.zc_stop_kind not null,
  status        public.zc_stop_status not null default 'pending',
  street        text not null,
  number        text,
  complement    text,
  district      text,
  city          text not null,
  state         char(2) not null,
  postal_code   text,
  country       char(2) not null default 'BR',
  lat           numeric(10,7),
  lng           numeric(10,7),
  reference     text,
  contact_name  text,
  contact_phone text,
  instructions  text,
  floor_number  smallint,
  has_elevator  boolean,
  arrived_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (ride_id, sequence)
);

create index if not exists zc_ride_stops_ride_idx on public.zc_ride_stops (ride_id, sequence);

drop trigger if exists zc_ride_stops_updated_at on public.zc_ride_stops;
create trigger zc_ride_stops_updated_at before update on public.zc_ride_stops
  for each row execute function public.zc_set_updated_at();

-- ---------------------------------------------------------------------
-- 5. Histórico da esteira — todo passo fica registrado
-- ---------------------------------------------------------------------
create table if not exists public.zc_ride_status_events (
  id               bigserial primary key,
  ride_id          uuid not null references public.zc_rides(id) on delete cascade,
  from_status      public.zc_ride_status,
  to_status        public.zc_ride_status not null,
  actor_profile_id uuid references public.zc_profiles(id) on delete set null,
  actor_role       public.zc_role,
  reason           text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists zc_ride_status_events_ride_idx
  on public.zc_ride_status_events (ride_id, created_at desc);

-- ---------------------------------------------------------------------
-- 6. Ofertas — o carreto oferecido a cada motorista
-- ---------------------------------------------------------------------
create table if not exists public.zc_ride_offers (
  id              uuid primary key default gen_random_uuid(),
  ride_id         uuid not null references public.zc_rides(id) on delete cascade,
  driver_id       uuid not null references public.zc_drivers(id) on delete cascade,
  status          public.zc_offer_status not null default 'pending',
  round           smallint not null default 1 check (round >= 1),
  distance_meters integer check (distance_meters >= 0),
  payout_cents    integer check (payout_cents >= 0),
  expires_at      timestamptz not null,
  responded_at    timestamptz,
  decline_reason  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (ride_id, driver_id, round)
);

create index if not exists zc_ride_offers_driver_idx
  on public.zc_ride_offers (driver_id, status, expires_at desc);
create index if not exists zc_ride_offers_ride_idx on public.zc_ride_offers (ride_id, status);
-- Só um motorista pode aceitar a mesma corrida. O banco garante isso.
create unique index if not exists zc_ride_offers_single_accepted
  on public.zc_ride_offers (ride_id) where status = 'accepted';

drop trigger if exists zc_ride_offers_updated_at on public.zc_ride_offers;
create trigger zc_ride_offers_updated_at before update on public.zc_ride_offers
  for each row execute function public.zc_set_updated_at();

-- ---------------------------------------------------------------------
-- 7. Localização — posição atual e trilha da corrida
-- ---------------------------------------------------------------------
create table if not exists public.zc_driver_locations (
  driver_id    uuid primary key references public.zc_drivers(id) on delete cascade,
  ride_id      uuid references public.zc_rides(id) on delete set null,
  lat          numeric(10,7) not null,
  lng          numeric(10,7) not null,
  heading      numeric(5,2),
  speed_kmh    numeric(6,2),
  accuracy_m   numeric(8,2),
  availability public.zc_driver_availability not null default 'offline',
  recorded_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists zc_driver_locations_geo_idx
  on public.zc_driver_locations (lat, lng) where availability = 'online';

drop trigger if exists zc_driver_locations_updated_at on public.zc_driver_locations;
create trigger zc_driver_locations_updated_at before update on public.zc_driver_locations
  for each row execute function public.zc_set_updated_at();

create table if not exists public.zc_ride_tracking (
  id          bigserial primary key,
  ride_id     uuid not null references public.zc_rides(id) on delete cascade,
  driver_id   uuid not null references public.zc_drivers(id) on delete cascade,
  lat         numeric(10,7) not null,
  lng         numeric(10,7) not null,
  heading     numeric(5,2),
  speed_kmh   numeric(6,2),
  recorded_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists zc_ride_tracking_ride_idx on public.zc_ride_tracking (ride_id, recorded_at);

-- ---------------------------------------------------------------------
-- 8. Máquina de status — a esteira só anda para frente, e só por onde vale
-- ---------------------------------------------------------------------
create or replace function public.zc_ride_transition_allowed(
  _from public.zc_ride_status,
  _to   public.zc_ride_status
)
returns boolean
language sql immutable
as $$
  select case _from
    when 'draft'            then _to in ('awaiting_payment', 'cancelled')
    when 'awaiting_payment' then _to in ('searching_driver', 'cancelled')
    when 'searching_driver' then _to in ('driver_assigned', 'cancelled')
    -- Se o motorista desistir, a corrida volta para a busca.
    when 'driver_assigned'  then _to in ('driver_to_pickup', 'searching_driver', 'cancelled')
    when 'driver_to_pickup' then _to in ('driver_arrived', 'searching_driver', 'cancelled')
    when 'driver_arrived'   then _to in ('loading', 'cancelled')
    when 'loading'          then _to in ('in_transit', 'cancelled')
    when 'in_transit'       then _to in ('unloading', 'cancelled')
    when 'unloading'        then _to in ('completed', 'cancelled')
    else false                                  -- completed e cancelled são finais
  end;
$$;

-- Quem está agindo. O servidor informa via set_config('zc.actor_profile_id', ...).
create or replace function public.zc_current_actor()
returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('zc.actor_profile_id', true), '')::uuid,
    auth.uid()
  );
$$;

create or replace function public.zc_rides_status_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not public.zc_ride_transition_allowed(old.status, new.status) then
      raise exception
        'ZC_INVALID_TRANSITION: corrida % nao pode ir de % para %', old.id, old.status, new.status
        using errcode = 'check_violation';
    end if;

    -- Carimbos automáticos de cada etapa.
    new.searching_started_at := coalesce(new.searching_started_at,
      case when new.status = 'searching_driver' then now() end);
    new.assigned_at := coalesce(new.assigned_at,
      case when new.status = 'driver_assigned' then now() end);
    new.pickup_arrived_at := coalesce(new.pickup_arrived_at,
      case when new.status = 'driver_arrived' then now() end);
    new.loading_started_at := coalesce(new.loading_started_at,
      case when new.status = 'loading' then now() end);
    new.in_transit_at := coalesce(new.in_transit_at,
      case when new.status = 'in_transit' then now() end);
    new.unloading_started_at := coalesce(new.unloading_started_at,
      case when new.status = 'unloading' then now() end);
    new.completed_at := coalesce(new.completed_at,
      case when new.status = 'completed' then now() end);
    if new.status = 'cancelled' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
      new.cancelled_by := coalesce(new.cancelled_by, 'system');
    end if;

    -- Motorista que desiste solta a corrida de volta para a busca.
    if new.status = 'searching_driver' and old.status in ('driver_assigned','driver_to_pickup') then
      new.driver_id  := null;
      new.vehicle_id := null;
      new.assigned_at := null;
    end if;
  end if;

  if tg_op = 'INSERT' and new.status <> 'draft' then
    if not public.zc_ride_transition_allowed('draft', new.status) and new.status <> 'draft' then
      raise exception 'ZC_INVALID_INITIAL_STATUS: corrida nao pode nascer em %', new.status
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists zc_rides_status_guard on public.zc_rides;
create trigger zc_rides_status_guard before insert or update on public.zc_rides
  for each row execute function public.zc_rides_status_guard();

create or replace function public.zc_rides_log_status()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  _actor uuid := public.zc_current_actor();
  _role  public.zc_role;
begin
  select r.role into _role
  from public.zc_user_roles r
  where r.user_id = _actor
  order by case r.role when 'admin' then 1 when 'driver' then 2 else 3 end
  limit 1;

  if tg_op = 'INSERT' then
    insert into public.zc_ride_status_events (ride_id, from_status, to_status, actor_profile_id, actor_role)
    values (new.id, null, new.status, _actor, _role);
  elsif new.status is distinct from old.status then
    insert into public.zc_ride_status_events
      (ride_id, from_status, to_status, actor_profile_id, actor_role, reason)
    values (new.id, old.status, new.status, _actor, _role,
            case when new.status = 'cancelled' then new.cancellation_reason end);
  end if;
  return null;
end;
$$;

drop trigger if exists zc_rides_log_status on public.zc_rides;
create trigger zc_rides_log_status after insert or update on public.zc_rides
  for each row execute function public.zc_rides_log_status();

-- Código legível da corrida (ZC-XXXXXXX), gerado no banco.
create or replace function public.zc_rides_set_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  _candidate text;
  _tries int := 0;
begin
  if new.code is not null and new.code <> '' then
    return new;
  end if;
  loop
    _tries := _tries + 1;
    _candidate := 'ZC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7));
    exit when not exists (select 1 from public.zc_rides where code = _candidate);
    if _tries > 10 then
      _candidate := 'ZC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
      exit;
    end if;
  end loop;
  new.code := _candidate;
  return new;
end;
$$;

drop trigger if exists zc_rides_set_code on public.zc_rides;
create trigger zc_rides_set_code before insert on public.zc_rides
  for each row execute function public.zc_rides_set_code();

-- ---------------------------------------------------------------------
-- 9. Aceite de oferta — uma corrida, um motorista, sem corrida de cavalo
-- ---------------------------------------------------------------------
-- Quando dois motoristas apertam "aceitar" no mesmo segundo, apenas o
-- primeiro leva. O segundo recebe "ZC_RIDE_TAKEN" e nada é corrompido.
create or replace function public.zc_accept_ride_offer(
  _offer_id  uuid,
  _driver_id uuid,
  _vehicle_id uuid default null
)
returns public.zc_rides
language plpgsql security definer set search_path = public
as $$
declare
  _offer  public.zc_ride_offers;
  _ride   public.zc_rides;
  _veh    uuid;
begin
  select * into _offer from public.zc_ride_offers where id = _offer_id for update;
  if _offer.id is null then
    raise exception 'ZC_OFFER_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if _offer.driver_id <> _driver_id then
    raise exception 'ZC_OFFER_FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  if _offer.status <> 'pending' then
    raise exception 'ZC_OFFER_NOT_PENDING' using errcode = 'check_violation';
  end if;
  if _offer.expires_at <= now() then
    update public.zc_ride_offers set status = 'expired', responded_at = now() where id = _offer_id;
    raise exception 'ZC_OFFER_EXPIRED' using errcode = 'check_violation';
  end if;

  select * into _ride from public.zc_rides where id = _offer.ride_id for update;
  if _ride.status <> 'searching_driver' then
    raise exception 'ZC_RIDE_TAKEN' using errcode = 'check_violation';
  end if;

  _veh := coalesce(_vehicle_id, (select d.current_vehicle_id from public.zc_drivers d where d.id = _driver_id));

  update public.zc_ride_offers
     set status = 'accepted', responded_at = now()
   where id = _offer_id;

  update public.zc_ride_offers
     set status = 'cancelled', responded_at = now()
   where ride_id = _offer.ride_id and id <> _offer_id and status = 'pending';

  update public.zc_rides
     set status = 'driver_assigned', driver_id = _driver_id, vehicle_id = _veh
   where id = _offer.ride_id
  returning * into _ride;

  update public.zc_drivers set availability = 'busy' where id = _driver_id;

  return _ride;
end;
$$;

-- ---------------------------------------------------------------------
-- 10. RLS
-- ---------------------------------------------------------------------
alter table public.zc_quotes             enable row level security;
alter table public.zc_rides              enable row level security;
alter table public.zc_ride_stops         enable row level security;
alter table public.zc_ride_status_events enable row level security;
alter table public.zc_ride_offers        enable row level security;
alter table public.zc_driver_locations   enable row level security;
alter table public.zc_ride_tracking      enable row level security;

drop policy if exists "zc quotes own" on public.zc_quotes;
create policy "zc quotes own" on public.zc_quotes
  for select to authenticated using (profile_id = auth.uid() or public.zc_is_admin());

-- Corridas: o cliente vê as dele, o motorista vê as dele, admin vê tudo.
drop policy if exists "zc rides read own" on public.zc_rides;
create policy "zc rides read own" on public.zc_rides
  for select to authenticated using (
    customer_profile_id = auth.uid()
    or driver_id = public.zc_current_driver_id()
    or public.zc_is_admin()
  );

-- Criar e mudar corrida passa SEMPRE pelo servidor (service_role), que
-- valida preço, pagamento e permissão. O app não escreve direto.
drop policy if exists "zc rides admin write" on public.zc_rides;
create policy "zc rides admin write" on public.zc_rides
  for all to authenticated using (public.zc_is_admin()) with check (public.zc_is_admin());

drop policy if exists "zc ride stops read" on public.zc_ride_stops;
create policy "zc ride stops read" on public.zc_ride_stops
  for select to authenticated using (
    exists (
      select 1 from public.zc_rides r
      where r.id = ride_id
        and (r.customer_profile_id = auth.uid()
             or r.driver_id = public.zc_current_driver_id()
             or public.zc_is_admin())
    )
  );

drop policy if exists "zc ride stops admin write" on public.zc_ride_stops;
create policy "zc ride stops admin write" on public.zc_ride_stops
  for all to authenticated using (public.zc_is_admin()) with check (public.zc_is_admin());

drop policy if exists "zc ride events read" on public.zc_ride_status_events;
create policy "zc ride events read" on public.zc_ride_status_events
  for select to authenticated using (
    exists (
      select 1 from public.zc_rides r
      where r.id = ride_id
        and (r.customer_profile_id = auth.uid()
             or r.driver_id = public.zc_current_driver_id()
             or public.zc_is_admin())
    )
  );

drop policy if exists "zc offers driver read" on public.zc_ride_offers;
create policy "zc offers driver read" on public.zc_ride_offers
  for select to authenticated
  using (driver_id = public.zc_current_driver_id() or public.zc_is_admin());

drop policy if exists "zc offers admin write" on public.zc_ride_offers;
create policy "zc offers admin write" on public.zc_ride_offers
  for all to authenticated using (public.zc_is_admin()) with check (public.zc_is_admin());

-- Posição: o motorista escreve a própria; o cliente só enxerga a do
-- motorista que está na corrida dele.
drop policy if exists "zc driver location self" on public.zc_driver_locations;
create policy "zc driver location self" on public.zc_driver_locations
  for all to authenticated
  using (driver_id = public.zc_current_driver_id() or public.zc_is_admin())
  with check (driver_id = public.zc_current_driver_id() or public.zc_is_admin());

drop policy if exists "zc driver location ride client" on public.zc_driver_locations;
create policy "zc driver location ride client" on public.zc_driver_locations
  for select to authenticated using (
    exists (
      select 1 from public.zc_rides r
      where r.driver_id = zc_driver_locations.driver_id
        and r.customer_profile_id = auth.uid()
        and r.status in ('driver_assigned','driver_to_pickup','driver_arrived','loading','in_transit','unloading')
    )
  );

drop policy if exists "zc ride tracking read" on public.zc_ride_tracking;
create policy "zc ride tracking read" on public.zc_ride_tracking
  for select to authenticated using (
    exists (
      select 1 from public.zc_rides r
      where r.id = ride_id
        and (r.customer_profile_id = auth.uid()
             or r.driver_id = public.zc_current_driver_id()
             or public.zc_is_admin())
    )
  );

drop policy if exists "zc ride tracking driver write" on public.zc_ride_tracking;
create policy "zc ride tracking driver write" on public.zc_ride_tracking
  for insert to authenticated with check (driver_id = public.zc_current_driver_id());

-- ---------------------------------------------------------------------
-- 11. Tempo real — o que o app precisa ver mudando na tela
-- ---------------------------------------------------------------------
do $$
declare
  _tbl text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach _tbl in array array[
    'zc_rides', 'zc_ride_offers', 'zc_ride_status_events', 'zc_driver_locations', 'zc_ride_stops'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = _tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', _tbl);
    end if;
  end loop;
end $$;

alter table public.zc_rides            replica identity full;
alter table public.zc_ride_offers      replica identity full;
alter table public.zc_driver_locations replica identity full;
alter table public.zc_ride_stops       replica identity full;

-- ---------------------------------------------------------------------
-- 12. Permissões
-- ---------------------------------------------------------------------
grant select on
  public.zc_quotes, public.zc_rides, public.zc_ride_stops,
  public.zc_ride_status_events, public.zc_ride_offers,
  public.zc_driver_locations, public.zc_ride_tracking
  to authenticated;
grant insert, update on public.zc_driver_locations to authenticated;
grant insert on public.zc_ride_tracking to authenticated;
grant execute on function public.zc_accept_ride_offer(uuid, uuid, uuid) to authenticated, service_role;

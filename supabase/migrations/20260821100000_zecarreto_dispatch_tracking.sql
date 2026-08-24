-- =====================================================================
-- ZÉ CARRETO — FASE 4: motorista e rastreamento
-- =====================================================================
-- O que entra aqui:
--  1. agenda do motorista — um carreteiro não pode estar em dois lugares
--     ao mesmo tempo, e o banco garante isso;
--  2. conversa entre cliente e carreteiro dentro da plataforma;
--  3. link de acompanhamento para compartilhar com quem está esperando;
--  4. trilha simplificada da rota (guarda o caminho sem encher o banco);
--  5. recuperação: motorista sumiu, fechou o app, ninguém aceitou.
-- =====================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- 1. Agenda do motorista (carretos agendados)
-- ---------------------------------------------------------------------
do $$ begin
  create type public.zc_reservation_status as enum ('held', 'confirmed', 'released');
exception when duplicate_object then null; end $$;

create table if not exists public.zc_driver_reservations (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references public.zc_drivers(id) on delete cascade,
  ride_id    uuid not null references public.zc_rides(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  status     public.zc_reservation_status not null default 'held',
  released_at timestamptz,
  reason     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zc_driver_reservations_window check (ends_at > starts_at)
);

-- A trava da agenda: dois compromissos que se cruzam no mesmo carreteiro
-- não entram. É o caderno de reservas que só aceita um nome por horário —
-- se tentar marcar dois, a caneta trava.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'zc_driver_reservations_no_overlap'
      and conrelid = 'public.zc_driver_reservations'::regclass
  ) then
    alter table public.zc_driver_reservations
      add constraint zc_driver_reservations_no_overlap
      exclude using gist (
        driver_id with =,
        tstzrange(starts_at, ends_at) with &&
      ) where (status <> 'released');
  end if;
end $$;

create index if not exists zc_driver_reservations_driver_idx
  on public.zc_driver_reservations (driver_id, starts_at);
create unique index if not exists zc_driver_reservations_ride_key
  on public.zc_driver_reservations (ride_id) where status <> 'released';

drop trigger if exists zc_driver_reservations_updated_at on public.zc_driver_reservations;
create trigger zc_driver_reservations_updated_at before update on public.zc_driver_reservations
  for each row execute function public.zc_set_updated_at();

-- ---------------------------------------------------------------------
-- 2. Conversa do carreto
-- ---------------------------------------------------------------------
-- Cliente e carreteiro falam DENTRO da plataforma. Assim ninguém precisa
-- passar o telefone pessoal, e o suporte consegue ver o que foi combinado
-- se houver discussão depois.
create table if not exists public.zc_ride_messages (
  id                uuid primary key default gen_random_uuid(),
  ride_id           uuid not null references public.zc_rides(id) on delete cascade,
  sender_profile_id uuid references public.zc_profiles(id) on delete set null,
  sender_role       public.zc_role,
  /* Mensagem do próprio sistema ("motorista chegou"), sem remetente. */
  is_system         boolean not null default false,
  body              text not null,
  attachments       jsonb not null default '[]'::jsonb,
  read_at           timestamptz,
  created_at        timestamptz not null default now(),
  constraint zc_ride_messages_body check (length(btrim(body)) > 0)
);

create index if not exists zc_ride_messages_ride_idx
  on public.zc_ride_messages (ride_id, created_at);
create index if not exists zc_ride_messages_unread_idx
  on public.zc_ride_messages (ride_id) where read_at is null;

-- ---------------------------------------------------------------------
-- 3. Acompanhamento e estado da corrida
-- ---------------------------------------------------------------------
alter table public.zc_rides
  add column if not exists share_token text,
  add column if not exists share_expires_at timestamptz,
  add column if not exists eta_seconds integer check (eta_seconds is null or eta_seconds >= 0),
  add column if not exists eta_updated_at timestamptz,
  add column if not exists last_driver_ping_at timestamptz,
  add column if not exists reassignment_count smallint not null default 0
    check (reassignment_count >= 0),
  add column if not exists assignment_strategy text not null default 'broadcast'
    check (assignment_strategy in ('broadcast', 'reserve'));

create unique index if not exists zc_rides_share_token_key
  on public.zc_rides (share_token) where share_token is not null;

-- Estado do aparelho do motorista: ajuda a explicar "sumiu do mapa".
alter table public.zc_driver_locations
  add column if not exists app_state text not null default 'unknown'
    check (app_state in ('foreground', 'background', 'unknown')),
  add column if not exists battery_pct smallint
    check (battery_pct is null or (battery_pct between 0 and 100));

-- Trilha da rota: guarda só os pontos que importam.
alter table public.zc_ride_tracking
  add column if not exists distance_from_previous_m integer
    check (distance_from_previous_m is null or distance_from_previous_m >= 0);

-- ---------------------------------------------------------------------
-- 4. Conflito de agenda
-- ---------------------------------------------------------------------
-- Responde: "esse carreteiro está livre neste horário?"
create or replace function public.zc_driver_has_conflict(
  _driver_id  uuid,
  _starts_at  timestamptz,
  _ends_at    timestamptz,
  _exclude_ride uuid default null
)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    -- já tem reserva marcada que cruza com esta janela
    select 1 from public.zc_driver_reservations r
    where r.driver_id = _driver_id
      and r.status <> 'released'
      and (_exclude_ride is null or r.ride_id <> _exclude_ride)
      and tstzrange(r.starts_at, r.ends_at) && tstzrange(_starts_at, _ends_at)
    union all
    -- ou está no meio de um carreto agora
    select 1 from public.zc_rides ride
    where ride.driver_id = _driver_id
      and (_exclude_ride is null or ride.id <> _exclude_ride)
      and ride.status in ('driver_assigned','driver_to_pickup','driver_arrived',
                          'loading','in_transit','unloading')
  );
$$;

-- ---------------------------------------------------------------------
-- 5. Soltar a corrida de volta para a fila
-- ---------------------------------------------------------------------
-- Usada quando o motorista desiste, some do mapa ou fecha o aplicativo.
-- A corrida NÃO é cancelada: ela volta a procurar carreteiro, e fica
-- registrado que houve uma reassociação.
create or replace function public.zc_release_ride(
  _ride_id uuid,
  _reason  text default null,
  _blame_driver boolean default true
)
returns public.zc_rides
language plpgsql security definer set search_path = public
as $$
declare
  _ride public.zc_rides;
  _driver uuid;
begin
  select * into _ride from public.zc_rides where id = _ride_id for update;
  if _ride.id is null then
    raise exception 'ZC_RIDE_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if _ride.status not in ('driver_assigned', 'driver_to_pickup') then
    raise exception 'ZC_RIDE_NOT_RELEASABLE: carreto em % nao pode voltar para a fila', _ride.status
      using errcode = 'check_violation';
  end if;

  _driver := _ride.driver_id;

  -- Cancela TODAS as ofertas em aberto — inclusive a que já tinha sido
  -- aceita. Sem isso a corrida ficaria com um aceite grudado nela e
  -- nenhum outro carreteiro conseguiria pegá-la: seria a mesa reservada
  -- para quem já foi embora, e o restaurante sem poder sentar ninguém.
  update public.zc_ride_offers
     set status = 'cancelled', responded_at = now()
   where ride_id = _ride_id and status in ('pending', 'accepted');

  update public.zc_driver_reservations
     set status = 'released', released_at = now(), reason = _reason
   where ride_id = _ride_id and status <> 'released';

  update public.zc_rides
     set status = 'searching_driver',
         reassignment_count = reassignment_count + 1,
         eta_seconds = null,
         eta_updated_at = null
   where id = _ride_id
  returning * into _ride;

  if _driver is not null then
    update public.zc_drivers
       set availability = case when availability = 'busy' then 'online' else availability end,
           cancellation_rate = case
             when _blame_driver then least(100, cancellation_rate + 1)
             else cancellation_rate
           end
     where id = _driver;
  end if;

  insert into public.zc_ride_messages (ride_id, is_system, body)
  values (_ride_id, true, coalesce(_reason, 'Procurando outro carreteiro para você.'));

  return _ride;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Recuperação automática
-- ---------------------------------------------------------------------
-- Motorista que parou de mandar posição há muito tempo sai do ar. É o
-- crachá que expira sozinho quando a pessoa não passa mais na catraca.
create or replace function public.zc_expire_stale_drivers(_stale_seconds integer default 120)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  _count integer;
begin
  with parados as (
    update public.zc_driver_locations l
       set availability = 'offline'
     where l.availability = 'online'
       and l.recorded_at < now() - make_interval(secs => _stale_seconds)
    returning l.driver_id
  )
  update public.zc_drivers d
     set availability = 'offline'
   where d.id in (select driver_id from parados)
     and d.availability = 'online';
  get diagnostics _count = row_count;
  return _count;
end;
$$;

-- Carreto com motorista designado que sumiu: volta para a fila.
create or replace function public.zc_recover_abandoned_rides(_grace_seconds integer default 300)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  _ride record;
  _count integer := 0;
begin
  for _ride in
    select r.id
    from public.zc_rides r
    left join public.zc_driver_locations l on l.driver_id = r.driver_id
    where r.status in ('driver_assigned', 'driver_to_pickup')
      and r.assigned_at < now() - make_interval(secs => _grace_seconds)
      and (l.recorded_at is null or l.recorded_at < now() - make_interval(secs => _grace_seconds))
  loop
    perform public.zc_release_ride(
      _ride.id,
      'O carreteiro ficou sem sinal. Estamos procurando outro para você.',
      true
    );
    _count := _count + 1;
  end loop;
  return _count;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Aceite com agenda (substitui a versão da Fase 1)
-- ---------------------------------------------------------------------
-- Agora, além de garantir que só um motorista leva a corrida, o aceite
-- também confere a AGENDA dele e reserva o horário quando é agendado.
create or replace function public.zc_accept_ride_offer(
  _offer_id  uuid,
  _driver_id uuid,
  _vehicle_id uuid default null
)
returns public.zc_rides
language plpgsql security definer set search_path = public
as $$
declare
  _offer   public.zc_ride_offers;
  _ride    public.zc_rides;
  _ride_id uuid;
  _veh     uuid;
  _starts  timestamptz;
  _ends    timestamptz;
begin
  -- A ORDEM DAS TRAVAS é o que impede o sistema de travar sozinho.
  --
  -- Dez carreteiros apertando "aceitar" no mesmo segundo são dez pedidos
  -- disputando as mesmas linhas. Se cada um travar primeiro a SUA oferta e
  -- depois a corrida, um acaba esperando o outro em círculo — como duas
  -- pessoas num corredor estreito, cada uma esperando a outra passar.
  --
  -- Por isso: TODO MUNDO trava a CORRIDA primeiro. Vira uma fila de uma
  -- pessoa por vez, e a primeira que entra leva o carreto.
  select ride_id into _ride_id from public.zc_ride_offers where id = _offer_id;
  if _ride_id is null then
    raise exception 'ZC_OFFER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  select * into _ride from public.zc_rides where id = _ride_id for update;
  if _ride.id is null then
    raise exception 'ZC_RIDE_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- Daqui para baixo só passa um de cada vez.
  select * into _offer from public.zc_ride_offers where id = _offer_id for update;
  if _offer.driver_id <> _driver_id then
    raise exception 'ZC_OFFER_FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;

  -- A CORRIDA é conferida antes da oferta, e o motivo é a mensagem que o
  -- carreteiro lê. Quem chegou depois teve a oferta cancelada pelo próprio
  -- sistema — dizer "esta oferta já foi respondida" seria culpar quem não
  -- fez nada. O certo é: "outro carreteiro aceitou primeiro".
  if _ride.status <> 'searching_driver' then
    raise exception 'ZC_RIDE_TAKEN' using errcode = 'check_violation';
  end if;

  if _offer.status <> 'pending' then
    raise exception 'ZC_OFFER_NOT_PENDING' using errcode = 'check_violation';
  end if;
  if _offer.expires_at <= now() then
    update public.zc_ride_offers set status = 'expired', responded_at = now() where id = _offer_id;
    raise exception 'ZC_OFFER_EXPIRED' using errcode = 'check_violation';
  end if;

  -- Janela do compromisso: para agendado, a hora marcada; para imediato,
  -- agora. A duração estimada define o fim, com folga de 30 minutos.
  _starts := coalesce(_ride.scheduled_for, now());
  _ends := _starts + make_interval(secs => coalesce(_ride.duration_seconds, 3600) + 1800);

  if public.zc_driver_has_conflict(_driver_id, _starts, _ends, _ride.id) then
    raise exception 'ZC_DRIVER_BUSY: carreteiro ja tem compromisso neste horario'
      using errcode = 'check_violation';
  end if;

  _veh := coalesce(_vehicle_id, (select d.current_vehicle_id from public.zc_drivers d where d.id = _driver_id));

  update public.zc_ride_offers
     set status = 'accepted', responded_at = now()
   where id = _offer_id;

  update public.zc_ride_offers
     set status = 'cancelled', responded_at = now()
   where ride_id = _offer.ride_id and id <> _offer_id and status = 'pending';

  insert into public.zc_driver_reservations (driver_id, ride_id, starts_at, ends_at, status)
  values (_driver_id, _ride.id, _starts, _ends, 'confirmed')
  on conflict do nothing;

  update public.zc_rides
     set status = 'driver_assigned', driver_id = _driver_id, vehicle_id = _veh
   where id = _offer.ride_id
  returning * into _ride;

  -- Só fica "ocupado" na hora do carreto imediato; no agendado o
  -- carreteiro continua livre para rodar até a hora marcada.
  if _ride.modality = 'immediate' then
    update public.zc_drivers set availability = 'busy' where id = _driver_id;
  end if;

  return _ride;
end;
$$;

-- Corrida concluída ou cancelada libera a agenda.
create or replace function public.zc_rides_release_reservation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status in ('completed', 'cancelled') and new.status is distinct from old.status then
    update public.zc_driver_reservations
       set status = 'released', released_at = now()
     where ride_id = new.id and status <> 'released';
  end if;
  return null;
end;
$$;

drop trigger if exists zc_rides_release_reservation on public.zc_rides;
create trigger zc_rides_release_reservation after update on public.zc_rides
  for each row execute function public.zc_rides_release_reservation();

-- ---------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------
alter table public.zc_driver_reservations enable row level security;
alter table public.zc_ride_messages       enable row level security;

drop policy if exists "zc reservations read own" on public.zc_driver_reservations;
create policy "zc reservations read own" on public.zc_driver_reservations
  for select to authenticated
  using (driver_id = public.zc_current_driver_id() or public.zc_is_admin());

-- Conversa: só quem está na corrida (e o admin) lê e escreve.
drop policy if exists "zc ride messages read" on public.zc_ride_messages;
create policy "zc ride messages read" on public.zc_ride_messages
  for select to authenticated using (
    exists (
      select 1 from public.zc_rides r
      where r.id = ride_id
        and (r.customer_profile_id = auth.uid()
             or r.driver_id = public.zc_current_driver_id()
             or public.zc_is_admin())
    )
  );

drop policy if exists "zc ride messages insert" on public.zc_ride_messages;
create policy "zc ride messages insert" on public.zc_ride_messages
  for insert to authenticated with check (
    sender_profile_id = auth.uid()
    and is_system = false
    and exists (
      select 1 from public.zc_rides r
      where r.id = ride_id
        and (r.customer_profile_id = auth.uid() or r.driver_id = public.zc_current_driver_id())
        and r.status not in ('completed', 'cancelled')
    )
  );

grant select on public.zc_driver_reservations to authenticated;
grant select, insert on public.zc_ride_messages to authenticated;

-- ---------------------------------------------------------------------
-- 9. Tempo real
-- ---------------------------------------------------------------------
do $$
declare
  _tbl text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach _tbl in array array['zc_ride_messages', 'zc_ride_tracking'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = _tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', _tbl);
    end if;
  end loop;
end $$;

alter table public.zc_ride_messages replica identity full;

-- ---------------------------------------------------------------------
-- 10. Configurações da fase
-- ---------------------------------------------------------------------
insert into public.zc_settings (key, value, description) values
  ('tracking.min_distance_meters', '60'::jsonb,
   'Distância mínima que o motorista precisa andar para gravar um ponto novo na trilha.'),
  ('tracking.max_seconds_between_points', '90'::jsonb,
   'Mesmo parado, grava um ponto a cada tanto tempo — para provar que estava lá.'),
  ('tracking.offline_grace_seconds', '300'::jsonb,
   'Quanto tempo sem sinal antes de considerar que o carreteiro sumiu.'),
  ('eta.avg_speed_kmh', '26'::jsonb,
   'Velocidade média usada para estimar a chegada quando não há dado melhor.'),
  ('eta.min_seconds', '60'::jsonb,
   'Piso da estimativa de chegada — nunca dizer "chega em 5 segundos".'),
  ('eta.refresh_seconds', '30'::jsonb,
   'De quanto em quanto tempo a previsão de chegada é recalculada.'),
  ('dispatch.scheduled_strategy', '"reserve"'::jsonb,
   'Como o agendado acha motorista: "reserve" (reserva com antecedência) ou "broadcast" (oferece só na hora).'),
  ('dispatch.max_reassignments', '3'::jsonb,
   'Quantas vezes um carreto pode voltar para a fila antes de avisar o suporte.'),
  ('dispatch.pickup_radius_km', '15'::jsonb,
   'Distância máxima entre o carreteiro e o local de retirada.'),
  ('privacy.approximate_pickup_meters', '400'::jsonb,
   'Antes do aceite, o endereço de retirada é mostrado arredondado neste raio.'),
  ('share.tracking_ttl_hours', '12'::jsonb,
   'Por quantas horas o link de acompanhamento continua funcionando.')
on conflict (key) do nothing;

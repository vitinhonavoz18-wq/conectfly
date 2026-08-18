-- =====================================================================
-- ZÉ CARRETO — FASE 1 (1/4): identidade, permissões e catálogo
-- =====================================================================
-- O ZÉ CARRETO é um produto novo que vive no mesmo banco do
-- SiteCreatorFly, mas com todas as tabelas marcadas com o prefixo `zc_`.
-- É como abrir uma segunda gaveta no mesmo armário: nada do restaurante é
-- tocado, e é impossível confundir uma coisa com a outra.
--
-- Esta migração cria: tipos (listas fechadas de valores), perfis, papéis,
-- clientes, motoristas, veículos, documentos, endereços, regiões,
-- categorias de veículo, tarifas e configurações do admin.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tipos (enums) — listas fechadas de valores aceitos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.zc_role as enum ('client', 'driver', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_account_status as enum ('active', 'pending', 'suspended', 'banned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_driver_status as enum (
    'pending_documents', 'under_review', 'approved', 'rejected', 'suspended'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_driver_availability as enum ('offline', 'online', 'busy');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_document_owner as enum ('driver', 'vehicle');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_document_type as enum (
    'cnh', 'crlv', 'profile_photo', 'vehicle_photo', 'proof_of_address',
    'criminal_record', 'bank_proof', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_document_status as enum ('pending', 'under_review', 'approved', 'rejected', 'expired');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Função de carimbo de atualização (updated_at)
-- ---------------------------------------------------------------------
create or replace function public.zc_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Perfis — todo usuário do ZÉ CARRETO (cliente, motorista ou admin)
-- ---------------------------------------------------------------------
create table if not exists public.zc_profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text not null,
  phone             text,
  email             text,
  document_number   text,                         -- CPF ou CNPJ (somente dígitos)
  birth_date        date,
  avatar_url        text,
  status            public.zc_account_status not null default 'active',
  last_seen_at      timestamptz,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create unique index if not exists zc_profiles_phone_key
  on public.zc_profiles (phone) where phone is not null and deleted_at is null;
create unique index if not exists zc_profiles_document_key
  on public.zc_profiles (document_number) where document_number is not null and deleted_at is null;
create index if not exists zc_profiles_status_idx on public.zc_profiles (status) where deleted_at is null;

drop trigger if exists zc_profiles_updated_at on public.zc_profiles;
create trigger zc_profiles_updated_at before update on public.zc_profiles
  for each row execute function public.zc_set_updated_at();

-- ---------------------------------------------------------------------
-- 4. Papéis (RBAC) — quem é cliente, motorista e administrador
-- ---------------------------------------------------------------------
-- O papel NUNCA fica junto do perfil: fica em tabela própria, para que
-- ninguém consiga "se promover" a admin editando o próprio cadastro.
create table if not exists public.zc_user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.zc_role not null,
  granted_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (user_id, role)
);

create index if not exists zc_user_roles_user_idx on public.zc_user_roles (user_id);

-- Funções de checagem. SECURITY DEFINER para poderem ler zc_user_roles
-- mesmo dentro das políticas de RLS sem cair em recursão.
create or replace function public.zc_has_role(_user_id uuid, _role public.zc_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.zc_user_roles where user_id = _user_id and role = _role
  );
$$;

create or replace function public.zc_is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.zc_has_role(auth.uid(), 'admin'::public.zc_role);
$$;

create or replace function public.zc_is_driver()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.zc_has_role(auth.uid(), 'driver'::public.zc_role);
$$;

create or replace function public.zc_is_client()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.zc_has_role(auth.uid(), 'client'::public.zc_role);
$$;

-- ---------------------------------------------------------------------
-- 5. Regiões — onde a plataforma opera (configurável no admin)
-- ---------------------------------------------------------------------
create table if not exists public.zc_regions (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null,
  name              text not null,
  city              text,
  state             char(2),
  country           char(2) not null default 'BR',
  timezone          text not null default 'America/Sao_Paulo',
  center_lat        numeric(10,7),
  center_lng        numeric(10,7),
  radius_km         numeric(6,2),
  demand_multiplier numeric(5,3) not null default 1.000 check (demand_multiplier between 0.100 and 5.000),
  active            boolean not null default true,
  is_default        boolean not null default false,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create unique index if not exists zc_regions_slug_key on public.zc_regions (slug) where deleted_at is null;
create unique index if not exists zc_regions_single_default
  on public.zc_regions ((is_default)) where is_default and deleted_at is null;

drop trigger if exists zc_regions_updated_at on public.zc_regions;
create trigger zc_regions_updated_at before update on public.zc_regions
  for each row execute function public.zc_set_updated_at();

-- ---------------------------------------------------------------------
-- 6. Categorias de veículo (configurável no admin)
-- ---------------------------------------------------------------------
create table if not exists public.zc_vehicle_categories (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null,
  name             text not null,
  description      text,
  examples         text,                       -- "Saveiro, Strada, Montana..."
  max_weight_kg    integer check (max_weight_kg is null or max_weight_kg > 0),
  max_length_cm    integer,
  max_width_cm     integer,
  max_height_cm    integer,
  helpers_included smallint not null default 0 check (helpers_included >= 0),
  max_helpers      smallint not null default 2 check (max_helpers >= 0),
  icon             text,
  sort_order       integer not null default 0,
  active           boolean not null default true,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create unique index if not exists zc_vehicle_categories_slug_key
  on public.zc_vehicle_categories (slug) where deleted_at is null;

drop trigger if exists zc_vehicle_categories_updated_at on public.zc_vehicle_categories;
create trigger zc_vehicle_categories_updated_at before update on public.zc_vehicle_categories
  for each row execute function public.zc_set_updated_at();

-- ---------------------------------------------------------------------
-- 7. Tarifas — TODO valor cobrado sai daqui, nunca do código
-- ---------------------------------------------------------------------
-- Valores em CENTAVOS (inteiro). Dinheiro guardado como número quebrado
-- acumula erro de arredondamento; centavo inteiro nunca erra.
create table if not exists public.zc_tariffs (
  id                            uuid primary key default gen_random_uuid(),
  name                          text not null,
  region_id                     uuid references public.zc_regions(id) on delete cascade,
  category_id                   uuid not null references public.zc_vehicle_categories(id) on delete cascade,
  currency                      char(3) not null default 'BRL',

  base_fare_cents               integer not null default 0 check (base_fare_cents >= 0),
  price_per_km_cents            integer not null default 0 check (price_per_km_cents >= 0),
  price_per_minute_cents        integer not null default 0 check (price_per_minute_cents >= 0),
  minimum_fare_cents            integer not null default 0 check (minimum_fare_cents >= 0),
  extra_stop_cents              integer not null default 0 check (extra_stop_cents >= 0),
  helper_cents                  integer not null default 0 check (helper_cents >= 0),
  waiting_per_minute_cents      integer not null default 0 check (waiting_per_minute_cents >= 0),
  free_waiting_minutes          smallint not null default 15 check (free_waiting_minutes >= 0),

  -- Imediato custa mais caro que agendado. Regra do produto: +35%.
  immediate_surcharge_pct       numeric(6,3) not null default 35.000 check (immediate_surcharge_pct >= 0),
  night_surcharge_pct           numeric(6,3) not null default 0 check (night_surcharge_pct >= 0),
  night_start                   time not null default '22:00',
  night_end                     time not null default '06:00',
  weekend_surcharge_pct         numeric(6,3) not null default 0 check (weekend_surcharge_pct >= 0),

  platform_commission_pct       numeric(6,3) not null default 20.000
                                  check (platform_commission_pct >= 0 and platform_commission_pct <= 100),
  cancellation_fee_cents        integer not null default 0 check (cancellation_fee_cents >= 0),
  cancellation_free_seconds     integer not null default 300 check (cancellation_free_seconds >= 0),

  active                        boolean not null default true,
  valid_from                    timestamptz not null default now(),
  valid_to                      timestamptz,
  metadata                      jsonb not null default '{}'::jsonb,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  deleted_at                    timestamptz,
  constraint zc_tariffs_valid_window check (valid_to is null or valid_to > valid_from)
);

-- Uma única tarifa vigente por (região, categoria). É como o cardápio só
-- poder ter um preço válido por prato: se tentar pendurar dois, trava.
create unique index if not exists zc_tariffs_current_key
  on public.zc_tariffs (coalesce(region_id, '00000000-0000-0000-0000-000000000000'::uuid), category_id)
  where active and deleted_at is null and valid_to is null;

create index if not exists zc_tariffs_lookup_idx
  on public.zc_tariffs (category_id, region_id) where active and deleted_at is null;

drop trigger if exists zc_tariffs_updated_at on public.zc_tariffs;
create trigger zc_tariffs_updated_at before update on public.zc_tariffs
  for each row execute function public.zc_set_updated_at();

-- ---------------------------------------------------------------------
-- 8. Clientes
-- ---------------------------------------------------------------------
create table if not exists public.zc_customers (
  id                     uuid primary key default gen_random_uuid(),
  profile_id             uuid not null references public.zc_profiles(id) on delete cascade,
  default_region_id      uuid references public.zc_regions(id) on delete set null,
  default_payment_method text,
  company_name           text,
  rating_avg             numeric(3,2) not null default 5.00 check (rating_avg between 0 and 5),
  rating_count           integer not null default 0 check (rating_count >= 0),
  rides_count            integer not null default 0 check (rides_count >= 0),
  metadata               jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);

create unique index if not exists zc_customers_profile_key
  on public.zc_customers (profile_id) where deleted_at is null;

drop trigger if exists zc_customers_updated_at on public.zc_customers;
create trigger zc_customers_updated_at before update on public.zc_customers
  for each row execute function public.zc_set_updated_at();

-- ---------------------------------------------------------------------
-- 9. Motoristas / carreteiros
-- ---------------------------------------------------------------------
create table if not exists public.zc_drivers (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.zc_profiles(id) on delete cascade,
  region_id           uuid references public.zc_regions(id) on delete set null,
  status              public.zc_driver_status not null default 'pending_documents',
  availability        public.zc_driver_availability not null default 'offline',
  current_vehicle_id  uuid,                        -- FK adicionada após zc_vehicles
  cnh_number          text,
  cnh_category        text,
  cnh_expires_at      date,
  pix_key             text,
  pix_key_type        text check (pix_key_type is null or pix_key_type in ('cpf','cnpj','email','phone','random')),
  bank_account        jsonb not null default '{}'::jsonb,
  rating_avg          numeric(3,2) not null default 5.00 check (rating_avg between 0 and 5),
  rating_count        integer not null default 0 check (rating_count >= 0),
  rides_count         integer not null default 0 check (rides_count >= 0),
  acceptance_rate     numeric(5,2) not null default 100.00 check (acceptance_rate between 0 and 100),
  cancellation_rate   numeric(5,2) not null default 0 check (cancellation_rate between 0 and 100),
  approved_at         timestamptz,
  approved_by         uuid references auth.users(id) on delete set null,
  rejection_reason    text,
  suspended_until     timestamptz,
  last_online_at      timestamptz,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create unique index if not exists zc_drivers_profile_key
  on public.zc_drivers (profile_id) where deleted_at is null;
create index if not exists zc_drivers_status_idx on public.zc_drivers (status) where deleted_at is null;
create index if not exists zc_drivers_availability_idx
  on public.zc_drivers (availability, region_id) where deleted_at is null;

drop trigger if exists zc_drivers_updated_at on public.zc_drivers;
create trigger zc_drivers_updated_at before update on public.zc_drivers
  for each row execute function public.zc_set_updated_at();

-- ---------------------------------------------------------------------
-- 10. Veículos
-- ---------------------------------------------------------------------
create table if not exists public.zc_vehicles (
  id           uuid primary key default gen_random_uuid(),
  driver_id    uuid not null references public.zc_drivers(id) on delete cascade,
  category_id  uuid not null references public.zc_vehicle_categories(id) on delete restrict,
  plate        text not null,
  brand        text,
  model        text,
  model_year   smallint check (model_year is null or model_year between 1950 and 2100),
  color        text,
  capacity_kg  integer check (capacity_kg is null or capacity_kg > 0),
  body_type    text,
  has_tarp     boolean not null default false,
  active       boolean not null default true,
  verified_at  timestamptz,
  verified_by  uuid references auth.users(id) on delete set null,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create unique index if not exists zc_vehicles_plate_key
  on public.zc_vehicles (upper(plate)) where deleted_at is null;
create index if not exists zc_vehicles_driver_idx on public.zc_vehicles (driver_id) where deleted_at is null;

drop trigger if exists zc_vehicles_updated_at on public.zc_vehicles;
create trigger zc_vehicles_updated_at before update on public.zc_vehicles
  for each row execute function public.zc_set_updated_at();

do $$ begin
  alter table public.zc_drivers
    add constraint zc_drivers_current_vehicle_fkey
    foreign key (current_vehicle_id) references public.zc_vehicles(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 11. Documentos (do motorista ou do veículo)
-- ---------------------------------------------------------------------
create table if not exists public.zc_documents (
  id               uuid primary key default gen_random_uuid(),
  owner_kind       public.zc_document_owner not null,
  driver_id        uuid references public.zc_drivers(id) on delete cascade,
  vehicle_id       uuid references public.zc_vehicles(id) on delete cascade,
  type             public.zc_document_type not null,
  status           public.zc_document_status not null default 'pending',
  storage_path     text not null,
  file_name        text,
  mime_type        text,
  issued_at        date,
  expires_at       date,
  reviewed_by      uuid references auth.users(id) on delete set null,
  reviewed_at      timestamptz,
  rejection_reason text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint zc_documents_owner_check check (
    (owner_kind = 'driver'  and driver_id is not null and vehicle_id is null) or
    (owner_kind = 'vehicle' and vehicle_id is not null)
  )
);

create index if not exists zc_documents_driver_idx on public.zc_documents (driver_id) where deleted_at is null;
create index if not exists zc_documents_vehicle_idx on public.zc_documents (vehicle_id) where deleted_at is null;
create index if not exists zc_documents_status_idx on public.zc_documents (status) where deleted_at is null;

drop trigger if exists zc_documents_updated_at on public.zc_documents;
create trigger zc_documents_updated_at before update on public.zc_documents
  for each row execute function public.zc_set_updated_at();

-- ---------------------------------------------------------------------
-- 12. Endereços salvos do cliente
-- ---------------------------------------------------------------------
create table if not exists public.zc_addresses (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.zc_profiles(id) on delete cascade,
  label        text,
  street       text not null,
  number       text,
  complement   text,
  district     text,
  city         text not null,
  state        char(2) not null,
  postal_code  text,
  country      char(2) not null default 'BR',
  lat          numeric(10,7),
  lng          numeric(10,7),
  reference    text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists zc_addresses_profile_idx on public.zc_addresses (profile_id) where deleted_at is null;
create unique index if not exists zc_addresses_single_default
  on public.zc_addresses (profile_id) where is_default and deleted_at is null;

drop trigger if exists zc_addresses_updated_at on public.zc_addresses;
create trigger zc_addresses_updated_at before update on public.zc_addresses
  for each row execute function public.zc_set_updated_at();

-- ---------------------------------------------------------------------
-- 13. Configurações da plataforma (chave/valor, editável no admin)
-- ---------------------------------------------------------------------
create table if not exists public.zc_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists zc_settings_updated_at on public.zc_settings;
create trigger zc_settings_updated_at before update on public.zc_settings
  for each row execute function public.zc_set_updated_at();

-- ---------------------------------------------------------------------
-- 14. Auditoria — quem fez o quê (usada por todos os módulos)
-- ---------------------------------------------------------------------
create table if not exists public.zc_audit_logs (
  id                bigserial primary key,
  actor_profile_id  uuid references public.zc_profiles(id) on delete set null,
  actor_role        public.zc_role,
  action            text not null,
  entity_table      text not null,
  entity_id         text,
  before            jsonb,
  after             jsonb,
  ip                inet,
  user_agent        text,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists zc_audit_logs_entity_idx on public.zc_audit_logs (entity_table, entity_id, created_at desc);
create index if not exists zc_audit_logs_actor_idx on public.zc_audit_logs (actor_profile_id, created_at desc);

-- ---------------------------------------------------------------------
-- 15. Funções auxiliares de identidade (usadas nas políticas de RLS)
-- ---------------------------------------------------------------------
create or replace function public.zc_current_driver_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select d.id from public.zc_drivers d
  where d.profile_id = auth.uid() and d.deleted_at is null
  limit 1;
$$;

create or replace function public.zc_current_customer_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select c.id from public.zc_customers c
  where c.profile_id = auth.uid() and c.deleted_at is null
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- 16. RLS — a tranca de cada gaveta
-- ---------------------------------------------------------------------
alter table public.zc_profiles           enable row level security;
alter table public.zc_user_roles         enable row level security;
alter table public.zc_regions            enable row level security;
alter table public.zc_vehicle_categories enable row level security;
alter table public.zc_tariffs            enable row level security;
alter table public.zc_customers          enable row level security;
alter table public.zc_drivers            enable row level security;
alter table public.zc_vehicles           enable row level security;
alter table public.zc_documents          enable row level security;
alter table public.zc_addresses          enable row level security;
alter table public.zc_settings           enable row level security;
alter table public.zc_audit_logs         enable row level security;

-- Perfis: cada um vê e edita o próprio; admin vê todos.
drop policy if exists "zc profiles select own" on public.zc_profiles;
create policy "zc profiles select own" on public.zc_profiles
  for select to authenticated using (id = auth.uid() or public.zc_is_admin());

drop policy if exists "zc profiles insert own" on public.zc_profiles;
create policy "zc profiles insert own" on public.zc_profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "zc profiles update own" on public.zc_profiles;
create policy "zc profiles update own" on public.zc_profiles
  for update to authenticated
  using (id = auth.uid() or public.zc_is_admin())
  with check (id = auth.uid() or public.zc_is_admin());

drop policy if exists "zc profiles admin delete" on public.zc_profiles;
create policy "zc profiles admin delete" on public.zc_profiles
  for delete to authenticated using (public.zc_is_admin());

-- Papéis: leitura do próprio; só admin concede/remove.
drop policy if exists "zc roles select own" on public.zc_user_roles;
create policy "zc roles select own" on public.zc_user_roles
  for select to authenticated using (user_id = auth.uid() or public.zc_is_admin());

drop policy if exists "zc roles admin manage" on public.zc_user_roles;
create policy "zc roles admin manage" on public.zc_user_roles
  for all to authenticated
  using (public.zc_is_admin()) with check (public.zc_is_admin());

-- Catálogo (regiões, categorias, tarifas): leitura pública do que está
-- ativo; escrita só do admin.
drop policy if exists "zc regions public read" on public.zc_regions;
create policy "zc regions public read" on public.zc_regions
  for select to anon, authenticated using ((active and deleted_at is null) or public.zc_is_admin());

drop policy if exists "zc regions admin write" on public.zc_regions;
create policy "zc regions admin write" on public.zc_regions
  for all to authenticated using (public.zc_is_admin()) with check (public.zc_is_admin());

drop policy if exists "zc categories public read" on public.zc_vehicle_categories;
create policy "zc categories public read" on public.zc_vehicle_categories
  for select to anon, authenticated using ((active and deleted_at is null) or public.zc_is_admin());

drop policy if exists "zc categories admin write" on public.zc_vehicle_categories;
create policy "zc categories admin write" on public.zc_vehicle_categories
  for all to authenticated using (public.zc_is_admin()) with check (public.zc_is_admin());

drop policy if exists "zc tariffs public read" on public.zc_tariffs;
create policy "zc tariffs public read" on public.zc_tariffs
  for select to anon, authenticated using ((active and deleted_at is null) or public.zc_is_admin());

drop policy if exists "zc tariffs admin write" on public.zc_tariffs;
create policy "zc tariffs admin write" on public.zc_tariffs
  for all to authenticated using (public.zc_is_admin()) with check (public.zc_is_admin());

-- Clientes
drop policy if exists "zc customers select own" on public.zc_customers;
create policy "zc customers select own" on public.zc_customers
  for select to authenticated using (profile_id = auth.uid() or public.zc_is_admin());

drop policy if exists "zc customers insert own" on public.zc_customers;
create policy "zc customers insert own" on public.zc_customers
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists "zc customers update own" on public.zc_customers;
create policy "zc customers update own" on public.zc_customers
  for update to authenticated
  using (profile_id = auth.uid() or public.zc_is_admin())
  with check (profile_id = auth.uid() or public.zc_is_admin());

-- Motoristas: o próprio motorista e o admin. O cliente só enxerga o
-- motorista da corrida dele — e isso passa pelo servidor, não pelo banco.
drop policy if exists "zc drivers select own" on public.zc_drivers;
create policy "zc drivers select own" on public.zc_drivers
  for select to authenticated using (profile_id = auth.uid() or public.zc_is_admin());

drop policy if exists "zc drivers insert own" on public.zc_drivers;
create policy "zc drivers insert own" on public.zc_drivers
  for insert to authenticated with check (profile_id = auth.uid());

-- O motorista pode editar o próprio cadastro, mas NUNCA o campo `status`:
-- aprovar motorista é decisão do admin. Quem faz isso é o servidor.
drop policy if exists "zc drivers update own" on public.zc_drivers;
create policy "zc drivers update own" on public.zc_drivers
  for update to authenticated
  using (profile_id = auth.uid() or public.zc_is_admin())
  with check (profile_id = auth.uid() or public.zc_is_admin());

drop policy if exists "zc drivers admin delete" on public.zc_drivers;
create policy "zc drivers admin delete" on public.zc_drivers
  for delete to authenticated using (public.zc_is_admin());

-- Veículos
drop policy if exists "zc vehicles owner all" on public.zc_vehicles;
create policy "zc vehicles owner all" on public.zc_vehicles
  for all to authenticated
  using (driver_id = public.zc_current_driver_id() or public.zc_is_admin())
  with check (driver_id = public.zc_current_driver_id() or public.zc_is_admin());

-- Documentos
drop policy if exists "zc documents owner all" on public.zc_documents;
create policy "zc documents owner all" on public.zc_documents
  for all to authenticated
  using (
    public.zc_is_admin()
    or driver_id = public.zc_current_driver_id()
    or vehicle_id in (select v.id from public.zc_vehicles v where v.driver_id = public.zc_current_driver_id())
  )
  with check (
    public.zc_is_admin()
    or driver_id = public.zc_current_driver_id()
    or vehicle_id in (select v.id from public.zc_vehicles v where v.driver_id = public.zc_current_driver_id())
  );

-- Endereços
drop policy if exists "zc addresses owner all" on public.zc_addresses;
create policy "zc addresses owner all" on public.zc_addresses
  for all to authenticated
  using (profile_id = auth.uid() or public.zc_is_admin())
  with check (profile_id = auth.uid() or public.zc_is_admin());

-- Configurações: leitura para logados, escrita só do admin.
drop policy if exists "zc settings read" on public.zc_settings;
create policy "zc settings read" on public.zc_settings
  for select to anon, authenticated using (true);

drop policy if exists "zc settings admin write" on public.zc_settings;
create policy "zc settings admin write" on public.zc_settings
  for all to authenticated using (public.zc_is_admin()) with check (public.zc_is_admin());

-- Auditoria: só admin lê. Escrita é sempre pelo servidor (service_role).
drop policy if exists "zc audit admin read" on public.zc_audit_logs;
create policy "zc audit admin read" on public.zc_audit_logs
  for select to authenticated using (public.zc_is_admin());

-- ---------------------------------------------------------------------
-- 17. Permissões de tabela
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.zc_regions, public.zc_vehicle_categories, public.zc_tariffs, public.zc_settings
  to anon, authenticated;
grant select, insert, update on
  public.zc_profiles, public.zc_customers, public.zc_drivers, public.zc_vehicles,
  public.zc_documents, public.zc_addresses
  to authenticated;
grant select on public.zc_user_roles, public.zc_audit_logs to authenticated;

-- =====================================================================
-- ZÉ CARRETO — FASE 1 (3/4): pagamento, carteira, repasse, avaliação,
--                            notificação e suporte
-- =====================================================================
-- Regra de ouro deste arquivo: dinheiro é livro-caixa, não é rascunho.
-- Cada centavo entra como uma LINHA nova (crédito ou débito) e nunca é
-- apagado nem editado. É como o caderninho do caixa: se errou, você
-- escreve um estorno na linha de baixo — não passa corretivo na de cima.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.zc_payment_method as enum ('pix', 'credit_card', 'debit_card', 'cash', 'wallet');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_payment_status as enum (
    'pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded', 'cancelled', 'chargeback'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_transaction_kind as enum (
    'ride_earning', 'platform_commission', 'tip', 'cancellation_fee',
    'payout', 'payout_reversal', 'adjustment_credit', 'adjustment_debit', 'refund', 'bonus'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_transaction_status as enum ('pending', 'available', 'settled', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_payout_status as enum ('scheduled', 'processing', 'paid', 'failed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_rating_direction as enum ('client_to_driver', 'driver_to_client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_notification_channel as enum ('in_app', 'push', 'sms', 'email', 'whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_notification_status as enum ('queued', 'sent', 'failed', 'read');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_ticket_status as enum ('open', 'pending_user', 'pending_support', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zc_ticket_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Pagamentos
-- ---------------------------------------------------------------------
create table if not exists public.zc_payments (
  id                  uuid primary key default gen_random_uuid(),
  ride_id             uuid references public.zc_rides(id) on delete set null,
  customer_profile_id uuid not null references public.zc_profiles(id) on delete restrict,
  method              public.zc_payment_method not null,
  status              public.zc_payment_status not null default 'pending',
  amount_cents        integer not null check (amount_cents >= 0),
  refunded_cents      integer not null default 0 check (refunded_cents >= 0),
  currency            char(3) not null default 'BRL',
  provider            text not null default 'manual',
  provider_payment_id text,
  provider_payload    jsonb not null default '{}'::jsonb,
  idempotency_key     text,
  authorized_at       timestamptz,
  paid_at             timestamptz,
  refunded_at         timestamptz,
  failed_at           timestamptz,
  failure_reason      text,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint zc_payments_refund_bounds check (refunded_cents <= amount_cents)
);

create unique index if not exists zc_payments_idempotency_key
  on public.zc_payments (idempotency_key) where idempotency_key is not null;
create unique index if not exists zc_payments_provider_key
  on public.zc_payments (provider, provider_payment_id) where provider_payment_id is not null;
-- Um único pagamento vivo por corrida.
create unique index if not exists zc_payments_active_per_ride
  on public.zc_payments (ride_id)
  where ride_id is not null and status in ('pending','authorized','paid','partially_refunded');
create index if not exists zc_payments_customer_idx
  on public.zc_payments (customer_profile_id, created_at desc);

drop trigger if exists zc_payments_updated_at on public.zc_payments;
create trigger zc_payments_updated_at before update on public.zc_payments
  for each row execute function public.zc_set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Carteira do motorista
-- ---------------------------------------------------------------------
create table if not exists public.zc_wallets (
  id                      uuid primary key default gen_random_uuid(),
  driver_id               uuid not null references public.zc_drivers(id) on delete cascade,
  currency                char(3) not null default 'BRL',
  -- "pending" = corrida feita, dinheiro ainda maturando.
  -- "available" = já pode entrar no repasse da semana.
  balance_pending_cents   bigint not null default 0,
  balance_available_cents bigint not null default 0,
  total_earned_cents      bigint not null default 0 check (total_earned_cents >= 0),
  total_paid_out_cents    bigint not null default 0 check (total_paid_out_cents >= 0),
  blocked                 boolean not null default false,
  blocked_reason          text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (driver_id)
);

drop trigger if exists zc_wallets_updated_at on public.zc_wallets;
create trigger zc_wallets_updated_at before update on public.zc_wallets
  for each row execute function public.zc_set_updated_at();

-- Toda carteira nasce junto com o motorista.
create or replace function public.zc_drivers_create_wallet()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.zc_wallets (driver_id) values (new.id)
  on conflict (driver_id) do nothing;
  return new;
end;
$$;

drop trigger if exists zc_drivers_create_wallet on public.zc_drivers;
create trigger zc_drivers_create_wallet after insert on public.zc_drivers
  for each row execute function public.zc_drivers_create_wallet();

-- ---------------------------------------------------------------------
-- 4. Transações (livro-caixa)
-- ---------------------------------------------------------------------
create table if not exists public.zc_wallet_transactions (
  id                 uuid primary key default gen_random_uuid(),
  wallet_id          uuid not null references public.zc_wallets(id) on delete restrict,
  driver_id          uuid not null references public.zc_drivers(id) on delete restrict,
  ride_id            uuid references public.zc_rides(id) on delete set null,
  payout_id          uuid,                     -- FK adicionada após zc_payouts
  kind               public.zc_transaction_kind not null,
  status             public.zc_transaction_status not null default 'pending',
  -- Positivo entra, negativo sai. Zero não é lançamento.
  amount_cents       bigint not null check (amount_cents <> 0),
  balance_after_cents bigint not null default 0,
  currency           char(3) not null default 'BRL',
  description        text,
  reference          text,
  available_at       timestamptz,
  settled_at         timestamptz,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists zc_wallet_tx_wallet_idx
  on public.zc_wallet_transactions (wallet_id, created_at desc);
create index if not exists zc_wallet_tx_driver_idx
  on public.zc_wallet_transactions (driver_id, status, created_at desc);
create index if not exists zc_wallet_tx_payout_idx on public.zc_wallet_transactions (payout_id);
-- Uma corrida gera um ganho só. Repetiu a chamada? O banco barra.
create unique index if not exists zc_wallet_tx_ride_kind_key
  on public.zc_wallet_transactions (ride_id, kind)
  where ride_id is not null and kind in ('ride_earning', 'platform_commission', 'cancellation_fee');

-- O livro-caixa não se apaga nem se reescreve.
create or replace function public.zc_wallet_tx_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'ZC_LEDGER_IMMUTABLE: lancamento nao pode ser apagado (use estorno)'
      using errcode = 'check_violation';
  end if;
  if new.amount_cents is distinct from old.amount_cents
     or new.wallet_id is distinct from old.wallet_id
     or new.kind is distinct from old.kind
     or new.ride_id is distinct from old.ride_id then
    raise exception 'ZC_LEDGER_IMMUTABLE: valor, carteira, tipo e corrida de um lancamento nao mudam'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists zc_wallet_tx_immutable on public.zc_wallet_transactions;
create trigger zc_wallet_tx_immutable before update or delete on public.zc_wallet_transactions
  for each row execute function public.zc_wallet_tx_immutable();

-- Saldo da carteira acompanha o livro-caixa automaticamente.
create or replace function public.zc_wallet_apply_transaction()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  _pending bigint;
  _available bigint;
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      update public.zc_wallets
         set balance_pending_cents = balance_pending_cents + new.amount_cents,
             total_earned_cents = total_earned_cents + greatest(new.amount_cents, 0)
       where id = new.wallet_id
      returning balance_pending_cents, balance_available_cents into _pending, _available;
    elsif new.status in ('available', 'settled') then
      update public.zc_wallets
         set balance_available_cents = balance_available_cents + new.amount_cents,
             total_earned_cents = total_earned_cents + greatest(new.amount_cents, 0),
             total_paid_out_cents = total_paid_out_cents
               + case when new.kind = 'payout' then abs(least(new.amount_cents, 0)) else 0 end
       where id = new.wallet_id
      returning balance_pending_cents, balance_available_cents into _pending, _available;
    else
      select balance_pending_cents, balance_available_cents into _pending, _available
      from public.zc_wallets where id = new.wallet_id;
    end if;

    update public.zc_wallet_transactions
       set balance_after_cents = coalesce(_pending, 0) + coalesce(_available, 0)
     where id = new.id;
    return null;
  end if;

  -- Mudança de estado do lançamento move o dinheiro entre "maturando" e
  -- "disponível" — sem nunca alterar o valor lançado.
  if new.status is distinct from old.status then
    if old.status = 'pending' and new.status = 'available' then
      update public.zc_wallets
         set balance_pending_cents = balance_pending_cents - old.amount_cents,
             balance_available_cents = balance_available_cents + old.amount_cents
       where id = old.wallet_id;
    elsif old.status = 'pending' and new.status = 'cancelled' then
      update public.zc_wallets
         set balance_pending_cents = balance_pending_cents - old.amount_cents,
             total_earned_cents = total_earned_cents - greatest(old.amount_cents, 0)
       where id = old.wallet_id;
    elsif old.status = 'available' and new.status = 'cancelled' then
      update public.zc_wallets
         set balance_available_cents = balance_available_cents - old.amount_cents,
             total_earned_cents = total_earned_cents - greatest(old.amount_cents, 0)
       where id = old.wallet_id;
    elsif old.status = 'available' and new.status = 'settled' and new.kind = 'payout' then
      update public.zc_wallets
         set total_paid_out_cents = total_paid_out_cents + abs(least(old.amount_cents, 0))
       where id = old.wallet_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists zc_wallet_apply_transaction on public.zc_wallet_transactions;
create trigger zc_wallet_apply_transaction after insert or update on public.zc_wallet_transactions
  for each row execute function public.zc_wallet_apply_transaction();

-- Conferência: recalcula o saldo a partir do livro-caixa inteiro.
create or replace function public.zc_wallet_recompute(_wallet_id uuid)
returns public.zc_wallets
language plpgsql security definer set search_path = public
as $$
declare
  _w public.zc_wallets;
begin
  update public.zc_wallets w
     set balance_pending_cents = coalesce((
           select sum(t.amount_cents) from public.zc_wallet_transactions t
           where t.wallet_id = w.id and t.status = 'pending'), 0),
         balance_available_cents = coalesce((
           select sum(t.amount_cents) from public.zc_wallet_transactions t
           where t.wallet_id = w.id and t.status in ('available','settled')), 0),
         total_earned_cents = coalesce((
           select sum(t.amount_cents) from public.zc_wallet_transactions t
           where t.wallet_id = w.id and t.amount_cents > 0 and t.status <> 'cancelled'), 0),
         total_paid_out_cents = coalesce((
           select sum(abs(t.amount_cents)) from public.zc_wallet_transactions t
           where t.wallet_id = w.id and t.kind = 'payout' and t.status in ('available','settled')), 0)
   where w.id = _wallet_id
  returning * into _w;
  return _w;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Repasses semanais
-- ---------------------------------------------------------------------
create table if not exists public.zc_payouts (
  id             uuid primary key default gen_random_uuid(),
  driver_id      uuid not null references public.zc_drivers(id) on delete restrict,
  wallet_id      uuid not null references public.zc_wallets(id) on delete restrict,
  period_start   date not null,
  period_end     date not null,
  gross_cents    bigint not null default 0 check (gross_cents >= 0),
  fees_cents     bigint not null default 0 check (fees_cents >= 0),
  net_cents      bigint not null default 0 check (net_cents >= 0),
  currency       char(3) not null default 'BRL',
  status         public.zc_payout_status not null default 'scheduled',
  method         text not null default 'pix',
  pix_key        text,
  pix_key_type   text,
  scheduled_for  date,
  processed_at   timestamptz,
  failed_at      timestamptz,
  failure_reason text,
  external_id    text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint zc_payouts_period check (period_end >= period_start)
);

-- Uma semana, um repasse por motorista. Fechar duas vezes não duplica.
create unique index if not exists zc_payouts_period_key
  on public.zc_payouts (driver_id, period_start, period_end)
  where status <> 'cancelled';
create index if not exists zc_payouts_driver_idx on public.zc_payouts (driver_id, period_start desc);
create index if not exists zc_payouts_status_idx on public.zc_payouts (status, scheduled_for);

drop trigger if exists zc_payouts_updated_at on public.zc_payouts;
create trigger zc_payouts_updated_at before update on public.zc_payouts
  for each row execute function public.zc_set_updated_at();

do $$ begin
  alter table public.zc_wallet_transactions
    add constraint zc_wallet_tx_payout_fkey
    foreign key (payout_id) references public.zc_payouts(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.zc_payout_items (
  id             uuid primary key default gen_random_uuid(),
  payout_id      uuid not null references public.zc_payouts(id) on delete cascade,
  transaction_id uuid not null references public.zc_wallet_transactions(id) on delete restrict,
  amount_cents   bigint not null,
  created_at     timestamptz not null default now(),
  unique (transaction_id)
);

create index if not exists zc_payout_items_payout_idx on public.zc_payout_items (payout_id);

-- ---------------------------------------------------------------------
-- 6. Avaliações
-- ---------------------------------------------------------------------
create table if not exists public.zc_ratings (
  id               uuid primary key default gen_random_uuid(),
  ride_id          uuid not null references public.zc_rides(id) on delete cascade,
  direction        public.zc_rating_direction not null,
  rater_profile_id uuid not null references public.zc_profiles(id) on delete cascade,
  ratee_profile_id uuid not null references public.zc_profiles(id) on delete cascade,
  stars            smallint not null check (stars between 1 and 5),
  comment          text,
  tags             text[] not null default '{}',
  created_at       timestamptz not null default now(),
  unique (ride_id, direction)
);

create index if not exists zc_ratings_ratee_idx on public.zc_ratings (ratee_profile_id, created_at desc);

-- A média do motorista/cliente se atualiza sozinha a cada avaliação.
create or replace function public.zc_ratings_apply()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.direction = 'client_to_driver' then
    update public.zc_drivers d
       set rating_count = d.rating_count + 1,
           rating_avg = round(((d.rating_avg * d.rating_count) + new.stars) / (d.rating_count + 1), 2)
     where d.profile_id = new.ratee_profile_id;
  else
    update public.zc_customers c
       set rating_count = c.rating_count + 1,
           rating_avg = round(((c.rating_avg * c.rating_count) + new.stars) / (c.rating_count + 1), 2)
     where c.profile_id = new.ratee_profile_id;
  end if;
  return null;
end;
$$;

drop trigger if exists zc_ratings_apply on public.zc_ratings;
create trigger zc_ratings_apply after insert on public.zc_ratings
  for each row execute function public.zc_ratings_apply();

-- ---------------------------------------------------------------------
-- 7. Notificações
-- ---------------------------------------------------------------------
create table if not exists public.zc_notifications (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.zc_profiles(id) on delete cascade,
  ride_id      uuid references public.zc_rides(id) on delete set null,
  channel      public.zc_notification_channel not null default 'in_app',
  type         text not null,
  title        text not null,
  body         text,
  data         jsonb not null default '{}'::jsonb,
  status       public.zc_notification_status not null default 'queued',
  dedupe_key   text,
  sent_at      timestamptz,
  read_at      timestamptz,
  failed_at    timestamptz,
  error        text,
  created_at   timestamptz not null default now()
);

create index if not exists zc_notifications_profile_idx
  on public.zc_notifications (profile_id, created_at desc);
create index if not exists zc_notifications_unread_idx
  on public.zc_notifications (profile_id) where read_at is null;
create unique index if not exists zc_notifications_dedupe_key
  on public.zc_notifications (profile_id, dedupe_key) where dedupe_key is not null;

-- ---------------------------------------------------------------------
-- 8. Suporte
-- ---------------------------------------------------------------------
create table if not exists public.zc_support_tickets (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  profile_id  uuid not null references public.zc_profiles(id) on delete cascade,
  ride_id     uuid references public.zc_rides(id) on delete set null,
  subject     text not null,
  category    text not null default 'general',
  status      public.zc_ticket_status not null default 'open',
  priority    public.zc_ticket_priority not null default 'normal',
  assigned_to uuid references public.zc_profiles(id) on delete set null,
  resolved_at timestamptz,
  closed_at   timestamptz,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists zc_support_tickets_code_key on public.zc_support_tickets (code);
create index if not exists zc_support_tickets_profile_idx
  on public.zc_support_tickets (profile_id, created_at desc);
create index if not exists zc_support_tickets_status_idx on public.zc_support_tickets (status, priority);

drop trigger if exists zc_support_tickets_updated_at on public.zc_support_tickets;
create trigger zc_support_tickets_updated_at before update on public.zc_support_tickets
  for each row execute function public.zc_set_updated_at();

create or replace function public.zc_support_set_code()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'SUP-' || to_char(now(), 'YYMM') || '-' ||
                upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end if;
  return new;
end;
$$;

drop trigger if exists zc_support_set_code on public.zc_support_tickets;
create trigger zc_support_set_code before insert on public.zc_support_tickets
  for each row execute function public.zc_support_set_code();

create table if not exists public.zc_support_messages (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid not null references public.zc_support_tickets(id) on delete cascade,
  author_profile_id uuid references public.zc_profiles(id) on delete set null,
  is_staff         boolean not null default false,
  body             text not null,
  attachments      jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists zc_support_messages_ticket_idx
  on public.zc_support_messages (ticket_id, created_at);

-- ---------------------------------------------------------------------
-- 9. RLS
-- ---------------------------------------------------------------------
alter table public.zc_payments           enable row level security;
alter table public.zc_wallets            enable row level security;
alter table public.zc_wallet_transactions enable row level security;
alter table public.zc_payouts            enable row level security;
alter table public.zc_payout_items       enable row level security;
alter table public.zc_ratings            enable row level security;
alter table public.zc_notifications      enable row level security;
alter table public.zc_support_tickets    enable row level security;
alter table public.zc_support_messages   enable row level security;

-- Pagamento: o cliente vê o dele; o motorista vê o da corrida dele.
drop policy if exists "zc payments read" on public.zc_payments;
create policy "zc payments read" on public.zc_payments
  for select to authenticated using (
    customer_profile_id = auth.uid()
    or public.zc_is_admin()
    or exists (select 1 from public.zc_rides r
               where r.id = ride_id and r.driver_id = public.zc_current_driver_id())
  );

drop policy if exists "zc payments admin write" on public.zc_payments;
create policy "zc payments admin write" on public.zc_payments
  for all to authenticated using (public.zc_is_admin()) with check (public.zc_is_admin());

-- Carteira e livro-caixa: leitura do dono, escrita só pelo servidor.
drop policy if exists "zc wallets read own" on public.zc_wallets;
create policy "zc wallets read own" on public.zc_wallets
  for select to authenticated
  using (driver_id = public.zc_current_driver_id() or public.zc_is_admin());

drop policy if exists "zc wallet tx read own" on public.zc_wallet_transactions;
create policy "zc wallet tx read own" on public.zc_wallet_transactions
  for select to authenticated
  using (driver_id = public.zc_current_driver_id() or public.zc_is_admin());

drop policy if exists "zc payouts read own" on public.zc_payouts;
create policy "zc payouts read own" on public.zc_payouts
  for select to authenticated
  using (driver_id = public.zc_current_driver_id() or public.zc_is_admin());

drop policy if exists "zc payout items read own" on public.zc_payout_items;
create policy "zc payout items read own" on public.zc_payout_items
  for select to authenticated using (
    public.zc_is_admin()
    or exists (select 1 from public.zc_payouts p
               where p.id = payout_id and p.driver_id = public.zc_current_driver_id())
  );

-- Avaliações: quem participou da corrida vê; quem participou avalia.
drop policy if exists "zc ratings read" on public.zc_ratings;
create policy "zc ratings read" on public.zc_ratings
  for select to authenticated using (
    rater_profile_id = auth.uid() or ratee_profile_id = auth.uid() or public.zc_is_admin()
  );

drop policy if exists "zc ratings insert own" on public.zc_ratings;
create policy "zc ratings insert own" on public.zc_ratings
  for insert to authenticated with check (
    rater_profile_id = auth.uid()
    and exists (
      select 1 from public.zc_rides r
      where r.id = ride_id
        and r.status = 'completed'
        and (
          (direction = 'client_to_driver' and r.customer_profile_id = auth.uid())
          or (direction = 'driver_to_client' and r.driver_id = public.zc_current_driver_id())
        )
    )
  );

-- Notificações: cada um vê as suas e pode marcar como lida.
drop policy if exists "zc notifications read own" on public.zc_notifications;
create policy "zc notifications read own" on public.zc_notifications
  for select to authenticated using (profile_id = auth.uid() or public.zc_is_admin());

drop policy if exists "zc notifications update own" on public.zc_notifications;
create policy "zc notifications update own" on public.zc_notifications
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Suporte
drop policy if exists "zc tickets own" on public.zc_support_tickets;
create policy "zc tickets own" on public.zc_support_tickets
  for select to authenticated using (profile_id = auth.uid() or public.zc_is_admin());

drop policy if exists "zc tickets insert own" on public.zc_support_tickets;
create policy "zc tickets insert own" on public.zc_support_tickets
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists "zc tickets admin write" on public.zc_support_tickets;
create policy "zc tickets admin write" on public.zc_support_tickets
  for update to authenticated using (public.zc_is_admin()) with check (public.zc_is_admin());

drop policy if exists "zc ticket messages read" on public.zc_support_messages;
create policy "zc ticket messages read" on public.zc_support_messages
  for select to authenticated using (
    public.zc_is_admin()
    or exists (select 1 from public.zc_support_tickets t
               where t.id = ticket_id and t.profile_id = auth.uid())
  );

drop policy if exists "zc ticket messages insert" on public.zc_support_messages;
create policy "zc ticket messages insert" on public.zc_support_messages
  for insert to authenticated with check (
    author_profile_id = auth.uid()
    and (
      public.zc_is_admin()
      or exists (select 1 from public.zc_support_tickets t
                 where t.id = ticket_id and t.profile_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- 10. Tempo real
-- ---------------------------------------------------------------------
do $$
declare
  _tbl text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach _tbl in array array['zc_notifications', 'zc_payments', 'zc_support_messages'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = _tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', _tbl);
    end if;
  end loop;
end $$;

alter table public.zc_notifications    replica identity full;
alter table public.zc_payments         replica identity full;
alter table public.zc_support_messages replica identity full;

-- ---------------------------------------------------------------------
-- 11. Permissões
-- ---------------------------------------------------------------------
grant select on
  public.zc_payments, public.zc_wallets, public.zc_wallet_transactions,
  public.zc_payouts, public.zc_payout_items, public.zc_ratings,
  public.zc_notifications, public.zc_support_tickets, public.zc_support_messages
  to authenticated;
grant insert on public.zc_ratings, public.zc_support_tickets, public.zc_support_messages to authenticated;
grant update on public.zc_notifications to authenticated;
grant execute on function public.zc_wallet_recompute(uuid) to service_role;

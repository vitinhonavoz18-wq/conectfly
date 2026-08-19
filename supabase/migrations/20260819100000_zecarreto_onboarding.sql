-- =====================================================================
-- ZÉ CARRETO — FASE 2: cadastros (cliente, motorista e veículo)
-- =====================================================================
-- O que esta migração faz, em português:
--  1. acerta os nomes dos status do motorista para os combinados;
--  2. dá status próprio ao veículo (um motorista pode ter vários, e cada
--     um é aprovado separadamente);
--  3. guarda o aceite dos termos, com data, versão e de onde veio;
--  4. cria o histórico de alterações — o "livro de quem mexeu em quê";
--  5. cria os lugares seguros para guardar foto, selfie e documento;
--  6. cria a trava: motorista só fica online com cadastro E veículo
--     aprovados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Status do motorista: 'pending_documents' passa a se chamar 'pending'
-- ---------------------------------------------------------------------
-- Renomear preserva os cadastros existentes: é trocar a etiqueta da
-- gaveta, não esvaziar a gaveta.
do $$ begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'zc_driver_status' and e.enumlabel = 'pending_documents'
  ) then
    alter type public.zc_driver_status rename value 'pending_documents' to 'pending';
  end if;
end $$;

-- A selfie de verificação entra como um tipo de documento.
do $$ begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'zc_document_type' and e.enumlabel = 'selfie'
  ) then
    alter type public.zc_document_type add value 'selfie';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Status do veículo
-- ---------------------------------------------------------------------
do $$ begin
  create type public.zc_vehicle_status as enum ('pending', 'approved', 'rejected', 'inactive');
exception when duplicate_object then null; end $$;

alter table public.zc_vehicles
  add column if not exists status public.zc_vehicle_status not null default 'pending',
  add column if not exists rejection_reason text,
  add column if not exists photos jsonb not null default '[]'::jsonb,
  add column if not exists notes text,
  add column if not exists reviewed_at timestamptz;

-- Veículos que já existiam herdam o status coerente com o que estava lá.
update public.zc_vehicles
   set status = case
         when not active then 'inactive'::public.zc_vehicle_status
         when verified_at is not null then 'approved'::public.zc_vehicle_status
         else 'pending'::public.zc_vehicle_status
       end
 where status = 'pending' and (verified_at is not null or not active);

create index if not exists zc_vehicles_status_idx
  on public.zc_vehicles (status) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 3. Aceite dos termos
-- ---------------------------------------------------------------------
-- Guardar a versão aceita importa: se os termos mudarem amanhã, dá para
-- saber quem aceitou o quê — como guardar o contrato assinado, e não só
-- um "ele concordou".
create table if not exists public.zc_terms_acceptances (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.zc_profiles(id) on delete cascade,
  audience      public.zc_role not null,
  terms_version text not null,
  accepted_at   timestamptz not null default now(),
  ip            inet,
  user_agent    text,
  unique (profile_id, audience, terms_version)
);

create index if not exists zc_terms_profile_idx
  on public.zc_terms_acceptances (profile_id, audience, accepted_at desc);

alter table public.zc_terms_acceptances enable row level security;

drop policy if exists "zc terms read own" on public.zc_terms_acceptances;
create policy "zc terms read own" on public.zc_terms_acceptances
  for select to authenticated using (profile_id = auth.uid() or public.zc_is_admin());

drop policy if exists "zc terms insert own" on public.zc_terms_acceptances;
create policy "zc terms insert own" on public.zc_terms_acceptances
  for insert to authenticated with check (profile_id = auth.uid());

grant select, insert on public.zc_terms_acceptances to authenticated;

-- ---------------------------------------------------------------------
-- 4. Histórico de alterações
-- ---------------------------------------------------------------------
-- Uma linha por campo alterado. Dados sensíveis entram MASCARADOS: o
-- histórico serve para saber que o CPF mudou, não para virar uma segunda
-- cópia do CPF de todo mundo.
create table if not exists public.zc_record_history (
  id            bigserial primary key,
  entity_table  text not null,
  entity_id     text not null,
  field         text not null,
  old_value     text,
  new_value     text,
  is_masked     boolean not null default false,
  changed_by    uuid references public.zc_profiles(id) on delete set null,
  reason        text,
  created_at    timestamptz not null default now()
);

create index if not exists zc_record_history_entity_idx
  on public.zc_record_history (entity_table, entity_id, created_at desc);
create index if not exists zc_record_history_actor_idx
  on public.zc_record_history (changed_by, created_at desc);

-- Campos que nunca aparecem por extenso no histórico.
create or replace function public.zc_mask_value(_field text, _value text)
returns text
language plpgsql immutable
as $$
declare
  _len int;
begin
  if _value is null or _value = '' then return _value; end if;
  _len := length(_value);
  if _len <= 4 then return repeat('*', _len); end if;
  return repeat('*', _len - 4) || right(_value, 4);
end;
$$;

create or replace function public.zc_history_trigger()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  _sensitive text[] := array[
    'document_number', 'cnh_number', 'pix_key', 'bank_account',
    'phone', 'email', 'storage_path'
  ];
  _ignored text[] := array['updated_at', 'created_at', 'metadata'];
  _old jsonb := to_jsonb(old);
  _new jsonb := to_jsonb(new);
  _key text;
  _old_text text;
  _new_text text;
  _masked boolean;
  _actor uuid := public.zc_current_actor();
begin
  for _key in select jsonb_object_keys(_new) loop
    continue when _key = any(_ignored);
    _old_text := nullif(_old ->> _key, '');
    _new_text := nullif(_new ->> _key, '');
    continue when _old_text is not distinct from _new_text;

    _masked := _key = any(_sensitive);
    insert into public.zc_record_history
      (entity_table, entity_id, field, old_value, new_value, is_masked, changed_by)
    values (
      tg_table_name,
      (_new ->> 'id'),
      _key,
      case when _masked then public.zc_mask_value(_key, _old_text) else left(_old_text, 500) end,
      case when _masked then public.zc_mask_value(_key, _new_text) else left(_new_text, 500) end,
      _masked,
      _actor
    );
  end loop;
  return null;
end;
$$;

drop trigger if exists zc_profiles_history on public.zc_profiles;
create trigger zc_profiles_history after update on public.zc_profiles
  for each row execute function public.zc_history_trigger();

drop trigger if exists zc_drivers_history on public.zc_drivers;
create trigger zc_drivers_history after update on public.zc_drivers
  for each row execute function public.zc_history_trigger();

drop trigger if exists zc_vehicles_history on public.zc_vehicles;
create trigger zc_vehicles_history after update on public.zc_vehicles
  for each row execute function public.zc_history_trigger();

drop trigger if exists zc_documents_history on public.zc_documents;
create trigger zc_documents_history after update on public.zc_documents
  for each row execute function public.zc_history_trigger();

alter table public.zc_record_history enable row level security;

-- O dono vê o histórico do próprio cadastro; o admin vê tudo.
drop policy if exists "zc history read" on public.zc_record_history;
create policy "zc history read" on public.zc_record_history
  for select to authenticated using (
    public.zc_is_admin()
    or (entity_table = 'zc_profiles' and entity_id = auth.uid()::text)
    or (entity_table = 'zc_drivers'
        and entity_id in (select d.id::text from public.zc_drivers d where d.profile_id = auth.uid()))
    or (entity_table = 'zc_vehicles'
        and entity_id in (
          select v.id::text from public.zc_vehicles v
          where v.driver_id = public.zc_current_driver_id()))
  );

grant select on public.zc_record_history to authenticated;

-- ---------------------------------------------------------------------
-- 5. Trava do "ficar online"
-- ---------------------------------------------------------------------
-- Só fica online quem tem cadastro aprovado E pelo menos um veículo
-- aprovado. É como o táxi: não basta o motorista ter a carteira, o carro
-- também precisa estar vistoriado.
create or replace function public.zc_driver_can_go_online(_driver_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.zc_drivers d
    where d.id = _driver_id
      and d.deleted_at is null
      and d.status = 'approved'
      and (d.suspended_until is null or d.suspended_until < now())
      and exists (
        select 1 from public.zc_vehicles v
        where v.driver_id = d.id
          and v.status = 'approved'
          and v.active
          and v.deleted_at is null
      )
  );
$$;

-- A trava também vale no banco: nem um erro de programação coloca um
-- motorista sem veículo aprovado na fila de ofertas.
create or replace function public.zc_drivers_availability_guard()
returns trigger
language plpgsql set search_path = public
as $$
begin
  -- A trava vale para ENTRAR NO AR ('online'). Ficar 'busy' é consequência
  -- de já ter aceitado um carreto — e para chegar lá o motorista precisou
  -- estar online, então a checagem já aconteceu antes.
  --
  -- Vale na criação também: sem isso, daria para nascer já online e pular
  -- a fila inteira — como entrar na festa pela janela em vez da portaria.
  if new.availability = 'online'
     and (tg_op = 'INSERT' or new.availability is distinct from old.availability) then
    if not public.zc_driver_can_go_online(new.id) then
      raise exception
        'ZC_DRIVER_NOT_READY: motorista % precisa de cadastro e veiculo aprovados para ficar online', new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists zc_drivers_availability_guard on public.zc_drivers;
create trigger zc_drivers_availability_guard before insert or update on public.zc_drivers
  for each row execute function public.zc_drivers_availability_guard();

-- Veículo reprovado/inativado derruba o motorista que ficou sem veículo.
create or replace function public.zc_vehicles_status_sync()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status <> 'approved' then
    if not public.zc_driver_can_go_online(new.driver_id) then
      update public.zc_drivers
         set availability = 'offline'
       where id = new.driver_id and availability <> 'offline';
    end if;
    -- O veículo em uso não pode ser um veículo reprovado.
    update public.zc_drivers
       set current_vehicle_id = null
     where id = new.driver_id and current_vehicle_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists zc_vehicles_status_sync on public.zc_vehicles;
create trigger zc_vehicles_status_sync after update on public.zc_vehicles
  for each row execute function public.zc_vehicles_status_sync();

-- ---------------------------------------------------------------------
-- 6. Onde ficam as fotos e os documentos
-- ---------------------------------------------------------------------
-- Dois armários:
--  • `zc-avatars`  — foto de perfil e fotos do veículo (podem ser vistas);
--  • `zc-documents`— CNH, selfie, comprovantes (armário TRANCADO: só o
--    dono e o administrador conseguem abrir, e por link temporário).
-- Cada pessoa só escreve dentro da própria pasta, identificada pelo id
-- dela. É como o escaninho do vestiário: cada um abre o seu.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public)
    values ('zc-avatars', 'zc-avatars', true)
    on conflict (id) do nothing;

    insert into storage.buckets (id, name, public)
    values ('zc-documents', 'zc-documents', false)
    on conflict (id) do nothing;

    execute $pol$
      drop policy if exists "zc avatars public read" on storage.objects;
      create policy "zc avatars public read" on storage.objects
        for select to anon, authenticated using (bucket_id = 'zc-avatars');

      drop policy if exists "zc avatars owner write" on storage.objects;
      create policy "zc avatars owner write" on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'zc-avatars'
          and (storage.foldername(name))[1] = auth.uid()::text
        );

      drop policy if exists "zc avatars owner update" on storage.objects;
      create policy "zc avatars owner update" on storage.objects
        for update to authenticated
        using (bucket_id = 'zc-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
        with check (bucket_id = 'zc-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

      drop policy if exists "zc avatars owner delete" on storage.objects;
      create policy "zc avatars owner delete" on storage.objects
        for delete to authenticated
        using (bucket_id = 'zc-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

      drop policy if exists "zc documents owner read" on storage.objects;
      create policy "zc documents owner read" on storage.objects
        for select to authenticated
        using (
          bucket_id = 'zc-documents'
          and ((storage.foldername(name))[1] = auth.uid()::text or public.zc_is_admin())
        );

      drop policy if exists "zc documents owner write" on storage.objects;
      create policy "zc documents owner write" on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'zc-documents'
          and (storage.foldername(name))[1] = auth.uid()::text
        );

      drop policy if exists "zc documents owner delete" on storage.objects;
      create policy "zc documents owner delete" on storage.objects
        for delete to authenticated
        using (
          bucket_id = 'zc-documents'
          and ((storage.foldername(name))[1] = auth.uid()::text or public.zc_is_admin())
        );
    $pol$;
  else
    raise notice 'Esquema storage ausente (ambiente local) — políticas de arquivo puladas.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 7. Configurações novas da fase
-- ---------------------------------------------------------------------
insert into public.zc_settings (key, value, description) values
  ('terms.client_version', '"2026-08-19"'::jsonb,
   'Versão vigente dos termos de uso do cliente.'),
  ('terms.driver_version', '"2026-08-19"'::jsonb,
   'Versão vigente dos termos de uso do motorista.'),
  ('terms.url', '"https://zecarreto.com.br/termos"'::jsonb,
   'Endereço onde os termos completos podem ser lidos.'),
  ('onboarding.required_driver_documents', '["cnh","selfie","proof_of_address"]'::jsonb,
   'Documentos que o motorista precisa enviar para ser analisado.'),
  ('onboarding.required_vehicle_documents', '["crlv"]'::jsonb,
   'Documentos que cada veículo precisa ter para ser aprovado.'),
  ('onboarding.min_vehicle_photos', '2'::jsonb,
   'Quantas fotos do veículo são exigidas.'),
  ('auth.social_providers', '[]'::jsonb,
   'Login social liberado. Ex.: ["google","apple"]. Precisa estar ligado também no painel do Supabase.'),
  ('upload.max_file_mb', '10'::jsonb,
   'Tamanho máximo de cada arquivo enviado, em megabytes.')
on conflict (key) do nothing;

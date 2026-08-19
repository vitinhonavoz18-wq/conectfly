-- =====================================================================
-- ZÉ CARRETO — teste de fumaça do PEDIDO E PREÇO (Fase 3)
-- =====================================================================
-- Verifica no banco o que a Fase 3 prometeu:
--  • o orçamento guarda a fotografia da tarifa;
--  • pedido fechado não muda de preço, nem se a tabela mudar;
--  • só existe uma tarifa vigente por categoria;
--  • adicional não se duplica no mesmo escopo;
--  • carreto imediato só sai da espera depois de confirmado.
--
-- Rodar: psql -v ON_ERROR_STOP=1 -f supabase/tests/zecarreto_pricing.sql
-- =====================================================================
\set ON_ERROR_STOP on
begin;

do $$
declare
  _user uuid := gen_random_uuid();
  _customer uuid;
  _category uuid;
  _region uuid;
  _tariff uuid;
  _quote uuid;
  _ride uuid;
  _n int;
  _total int;
  _snapshot jsonb;
begin
  insert into auth.users (id, email) values (_user, 'cliente-fase3@zecarreto.test');
  insert into public.zc_profiles (id, full_name) values (_user, 'Cliente Fase Tres');
  insert into public.zc_user_roles (user_id, role) values (_user, 'client');
  insert into public.zc_customers (profile_id) values (_user) returning id into _customer;

  select id into _region from public.zc_regions where is_default limit 1;
  select id into _category from public.zc_vehicle_categories where slug = 'medio';
  select id into _tariff from public.zc_tariffs
   where category_id = _category and region_id is null and active and valid_to is null;

  -- --- catálogo da fase -------------------------------------------------
  select count(*) into _n from public.zc_tariff_addons where active and deleted_at is null;
  if _n < 5 then raise exception 'FALHOU: adicionais nao foram cadastrados (%)', _n; end if;

  select count(*) into _n from public.zc_item_presets where active and deleted_at is null;
  if _n < 15 then raise exception 'FALHOU: catalogo de itens incompleto (%)', _n; end if;

  select count(*) into _n from public.zc_vehicle_categories where max_volume_m3 is null and deleted_at is null;
  if _n <> 0 then raise exception 'FALHOU: categoria sem capacidade em volume'; end if;

  select count(*) into _n from public.zc_tariffs
   where region_id is null and active and valid_to is null and included_km <> 5;
  if _n <> 0 then raise exception 'FALHOU: franquia de km nao foi aplicada nas tarifas padrao'; end if;

  -- --- adicional nao duplica no mesmo escopo ----------------------------
  begin
    insert into public.zc_tariff_addons (code, name, pricing_mode, amount_cents)
      values ('stairs', 'Escada duplicada', 'per_floor', 9999);
    raise exception 'FALHOU: adicional duplicado no mesmo escopo foi aceito';
  exception when unique_violation then null; end;

  -- Mesmo código para OUTRA categoria é permitido (preço próprio).
  insert into public.zc_tariff_addons (code, name, pricing_mode, amount_cents, category_id)
    values ('stairs', 'Escada (médio)', 'per_floor', 2000, _category);

  -- --- orçamento com fotografia da tarifa -------------------------------
  insert into public.zc_quotes (
    profile_id, region_id, category_id, tariff_id, modality,
    distance_meters, duration_seconds, stops_count, helpers_count,
    breakdown, tariff_snapshot, addons, items,
    subtotal_cents, surcharge_cents, toll_cents, service_fee_cents,
    total_cents, platform_fee_cents, driver_net_cents, expires_at
  ) values (
    _user, _region, _category, _tariff, 'immediate',
    15000, 1800, 2, 1,
    '{"lines":[{"code":"base","label":"Bandeirada","amountCents":3500}]}'::jsonb,
    jsonb_build_object('taken_at', now(), 'tariff', jsonb_build_object('base_fare_cents', 3500)),
    '[{"code":"stairs","quantity":2}]'::jsonb,
    '[{"code":"geladeira","quantity":1}]'::jsonb,
    13000, 4550, 0, 0,
    17550, 3510, 14040, now() + interval '15 minutes'
  ) returning id into _quote;

  select tariff_snapshot into _snapshot from public.zc_quotes where id = _quote;
  if _snapshot = '{}'::jsonb then raise exception 'FALHOU: orcamento sem fotografia da tarifa'; end if;

  -- --- pedido nasce com o preço do orçamento ----------------------------
  insert into public.zc_rides (
    customer_id, customer_profile_id, region_id, category_id, tariff_id, quote_id,
    modality, distance_meters, duration_seconds, helpers_count,
    price_breakdown, tariff_snapshot, addons, items,
    subtotal_cents, surcharge_cents, toll_cents, service_fee_cents,
    total_cents, platform_fee_cents, driver_earnings_cents
  )
  select
    _customer, _user, _region, _category, _tariff, _quote,
    q.modality, q.distance_meters, q.duration_seconds, q.helpers_count,
    q.breakdown, q.tariff_snapshot, q.addons, q.items,
    q.subtotal_cents, q.surcharge_cents, q.toll_cents, q.service_fee_cents,
    q.total_cents, q.platform_fee_cents, q.driver_net_cents
  from public.zc_quotes q where q.id = _quote
  returning id into _ride;

  select total_cents into _total from public.zc_rides where id = _ride;
  if _total <> 17550 then raise exception 'FALHOU: pedido nao herdou o preco do orcamento (%)', _total; end if;

  -- --- a tabela de preços muda... ---------------------------------------
  update public.zc_tariffs
     set base_fare_cents = 9900, price_per_km_cents = 900
   where id = _tariff;

  select total_cents into _total from public.zc_rides where id = _ride;
  if _total <> 17550 then
    raise exception 'FALHOU: mudanca de tarifa mexeu no pedido ja feito (%)', _total;
  end if;

  -- --- preço trava depois que o pedido sai do rascunho -------------------
  -- Ainda em rascunho/aguardando pagamento, ajustar é permitido.
  update public.zc_rides set total_cents = 17600 where id = _ride;
  update public.zc_rides set status = 'awaiting_payment' where id = _ride;
  update public.zc_rides set total_cents = 17550 where id = _ride;

  update public.zc_rides set status = 'searching_driver' where id = _ride;
  begin
    update public.zc_rides set total_cents = 1 where id = _ride;
    raise exception 'FALHOU: preco foi alterado depois do pedido confirmado';
  exception when check_violation then null; end;

  begin
    update public.zc_rides set tariff_snapshot = '{}'::jsonb where id = _ride;
    raise exception 'FALHOU: fotografia da tarifa foi trocada depois de confirmado';
  exception when check_violation then null; end;

  -- Mudar o que NÃO é preço continua permitido.
  update public.zc_rides set notes = 'Portaria fecha as 18h' where id = _ride;

  -- --- uma tarifa vigente por categoria ---------------------------------
  begin
    insert into public.zc_tariffs (name, category_id, region_id, base_fare_cents, price_per_km_cents,
                                   price_per_minute_cents, minimum_fare_cents)
      values ('Tarifa paralela', _category, null, 1000, 100, 10, 2000);
    raise exception 'FALHOU: duas tarifas vigentes para a mesma categoria';
  exception when unique_violation then null; end;

  -- Fechar a antiga com data de fim libera a nova (é assim que se reajusta).
  update public.zc_tariffs set valid_to = now(), active = false where id = _tariff;
  insert into public.zc_tariffs (name, category_id, region_id, base_fare_cents, price_per_km_cents,
                                 price_per_minute_cents, minimum_fare_cents, included_km)
    values ('Tarifa nova', _category, null, 4000, 350, 70, 5500, 5);

  -- A tarifa antiga continua guardada, para explicar contas passadas.
  select count(*) into _n from public.zc_tariffs where category_id = _category and region_id is null;
  if _n < 2 then raise exception 'FALHOU: tarifa antiga foi apagada em vez de arquivada'; end if;

  -- --- imediato só procura motorista depois de confirmado ---------------
  -- (o carreto de cima já passou por awaiting_payment antes de searching_driver;
  --  aqui garantimos que pular direto do rascunho é barrado)
  declare
    _ride2 uuid;
  begin
    insert into public.zc_rides (customer_id, customer_profile_id, category_id, modality, total_cents)
      values (_customer, _user, _category, 'immediate', 10000) returning id into _ride2;
    begin
      update public.zc_rides set status = 'searching_driver' where id = _ride2;
      raise exception 'FALHOU: carreto imediato foi procurar motorista sem confirmacao';
    exception when check_violation then null; end;
  end;

  raise notice 'ZE CARRETO PRECO: TODOS OS CENARIOS PASSARAM';
end $$;

rollback;

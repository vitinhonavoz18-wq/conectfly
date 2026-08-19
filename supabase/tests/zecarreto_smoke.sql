-- =====================================================================
-- ZÉ CARRETO — teste de fumaça do banco
-- =====================================================================
-- Roda o caminho inteiro de um carreto dentro do banco e verifica se as
-- travas funcionam. Se algo estiver errado, o teste PARA com erro.
--
-- Como rodar (Postgres local com o "harness" do Supabase, ou branch do
-- Supabase):  psql -v ON_ERROR_STOP=1 -f supabase/tests/zecarreto_smoke.sql
-- =====================================================================
\set ON_ERROR_STOP on
begin;

do $$
declare
  _client_user uuid := gen_random_uuid();
  _driver_user uuid := gen_random_uuid();
  _driver2_user uuid := gen_random_uuid();
  _customer uuid;
  _driver uuid;
  _driver2 uuid;
  _vehicle uuid;
  _category uuid;
  _tariff uuid;
  _region uuid;
  _ride public.zc_rides;
  _ride_id uuid;
  _offer1 uuid;
  _offer2 uuid;
  _wallet uuid;
  _tx uuid;
  _payout uuid;
  _n int;
  _bal bigint;
begin
  -- --- usuários e perfis -------------------------------------------------
  insert into auth.users (id, email) values
    (_client_user, 'cliente@zecarreto.test'),
    (_driver_user, 'motorista@zecarreto.test'),
    (_driver2_user, 'motorista2@zecarreto.test');

  insert into public.zc_profiles (id, full_name, phone) values
    (_client_user, 'Cliente Teste', '11999990001'),
    (_driver_user, 'Motorista Teste', '11999990002'),
    (_driver2_user, 'Motorista Dois', '11999990003');

  insert into public.zc_user_roles (user_id, role) values
    (_client_user, 'client'), (_driver_user, 'driver'), (_driver2_user, 'driver');

  select id into _region from public.zc_regions where is_default limit 1;
  select id into _category from public.zc_vehicle_categories where slug = 'medio';
  select id into _tariff from public.zc_tariffs where category_id = _category and region_id is null;

  insert into public.zc_customers (profile_id) values (_client_user) returning id into _customer;
  -- Motorista nasce fora do ar: só entra na fila depois que o cadastro E o
  -- veículo estiverem aprovados (regra da Fase 2).
  insert into public.zc_drivers (profile_id, region_id, status)
    values (_driver_user, _region, 'approved') returning id into _driver;
  insert into public.zc_drivers (profile_id, region_id, status)
    values (_driver2_user, _region, 'approved') returning id into _driver2;

  -- carteira criada automaticamente junto do motorista
  select id into _wallet from public.zc_wallets where driver_id = _driver;
  if _wallet is null then raise exception 'FALHOU: carteira nao foi criada com o motorista'; end if;

  insert into public.zc_vehicles (driver_id, category_id, plate, brand, model, model_year)
    values (_driver, _category, 'ABC1D23', 'Fiat', 'Fiorino', 2020) returning id into _vehicle;
  update public.zc_vehicles set status = 'approved', verified_at = now() where id = _vehicle;
  update public.zc_drivers set current_vehicle_id = _vehicle where id = _driver;
  update public.zc_drivers set availability = 'online' where id = _driver;

  -- Motorista sem veículo aprovado não consegue entrar no ar.
  begin
    update public.zc_drivers set availability = 'online' where id = _driver2;
    raise exception 'FALHOU: motorista sem veiculo aprovado ficou online';
  exception when check_violation then null; end;

  -- placa duplicada precisa ser barrada
  begin
    insert into public.zc_vehicles (driver_id, category_id, plate)
      values (_driver2, _category, 'abc1d23');
    raise exception 'FALHOU: placa duplicada foi aceita';
  exception when unique_violation then null; end;

  -- --- corrida -----------------------------------------------------------
  insert into public.zc_rides (
    customer_id, customer_profile_id, region_id, category_id, tariff_id,
    modality, distance_meters, duration_seconds, subtotal_cents, total_cents,
    platform_fee_cents, driver_earnings_cents
  ) values (
    _customer, _client_user, _region, _category, _tariff,
    'immediate', 12000, 1800, 8000, 10800, 2160, 8640
  ) returning * into _ride;
  _ride_id := _ride.id;

  if _ride.code is null or _ride.code !~ '^ZC-' then
    raise exception 'FALHOU: codigo da corrida nao foi gerado (%)', _ride.code;
  end if;
  if _ride.status <> 'draft' then raise exception 'FALHOU: corrida nao nasceu em draft'; end if;

  insert into public.zc_ride_stops (ride_id, sequence, kind, street, city, state) values
    (_ride_id, 0, 'pickup',  'Rua da Retirada, 100', 'São Paulo', 'SP'),
    (_ride_id, 1, 'stop',    'Av. do Meio, 500',     'São Paulo', 'SP'),
    (_ride_id, 2, 'dropoff', 'Rua da Entrega, 900',  'São Paulo', 'SP');

  -- sequência duplicada de parada tem que travar
  begin
    insert into public.zc_ride_stops (ride_id, sequence, kind, street, city, state)
      values (_ride_id, 1, 'stop', 'Rua Repetida', 'São Paulo', 'SP');
    raise exception 'FALHOU: duas paradas com a mesma posicao foram aceitas';
  exception when unique_violation then null; end;

  -- --- máquina de status -------------------------------------------------
  -- pular etapa é proibido
  begin
    update public.zc_rides set status = 'in_transit' where id = _ride_id;
    raise exception 'FALHOU: pulou de draft direto para in_transit';
  exception when check_violation then null; end;

  update public.zc_rides set status = 'awaiting_payment' where id = _ride_id;
  update public.zc_rides set status = 'searching_driver' where id = _ride_id;

  -- não pode ir para driver_assigned sem motorista
  begin
    update public.zc_rides set status = 'driver_assigned' where id = _ride_id;
    raise exception 'FALHOU: corrida foi atribuida sem motorista';
  exception when check_violation then null; end;

  -- --- ofertas e aceite concorrente -------------------------------------
  insert into public.zc_ride_offers (ride_id, driver_id, expires_at)
    values (_ride_id, _driver, now() + interval '45 seconds') returning id into _offer1;
  insert into public.zc_ride_offers (ride_id, driver_id, expires_at)
    values (_ride_id, _driver2, now() + interval '45 seconds') returning id into _offer2;

  _ride := public.zc_accept_ride_offer(_offer1, _driver, _vehicle);
  if _ride.status <> 'driver_assigned' or _ride.driver_id <> _driver then
    raise exception 'FALHOU: aceite da oferta nao atribuiu a corrida';
  end if;

  -- o segundo motorista chega atrasado: tem que levar "ZC_RIDE_TAKEN"
  begin
    perform public.zc_accept_ride_offer(_offer2, _driver2, null);
    raise exception 'FALHOU: dois motoristas aceitaram a mesma corrida';
  exception when check_violation then null; end;

  select count(*) into _n from public.zc_drivers d where d.id = _driver and d.availability = 'busy';
  if _n <> 1 then raise exception 'FALHOU: motorista nao ficou ocupado apos aceitar'; end if;

  -- --- execução ----------------------------------------------------------
  update public.zc_rides set status = 'driver_to_pickup' where id = _ride_id;
  update public.zc_rides set status = 'driver_arrived'   where id = _ride_id;
  update public.zc_rides set status = 'loading'          where id = _ride_id;
  update public.zc_rides set status = 'in_transit'       where id = _ride_id;
  update public.zc_rides set status = 'unloading'        where id = _ride_id;
  update public.zc_rides set status = 'completed'        where id = _ride_id;

  select * into _ride from public.zc_rides where id = _ride_id;
  if _ride.completed_at is null or _ride.assigned_at is null or _ride.in_transit_at is null then
    raise exception 'FALHOU: carimbos de etapa nao foram preenchidos';
  end if;

  -- corrida concluída é ponto final
  begin
    update public.zc_rides set status = 'cancelled', cancelled_by = 'client' where id = _ride_id;
    raise exception 'FALHOU: corrida concluida foi cancelada';
  exception when check_violation then null; end;

  select count(*) into _n from public.zc_ride_status_events where ride_id = _ride_id;
  if _n < 9 then raise exception 'FALHOU: historico de status incompleto (% eventos)', _n; end if;

  -- --- livro-caixa -------------------------------------------------------
  insert into public.zc_wallet_transactions
    (wallet_id, driver_id, ride_id, kind, status, amount_cents, description)
  values (_wallet, _driver, _ride_id, 'ride_earning', 'pending', 8640, 'Ganho do carreto')
  returning id into _tx;

  select balance_pending_cents into _bal from public.zc_wallets where id = _wallet;
  if _bal <> 8640 then raise exception 'FALHOU: saldo maturando errado (%)', _bal; end if;

  -- o mesmo ganho não pode ser lançado duas vezes
  begin
    insert into public.zc_wallet_transactions
      (wallet_id, driver_id, ride_id, kind, status, amount_cents)
    values (_wallet, _driver, _ride_id, 'ride_earning', 'pending', 8640);
    raise exception 'FALHOU: ganho da mesma corrida lancado duas vezes';
  exception when unique_violation then null; end;

  -- valor de lançamento não se edita
  begin
    update public.zc_wallet_transactions set amount_cents = 99999 where id = _tx;
    raise exception 'FALHOU: valor do lancamento foi alterado';
  exception when check_violation then null; end;

  -- lançamento não se apaga
  begin
    delete from public.zc_wallet_transactions where id = _tx;
    raise exception 'FALHOU: lancamento foi apagado';
  exception when check_violation then null; end;

  -- maturou: sai de "pendente" e entra em "disponível"
  update public.zc_wallet_transactions set status = 'available', available_at = now() where id = _tx;
  select balance_available_cents into _bal from public.zc_wallets where id = _wallet;
  if _bal <> 8640 then raise exception 'FALHOU: saldo disponivel errado (%)', _bal; end if;
  select balance_pending_cents into _bal from public.zc_wallets where id = _wallet;
  if _bal <> 0 then raise exception 'FALHOU: saldo maturando nao zerou (%)', _bal; end if;

  -- --- repasse semanal ---------------------------------------------------
  insert into public.zc_payouts (driver_id, wallet_id, period_start, period_end, gross_cents, net_cents, status)
    values (_driver, _wallet, current_date - 7, current_date - 1, 8640, 8640, 'processing')
    returning id into _payout;

  insert into public.zc_payout_items (payout_id, transaction_id, amount_cents)
    values (_payout, _tx, 8640);

  insert into public.zc_wallet_transactions
    (wallet_id, driver_id, payout_id, kind, status, amount_cents, description)
  values (_wallet, _driver, _payout, 'payout', 'available', -8640, 'Repasse semanal');

  update public.zc_payouts set status = 'paid', processed_at = now() where id = _payout;

  select balance_available_cents into _bal from public.zc_wallets where id = _wallet;
  if _bal <> 0 then raise exception 'FALHOU: saldo nao zerou apos o repasse (%)', _bal; end if;
  select total_paid_out_cents into _bal from public.zc_wallets where id = _wallet;
  if _bal <> 8640 then raise exception 'FALHOU: total repassado errado (%)', _bal; end if;

  -- mesma semana, mesmo motorista: repasse não duplica
  begin
    insert into public.zc_payouts (driver_id, wallet_id, period_start, period_end)
      values (_driver, _wallet, current_date - 7, current_date - 1);
    raise exception 'FALHOU: repasse duplicado na mesma semana';
  exception when unique_violation then null; end;

  -- conferência independente do saldo
  perform public.zc_wallet_recompute(_wallet);
  select balance_available_cents into _bal from public.zc_wallets where id = _wallet;
  if _bal <> 0 then raise exception 'FALHOU: reconferencia do saldo divergiu (%)', _bal; end if;

  -- --- avaliação ---------------------------------------------------------
  insert into public.zc_ratings (ride_id, direction, rater_profile_id, ratee_profile_id, stars, comment)
    values (_ride_id, 'client_to_driver', _client_user, _driver_user, 4, 'Chegou no horário');

  select count(*) into _n from public.zc_drivers where id = _driver and rating_count = 1 and rating_avg = 4.00;
  if _n <> 1 then raise exception 'FALHOU: media do motorista nao atualizou'; end if;

  -- uma avaliação por lado, por corrida
  begin
    insert into public.zc_ratings (ride_id, direction, rater_profile_id, ratee_profile_id, stars)
      values (_ride_id, 'client_to_driver', _client_user, _driver_user, 1);
    raise exception 'FALHOU: cliente avaliou a mesma corrida duas vezes';
  exception when unique_violation then null; end;

  -- --- suporte e notificação --------------------------------------------
  insert into public.zc_support_tickets (profile_id, ride_id, subject)
    values (_client_user, _ride_id, 'Item danificado');
  select count(*) into _n from public.zc_support_tickets where profile_id = _client_user and code like 'SUP-%';
  if _n <> 1 then raise exception 'FALHOU: codigo do chamado nao foi gerado'; end if;

  insert into public.zc_notifications (profile_id, ride_id, type, title, dedupe_key)
    values (_driver_user, _ride_id, 'ride.completed', 'Carreto concluído', 'ride-completed-1');
  begin
    insert into public.zc_notifications (profile_id, ride_id, type, title, dedupe_key)
      values (_driver_user, _ride_id, 'ride.completed', 'Carreto concluído', 'ride-completed-1');
    raise exception 'FALHOU: notificacao duplicada foi aceita';
  exception when unique_violation then null; end;

  raise notice 'ZE CARRETO SMOKE TEST: TODOS OS CENARIOS PASSARAM';
end $$;

rollback;

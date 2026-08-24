-- =====================================================================
-- ZÉ CARRETO — teste de fumaça do MOTORISTA E RASTREAMENTO (Fase 4)
-- =====================================================================
-- Verifica no banco o que a Fase 4 prometeu:
--  • agenda do carreteiro: dois compromissos no mesmo horário não entram;
--  • aceite confere a agenda antes de fechar;
--  • motorista desiste → o carreto volta para a fila, não é cancelado;
--  • motorista sem sinal sai do ar e o carreto é reassociado sozinho;
--  • link de acompanhamento é único;
--  • conversa do carreto trava depois que ele termina.
--
-- Rodar: psql -v ON_ERROR_STOP=1 -f supabase/tests/zecarreto_dispatch.sql
-- =====================================================================
\set ON_ERROR_STOP on
begin;

do $$
declare
  _client uuid := gen_random_uuid();
  _d1_user uuid := gen_random_uuid();
  _d2_user uuid := gen_random_uuid();
  _customer uuid;
  _driver1 uuid;
  _driver2 uuid;
  _vehicle1 uuid;
  _vehicle2 uuid;
  _category uuid;
  _region uuid;
  _ride uuid;
  _ride2 uuid;
  _offer1 uuid;
  _offer2 uuid;
  _result public.zc_rides;
  _n int;
  _texto text;
begin
  -- --- cenário ----------------------------------------------------------
  insert into auth.users (id, email) values
    (_client, 'cliente-fase4@zecarreto.test'),
    (_d1_user, 'motorista1-fase4@zecarreto.test'),
    (_d2_user, 'motorista2-fase4@zecarreto.test');
  insert into public.zc_profiles (id, full_name) values
    (_client, 'Cliente Quatro'), (_d1_user, 'Carreteiro Um'), (_d2_user, 'Carreteiro Dois');
  insert into public.zc_user_roles (user_id, role) values
    (_client, 'client'), (_d1_user, 'driver'), (_d2_user, 'driver');
  insert into public.zc_customers (profile_id) values (_client) returning id into _customer;

  select id into _region from public.zc_regions where is_default limit 1;
  select id into _category from public.zc_vehicle_categories where slug = 'medio';

  insert into public.zc_drivers (profile_id, region_id, status) values (_d1_user, _region, 'approved')
    returning id into _driver1;
  insert into public.zc_drivers (profile_id, region_id, status) values (_d2_user, _region, 'approved')
    returning id into _driver2;

  insert into public.zc_vehicles (driver_id, category_id, plate, status, active)
    values (_driver1, _category, 'AAA1A11', 'approved', true) returning id into _vehicle1;
  insert into public.zc_vehicles (driver_id, category_id, plate, status, active)
    values (_driver2, _category, 'BBB2B22', 'approved', true) returning id into _vehicle2;
  update public.zc_drivers set current_vehicle_id = _vehicle1 where id = _driver1;
  update public.zc_drivers set current_vehicle_id = _vehicle2 where id = _driver2;

  -- --- agenda: dois compromissos que se cruzam não entram ----------------
  insert into public.zc_rides (customer_id, customer_profile_id, category_id, modality, total_cents)
    values (_customer, _client, _category, 'immediate', 10000) returning id into _ride;
  insert into public.zc_rides (customer_id, customer_profile_id, category_id, modality,
                               scheduled_for, total_cents)
    values (_customer, _client, _category, 'scheduled', now() + interval '3 hours', 12000)
    returning id into _ride2;

  insert into public.zc_driver_reservations (driver_id, ride_id, starts_at, ends_at)
    values (_driver1, _ride, now() + interval '3 hours', now() + interval '5 hours');

  begin
    insert into public.zc_driver_reservations (driver_id, ride_id, starts_at, ends_at)
      values (_driver1, _ride2, now() + interval '4 hours', now() + interval '6 hours');
    raise exception 'FALHOU: dois compromissos no mesmo horario foram aceitos';
  exception when exclusion_violation then null; end;

  -- Horário que NÃO cruza pode.
  insert into public.zc_driver_reservations (driver_id, ride_id, starts_at, ends_at)
    values (_driver1, _ride2, now() + interval '6 hours', now() + interval '8 hours');

  -- E o mesmo horário para OUTRO carreteiro também pode.
  update public.zc_driver_reservations set status = 'released', released_at = now()
   where ride_id = _ride2;
  insert into public.zc_driver_reservations (driver_id, ride_id, starts_at, ends_at)
    values (_driver2, _ride2, now() + interval '3 hours', now() + interval '5 hours');

  -- --- a função de conflito responde certo ------------------------------
  if not public.zc_driver_has_conflict(_driver1, now() + interval '3 hours 30 minutes',
                                       now() + interval '4 hours') then
    raise exception 'FALHOU: conflito de agenda nao foi detectado';
  end if;
  if public.zc_driver_has_conflict(_driver1, now() + interval '10 hours',
                                   now() + interval '11 hours') then
    raise exception 'FALHOU: horario livre foi apontado como ocupado';
  end if;

  -- Limpa a agenda para os próximos cenários.
  update public.zc_driver_reservations set status = 'released', released_at = now();

  -- --- aceite: só um leva, e a agenda é conferida ------------------------
  update public.zc_rides set status = 'awaiting_payment' where id = _ride;
  update public.zc_rides set status = 'searching_driver' where id = _ride;

  insert into public.zc_ride_offers (ride_id, driver_id, expires_at)
    values (_ride, _driver1, now() + interval '45 seconds') returning id into _offer1;
  insert into public.zc_ride_offers (ride_id, driver_id, expires_at)
    values (_ride, _driver2, now() + interval '45 seconds') returning id into _offer2;

  _result := public.zc_accept_ride_offer(_offer1, _driver1, _vehicle1);
  if _result.driver_id <> _driver1 or _result.status <> 'driver_assigned' then
    raise exception 'FALHOU: aceite nao atribuiu a corrida';
  end if;

  -- O segundo carreteiro chega atrasado.
  begin
    perform public.zc_accept_ride_offer(_offer2, _driver2, _vehicle2);
    raise exception 'FALHOU: dois carreteiros aceitaram a mesma corrida';
  exception when check_violation then null; end;

  -- O aceite criou a reserva na agenda de quem levou.
  select count(*) into _n from public.zc_driver_reservations
   where ride_id = _ride and driver_id = _driver1 and status = 'confirmed';
  if _n <> 1 then raise exception 'FALHOU: aceite nao reservou a agenda do carreteiro'; end if;

  -- Carreto imediato deixa o carreteiro ocupado.
  select count(*) into _n from public.zc_drivers where id = _driver1 and availability = 'busy';
  if _n <> 1 then raise exception 'FALHOU: carreteiro nao ficou ocupado no imediato'; end if;

  -- --- carreteiro com compromisso não pode pegar outro no mesmo horário --
  update public.zc_rides set status = 'awaiting_payment' where id = _ride2;
  update public.zc_rides set status = 'searching_driver' where id = _ride2;
  insert into public.zc_ride_offers (ride_id, driver_id, expires_at)
    values (_ride2, _driver1, now() + interval '45 seconds') returning id into _offer2;
  begin
    perform public.zc_accept_ride_offer(_offer2, _driver1, _vehicle1);
    raise exception 'FALHOU: carreteiro ocupado aceitou outro carreto';
  exception when check_violation then null; end;

  -- A mesma oferta não pode ser repetida na mesma rodada.
  begin
    insert into public.zc_ride_offers (ride_id, driver_id, round, expires_at)
      values (_ride, _driver1, 1, now() + interval '45 seconds');
    raise exception 'FALHOU: oferta duplicada na mesma rodada foi aceita';
  exception when unique_violation then null; end;

  -- --- motorista desiste: volta para a fila, NÃO cancela -----------------
  _result := public.zc_release_ride(_ride, 'Quebrei o veiculo no caminho', true);
  if _result.status <> 'searching_driver' then
    raise exception 'FALHOU: carreto nao voltou para a fila (%)', _result.status;
  end if;
  if _result.driver_id is not null then
    raise exception 'FALHOU: carreto voltou para a fila com carreteiro grudado';
  end if;
  if _result.reassignment_count <> 1 then
    raise exception 'FALHOU: reassociacao nao foi contada';
  end if;

  -- A agenda foi liberada e o carreteiro voltou a ficar disponível.
  select count(*) into _n from public.zc_driver_reservations
   where ride_id = _ride and status <> 'released';
  if _n <> 0 then raise exception 'FALHOU: agenda continuou presa apos a desistencia'; end if;

  select count(*) into _n from public.zc_drivers where id = _driver1 and availability = 'online';
  if _n <> 1 then raise exception 'FALHOU: carreteiro nao voltou a ficar disponivel'; end if;

  -- O cliente foi avisado dentro da conversa do carreto.
  select body into _texto from public.zc_ride_messages
   where ride_id = _ride and is_system order by created_at desc limit 1;
  if _texto is null or _texto not ilike '%veiculo%' then
    raise exception 'FALHOU: cliente nao foi avisado da desistencia (%)', _texto;
  end if;

  -- Carreto que ainda não tem motorista não pode ser "devolvido".
  begin
    perform public.zc_release_ride(_ride, 'sem motivo', true);
    raise exception 'FALHOU: carreto sem motorista foi devolvido';
  exception when check_violation then null; end;

  -- --- perda de sinal: sai do ar e o carreto é reassociado ---------------
  insert into public.zc_ride_offers (ride_id, driver_id, round, expires_at)
    values (_ride, _driver1, 2, now() + interval '45 seconds') returning id into _offer1;
  _result := public.zc_accept_ride_offer(_offer1, _driver1, _vehicle1);

  -- O carreteiro mandou o último sinal há muito tempo.
  insert into public.zc_driver_locations (driver_id, lat, lng, availability, recorded_at)
    values (_driver1, -23.55, -46.63, 'online', now() - interval '20 minutes')
  on conflict (driver_id) do update
    set availability = 'online', recorded_at = now() - interval '20 minutes';

  -- A ordem da faxina importa: primeiro o carreto volta para a fila (o
  -- que solta o carreteiro do "ocupado"), depois ele sai do ar.
  update public.zc_rides set assigned_at = now() - interval '20 minutes' where id = _ride;
  select public.zc_recover_abandoned_rides(300) into _n;
  if _n < 1 then raise exception 'FALHOU: carreto abandonado nao foi reassociado'; end if;

  select count(*) into _n from public.zc_rides
   where id = _ride and status = 'searching_driver' and reassignment_count = 2;
  if _n <> 1 then raise exception 'FALHOU: carreto abandonado nao voltou para a busca'; end if;

  select public.zc_expire_stale_drivers(120) into _n;
  if _n < 1 then raise exception 'FALHOU: carreteiro sem sinal nao saiu do ar'; end if;

  select count(*) into _n from public.zc_drivers where id = _driver1 and availability = 'offline';
  if _n <> 1 then raise exception 'FALHOU: disponibilidade nao foi zerada'; end if;

  -- --- link de acompanhamento -------------------------------------------
  update public.zc_rides set share_token = 'token-unico-1', share_expires_at = now() + interval '12 hours'
   where id = _ride;
  begin
    update public.zc_rides set share_token = 'token-unico-1' where id = _ride2;
    raise exception 'FALHOU: dois carretos com o mesmo link de acompanhamento';
  exception when unique_violation then null; end;

  -- --- conversa do carreto ----------------------------------------------
  insert into public.zc_ride_messages (ride_id, sender_profile_id, sender_role, body)
    values (_ride, _client, 'client', 'Estou na portaria, pode subir');
  select count(*) into _n from public.zc_ride_messages where ride_id = _ride and not is_system;
  if _n <> 1 then raise exception 'FALHOU: mensagem do cliente nao foi gravada'; end if;

  -- Mensagem vazia não entra.
  begin
    insert into public.zc_ride_messages (ride_id, body) values (_ride, '   ');
    raise exception 'FALHOU: mensagem vazia foi aceita';
  exception when check_violation then null; end;

  -- --- conclusão libera a agenda ----------------------------------------
  insert into public.zc_ride_offers (ride_id, driver_id, round, expires_at)
    values (_ride, _driver2, 3, now() + interval '45 seconds') returning id into _offer2;
  _result := public.zc_accept_ride_offer(_offer2, _driver2, _vehicle2);

  update public.zc_rides set status = 'driver_to_pickup' where id = _ride;
  update public.zc_rides set status = 'driver_arrived'   where id = _ride;
  update public.zc_rides set status = 'loading'          where id = _ride;
  update public.zc_rides set status = 'in_transit'       where id = _ride;
  update public.zc_rides set status = 'unloading'        where id = _ride;
  update public.zc_rides set status = 'completed'        where id = _ride;

  select count(*) into _n from public.zc_driver_reservations
   where ride_id = _ride and status <> 'released';
  if _n <> 0 then raise exception 'FALHOU: agenda continuou presa depois do carreto concluido'; end if;

  -- --- trilha da rota ----------------------------------------------------
  insert into public.zc_ride_tracking (ride_id, driver_id, lat, lng, distance_from_previous_m)
    values (_ride, _driver2, -23.55, -46.63, null),
           (_ride, _driver2, -23.54, -46.62, 1400);
  select count(*) into _n from public.zc_ride_tracking where ride_id = _ride;
  if _n <> 2 then raise exception 'FALHOU: trilha da rota nao foi guardada'; end if;

  raise notice 'ZE CARRETO DESPACHO: TODOS OS CENARIOS PASSARAM';
end $$;

rollback;

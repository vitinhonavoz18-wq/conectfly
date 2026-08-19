-- =====================================================================
-- ZÉ CARRETO — teste de fumaça dos CADASTROS (Fase 2)
-- =====================================================================
-- Verifica no banco as travas que a Fase 2 prometeu:
--  • motorista só fica online com cadastro E veículo aprovados;
--  • veículo reprovado derruba o motorista do ar;
--  • toda alteração vira histórico, com dado sensível mascarado;
--  • aceite dos termos não duplica na mesma versão.
--
-- Rodar: psql -v ON_ERROR_STOP=1 -f supabase/tests/zecarreto_onboarding.sql
-- =====================================================================
\set ON_ERROR_STOP on
begin;

do $$
declare
  _user uuid := gen_random_uuid();
  _driver uuid;
  _vehicle uuid;
  _vehicle2 uuid;
  _category uuid;
  _region uuid;
  _n int;
  _txt text;
begin
  insert into auth.users (id, email) values (_user, 'carreteiro@zecarreto.test');
  insert into public.zc_profiles (id, full_name, phone, document_number)
    values (_user, 'João Carreteiro', '11988880001', '52998224725');
  insert into public.zc_user_roles (user_id, role) values (_user, 'driver');

  select id into _region from public.zc_regions where is_default limit 1;
  select id into _category from public.zc_vehicle_categories where slug = 'pequeno';

  -- --- status inicial combinado na Fase 2 ------------------------------
  insert into public.zc_drivers (profile_id, region_id) values (_user, _region)
    returning id into _driver;

  select count(*) into _n from public.zc_drivers where id = _driver and status = 'pending';
  if _n <> 1 then raise exception 'FALHOU: motorista nao nasce com status pending'; end if;

  -- --- não fica online sem aprovação -----------------------------------
  begin
    update public.zc_drivers set availability = 'online' where id = _driver;
    raise exception 'FALHOU: motorista sem aprovacao ficou online';
  exception when check_violation then null; end;

  -- --- aprovado, mas ainda sem veículo ---------------------------------
  update public.zc_drivers set status = 'approved' where id = _driver;
  begin
    update public.zc_drivers set availability = 'online' where id = _driver;
    raise exception 'FALHOU: motorista sem veiculo aprovado ficou online';
  exception when check_violation then null; end;

  -- --- veículo cadastrado nasce aguardando análise ----------------------
  insert into public.zc_vehicles (driver_id, category_id, plate, brand, model, model_year, capacity_kg)
    values (_driver, _category, 'XYZ9A88', 'VW', 'Saveiro', 2021, 700)
    returning id into _vehicle;

  select count(*) into _n from public.zc_vehicles where id = _vehicle and status = 'pending';
  if _n <> 1 then raise exception 'FALHOU: veiculo nao nasce como pending'; end if;

  -- veículo apenas cadastrado ainda não libera o motorista
  begin
    update public.zc_drivers set availability = 'online' where id = _driver;
    raise exception 'FALHOU: veiculo pendente liberou o motorista';
  exception when check_violation then null; end;

  -- --- veículo aprovado libera -----------------------------------------
  update public.zc_vehicles set status = 'approved', active = true, verified_at = now()
   where id = _vehicle;

  if not public.zc_driver_can_go_online(_driver) then
    raise exception 'FALHOU: motorista aprovado com veiculo aprovado nao pode ficar online';
  end if;

  update public.zc_drivers set availability = 'online' where id = _driver;
  select count(*) into _n from public.zc_drivers where id = _driver and availability = 'online';
  if _n <> 1 then raise exception 'FALHOU: motorista nao ficou online'; end if;

  -- --- veículo reprovado derruba o motorista do ar ----------------------
  update public.zc_drivers set current_vehicle_id = _vehicle where id = _driver;
  update public.zc_vehicles set status = 'rejected', rejection_reason = 'Fotos ilegiveis'
   where id = _vehicle;

  select count(*) into _n from public.zc_drivers
   where id = _driver and availability = 'offline' and current_vehicle_id is null;
  if _n <> 1 then
    raise exception 'FALHOU: veiculo reprovado nao tirou o motorista do ar';
  end if;

  -- --- segundo veículo: o motorista pode ter vários ---------------------
  insert into public.zc_vehicles (driver_id, category_id, plate, brand, model)
    values (_driver, _category, 'QQQ1B22', 'Fiat', 'Strada')
    returning id into _vehicle2;
  update public.zc_vehicles set status = 'approved', active = true where id = _vehicle2;

  if not public.zc_driver_can_go_online(_driver) then
    raise exception 'FALHOU: segundo veiculo aprovado nao liberou o motorista';
  end if;

  -- --- histórico de alterações -----------------------------------------
  update public.zc_profiles set phone = '11977770002' where id = _user;

  select count(*) into _n from public.zc_record_history
   where entity_table = 'zc_profiles' and entity_id = _user::text and field = 'phone';
  if _n <> 1 then raise exception 'FALHOU: alteracao de telefone nao entrou no historico'; end if;

  select new_value into _txt from public.zc_record_history
   where entity_table = 'zc_profiles' and entity_id = _user::text and field = 'phone';
  if _txt = '11977770002' then
    raise exception 'FALHOU: telefone entrou no historico SEM mascara (%)', _txt;
  end if;
  if right(_txt, 4) <> '0002' then
    raise exception 'FALHOU: mascara do historico nao preserva os 4 finais (%)', _txt;
  end if;

  -- status do veículo é registrado por extenso (não é dado sensível)
  select count(*) into _n from public.zc_record_history
   where entity_table = 'zc_vehicles' and entity_id = _vehicle::text
     and field = 'status' and new_value = 'rejected';
  if _n <> 1 then raise exception 'FALHOU: mudanca de status do veiculo nao foi registrada'; end if;

  -- o motivo da recusa também fica guardado
  select count(*) into _n from public.zc_record_history
   where entity_table = 'zc_vehicles' and entity_id = _vehicle::text
     and field = 'rejection_reason' and new_value = 'Fotos ilegiveis';
  if _n <> 1 then raise exception 'FALHOU: motivo da recusa nao foi registrado'; end if;

  -- --- aceite dos termos -----------------------------------------------
  insert into public.zc_terms_acceptances (profile_id, audience, terms_version)
    values (_user, 'driver', '2026-08-19');
  begin
    insert into public.zc_terms_acceptances (profile_id, audience, terms_version)
      values (_user, 'driver', '2026-08-19');
    raise exception 'FALHOU: aceite duplicado da mesma versao foi aceito';
  exception when unique_violation then null; end;

  -- versão nova exige novo aceite (e não apaga o anterior)
  insert into public.zc_terms_acceptances (profile_id, audience, terms_version)
    values (_user, 'driver', '2027-01-01');
  select count(*) into _n from public.zc_terms_acceptances where profile_id = _user;
  if _n <> 2 then raise exception 'FALHOU: historico de aceites nao guardou as duas versoes'; end if;

  -- --- armazenamento ----------------------------------------------------
  select count(*) into _n from storage.buckets where id in ('zc-avatars', 'zc-documents');
  if _n <> 2 then raise exception 'FALHOU: armarios de arquivo nao foram criados'; end if;

  select count(*) into _n from storage.buckets where id = 'zc-documents' and public = false;
  if _n <> 1 then raise exception 'FALHOU: armario de documentos esta publico'; end if;

  raise notice 'ZE CARRETO CADASTROS: TODOS OS CENARIOS PASSARAM';
end $$;

rollback;

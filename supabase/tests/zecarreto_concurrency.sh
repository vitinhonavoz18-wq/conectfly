#!/usr/bin/env bash
# =====================================================================
# ZÉ CARRETO — teste de CONCORRÊNCIA de verdade (Fase 4)
# =====================================================================
# Os testes em SQL rodam numa conexão só, em fila. Este aqui abre VÁRIAS
# conexões ao mesmo tempo e faz todas apertarem "aceitar" no mesmo
# instante, disputando a mesma corrida.
#
# É a diferença entre ensaiar a fila do caixa com uma pessoa e abrir a
# porta do mercado no dia da promoção.
#
# O que precisa acontecer:
#   • exatamente UM carreteiro leva a corrida;
#   • todos os outros recebem uma recusa clara (ZC_RIDE_TAKEN);
#   • a corrida termina com um único motorista e um único aceite.
#
# Uso:
#   PSQL_ARGS="-h /caminho/do/socket -p 5433 -U postgres" \
#     bash supabase/tests/zecarreto_concurrency.sh
# =====================================================================
set -uo pipefail

PSQL_ARGS="${PSQL_ARGS:-}"
DRIVERS="${DRIVERS:-8}"
PSQL="psql ${PSQL_ARGS} -v ON_ERROR_STOP=1 -q -t -A"

falhou() {
  echo "FALHOU: $1" >&2
  limpar
  exit 1
}

limpar() {
  $PSQL -c "delete from public.zc_rides where code like 'CONC-%';
            delete from auth.users where email like '%@concorrencia.test';" >/dev/null 2>&1
}

echo "=== preparando o cenário (${DRIVERS} carreteiros disputando) ==="
limpar

RIDE_ID=$($PSQL <<SQL
do \$\$
declare
  _client uuid := gen_random_uuid();
  _customer uuid;
  _category uuid;
  _region uuid;
  _ride uuid;
  _driver uuid;
  _vehicle uuid;
  _user uuid;
  i int;
begin
  insert into auth.users (id, email) values (_client, 'cliente@concorrencia.test');
  insert into public.zc_profiles (id, full_name) values (_client, 'Cliente Concorrencia');
  insert into public.zc_user_roles (user_id, role) values (_client, 'client');
  insert into public.zc_customers (profile_id) values (_client) returning id into _customer;

  select id into _region from public.zc_regions where is_default limit 1;
  select id into _category from public.zc_vehicle_categories where slug = 'medio';

  insert into public.zc_rides (customer_id, customer_profile_id, category_id, region_id,
                               modality, total_cents, driver_earnings_cents, code)
    values (_customer, _client, _category, _region, 'immediate', 10000, 8000, 'CONC-1')
    returning id into _ride;
  update public.zc_rides set status = 'awaiting_payment' where id = _ride;
  update public.zc_rides set status = 'searching_driver' where id = _ride;

  for i in 1..${DRIVERS} loop
    _user := gen_random_uuid();
    insert into auth.users (id, email) values (_user, 'motorista' || i || '@concorrencia.test');
    insert into public.zc_profiles (id, full_name) values (_user, 'Carreteiro ' || i);
    insert into public.zc_user_roles (user_id, role) values (_user, 'driver');
    insert into public.zc_drivers (profile_id, region_id, status)
      values (_user, _region, 'approved') returning id into _driver;
    insert into public.zc_vehicles (driver_id, category_id, plate, status, active)
      values (_driver, _category, 'CC' || lpad(i::text, 1, '0') || 'C' || lpad(i::text, 3, '0'),
              'approved', true)
      returning id into _vehicle;
    update public.zc_drivers set current_vehicle_id = _vehicle where id = _driver;
    insert into public.zc_ride_offers (ride_id, driver_id, expires_at, payout_cents)
      values (_ride, _driver, now() + interval '5 minutes', 8000);
  end loop;
end \$\$;
select id from public.zc_rides where code = 'CONC-1';
SQL
) || falhou "não consegui preparar o cenário"

RIDE_ID=$(echo "$RIDE_ID" | tail -1 | tr -d '[:space:]')
[ -n "$RIDE_ID" ] || falhou "corrida de teste não foi criada"
echo "corrida: $RIDE_ID"

# Todo mundo aperta "aceitar" no MESMO instante.
INICIO=$($PSQL -c "select (now() + interval '3 seconds')::text;" | tail -1)
echo "=== disparando em $INICIO ==="

TMP=$(mktemp -d)
OFERTAS=$($PSQL -c "select o.id || ' ' || o.driver_id from public.zc_ride_offers o
                    where o.ride_id = '$RIDE_ID' order by o.id;")

i=0
while read -r OFFER DRIVER; do
  [ -n "$OFFER" ] || continue
  i=$((i + 1))
  (
    psql ${PSQL_ARGS} -q -t -A \
      -c "select pg_sleep_until('$INICIO'::timestamptz);" \
      -c "select public.zc_accept_ride_offer('$OFFER'::uuid, '$DRIVER'::uuid, null);" \
      >"$TMP/ok.$i" 2>"$TMP/err.$i"
    echo $? >"$TMP/code.$i"
  ) &
done <<< "$OFERTAS"

wait
echo "=== conferindo o resultado ==="

SUCESSOS=0
RECUSAS=0
for arquivo in "$TMP"/code.*; do
  if [ "$(cat "$arquivo")" = "0" ]; then
    SUCESSOS=$((SUCESSOS + 1))
  else
    RECUSAS=$((RECUSAS + 1))
  fi
done

echo "aceites bem-sucedidos: $SUCESSOS | recusados: $RECUSAS"

[ "$SUCESSOS" = "1" ] || falhou "esperava exatamente 1 aceite, veio $SUCESSOS"
[ "$RECUSAS" = "$((DRIVERS - 1))" ] || falhou "esperava $((DRIVERS - 1)) recusas, veio $RECUSAS"

# A recusa precisa ser a mensagem certa, não um erro qualquer.
if ! grep -qh "ZC_RIDE_TAKEN" "$TMP"/err.* 2>/dev/null; then
  echo "--- erros recebidos ---" >&2
  cat "$TMP"/err.* >&2
  falhou "as recusas não trouxeram ZC_RIDE_TAKEN"
fi

MOTORISTAS=$($PSQL -c "select count(*) from public.zc_rides
                        where id = '$RIDE_ID' and driver_id is not null
                          and status = 'driver_assigned';" | tail -1)
[ "$MOTORISTAS" = "1" ] || falhou "a corrida não ficou com exatamente um motorista"

ACEITES=$($PSQL -c "select count(*) from public.zc_ride_offers
                     where ride_id = '$RIDE_ID' and status = 'accepted';" | tail -1)
[ "$ACEITES" = "1" ] || falhou "esperava 1 oferta aceita, encontrei $ACEITES"

RESERVAS=$($PSQL -c "select count(*) from public.zc_driver_reservations
                      where ride_id = '$RIDE_ID' and status = 'confirmed';" | tail -1)
[ "$RESERVAS" = "1" ] || falhou "esperava 1 reserva de agenda, encontrei $RESERVAS"

rm -rf "$TMP"
limpar
echo "ZE CARRETO CONCORRENCIA: TODOS OS CENARIOS PASSARAM"

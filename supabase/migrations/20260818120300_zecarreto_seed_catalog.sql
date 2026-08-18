-- =====================================================================
-- ZÉ CARRETO — FASE 1 (4/4): catálogo inicial e configurações
-- =====================================================================
-- Nada aqui é regra "chumbada" no código: são apenas os valores com que a
-- plataforma nasce. Todos podem ser mudados depois pelo admin, sem
-- mexer em programação.
-- =====================================================================

-- Região padrão. Enquanto o admin não cadastrar cidades, tudo cai aqui.
insert into public.zc_regions (slug, name, city, state, country, active, is_default)
values ('brasil-padrao', 'Brasil (padrão)', null, null, 'BR', true, true)
on conflict do nothing;

-- Categorias iniciais de veículo
insert into public.zc_vehicle_categories
  (slug, name, description, examples, max_weight_kg, helpers_included, max_helpers, sort_order, icon)
values
  ('pequeno', 'Pequeno porte',
   'Cargas pequenas, mudanças de poucos volumes e entregas rápidas.',
   'Saveiro, Strada, Montana e similares', 700, 0, 2, 1, 'truck-pickup'),
  ('medio', 'Médio porte',
   'Volume maior protegido do tempo, ideal para eletrodomésticos e caixas.',
   'Fiorino, Kangoo, Partner e similares', 800, 0, 2, 2, 'van'),
  ('bongo', 'Bongo / HR',
   'Mudanças residenciais e cargas altas que não cabem em utilitário.',
   'Kia Bongo, Hyundai HR e similares', 1500, 0, 3, 3, 'truck'),
  ('caminhao', 'Caminhão',
   'Mudanças completas e cargas pesadas.',
   'VUC, 3/4, Toco e similares', 6000, 0, 4, 4, 'truck-front')
on conflict do nothing;

-- Tarifas iniciais (globais: region_id nulo = valem para todo lugar que
-- ainda não tem tarifa própria). Valores em CENTAVOS.
insert into public.zc_tariffs (
  name, region_id, category_id,
  base_fare_cents, price_per_km_cents, price_per_minute_cents, minimum_fare_cents,
  extra_stop_cents, helper_cents, waiting_per_minute_cents, free_waiting_minutes,
  immediate_surcharge_pct, platform_commission_pct,
  cancellation_fee_cents, cancellation_free_seconds
)
select
  'Tarifa padrão — ' || c.name,
  null,
  c.id,
  v.base, v.km, v.min, v.minimum,
  v.stop, v.helper, 100, 15,
  35.000, 20.000,
  v.cancel, 300
from public.zc_vehicle_categories c
join (values
  ('pequeno',   2500,  250,  50,  3500, 1000, 4000, 1000),
  ('medio',     3500,  320,  60,  5000, 1200, 4500, 1500),
  ('bongo',     6000,  450,  80,  9000, 2000, 6000, 2500),
  ('caminhao', 12000,  650, 120, 18000, 3500, 8000, 5000)
) as v(slug, base, km, min, minimum, stop, helper, cancel) on v.slug = c.slug
where not exists (
  select 1 from public.zc_tariffs t
  where t.category_id = c.id and t.region_id is null and t.active and t.valid_to is null
);

-- Configurações da plataforma (o admin edita pela tela, na FASE 2+)
insert into public.zc_settings (key, value, description) values
  ('platform.currency', '"BRL"'::jsonb,
   'Moeda usada em toda a plataforma.'),
  ('pricing.quote_ttl_seconds', '900'::jsonb,
   'Por quantos segundos o preço estimado fica congelado para o cliente (15 min).'),
  ('pricing.immediate_surcharge_pct', '35'::jsonb,
   'Acréscimo do carreto imediato quando a tarifa da categoria não definir o seu.'),
  ('pricing.rounding_cents', '0'::jsonb,
   'Arredondamento final do preço, em centavos. 0 = sem arredondar.'),
  ('dispatch.offer_ttl_seconds', '45'::jsonb,
   'Tempo que o motorista tem para aceitar a oferta antes de ela passar para outro.'),
  ('dispatch.batch_size', '5'::jsonb,
   'Quantos motoristas recebem a oferta ao mesmo tempo em cada rodada.'),
  ('dispatch.max_rounds', '4'::jsonb,
   'Quantas rodadas de busca antes de desistir e avisar o cliente.'),
  ('dispatch.radius_initial_km', '5'::jsonb,
   'Raio da primeira rodada de busca por motoristas.'),
  ('dispatch.radius_step_km', '5'::jsonb,
   'Quanto o raio de busca aumenta a cada rodada.'),
  ('dispatch.radius_max_km', '25'::jsonb,
   'Raio máximo de busca por motoristas.'),
  ('dispatch.scheduled_lead_minutes', '60'::jsonb,
   'Com quantos minutos de antecedência um carreto agendado começa a procurar motorista.'),
  ('tracking.min_seconds_between_pings', '10'::jsonb,
   'Intervalo mínimo entre duas atualizações de posição do mesmo motorista.'),
  ('tracking.stale_after_seconds', '120'::jsonb,
   'Depois disso sem sinal, o motorista deixa de ser considerado disponível.'),
  ('wallet.hold_days', '7'::jsonb,
   'Dias que o ganho da corrida fica "maturando" antes de ficar disponível para saque.'),
  ('payout.close_weekday', '1'::jsonb,
   'Dia em que a semana é fechada (1 = segunda-feira).'),
  ('payout.pay_weekday', '3'::jsonb,
   'Dia em que o repasse é efetivamente pago (3 = quarta-feira).'),
  ('payout.minimum_cents', '2000'::jsonb,
   'Valor mínimo para gerar um repasse. Abaixo disso, acumula para a semana seguinte.'),
  ('cancellation.free_seconds', '300'::jsonb,
   'Janela em que o cliente cancela sem pagar taxa, quando a tarifa não definir a sua.'),
  ('support.default_priority', '"normal"'::jsonb,
   'Prioridade inicial de um chamado de suporte.'),
  ('driver.min_rating', '4.2'::jsonb,
   'Nota mínima do motorista para continuar recebendo ofertas.')
on conflict (key) do nothing;

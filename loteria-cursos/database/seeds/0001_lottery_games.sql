-- Modalidades iniciais. ON CONFLICT DO NOTHING: edições manuais na tabela são preservadas.
-- Cronograma: desde 19/07/2026 os sorteios de sábado passaram para domingo às 11h.
-- CONFIRA em https://loterias.caixa.gov.br/Paginas/regras-sorteios.aspx e ajuste aqui ou direto na tabela.
INSERT INTO lottery_games (slug, name, enabled, numbers_per_bet, numbers_drawn, min_number, max_number,
  draw_schedule, prediction_schedule, brand_color, source_code, source_game_type, timezone, result_window_minutes, hashtags)
VALUES
  ('megasena', 'Mega-Sena', true, 6, 6, 1, 60,
   '[{"days":[2,4],"time":"21:00"},{"days":[0],"time":"11:00"}]', '{"hours_before_draw":5,"bets":1}',
   '#1B8F5A', 'megasena', 'MEGA_SENA', 'America/Bahia', 20, '["#megasena","#loteria","#loteriacursos"]'),
  ('lotofacil', 'Lotofácil', true, 15, 15, 1, 25,
   '[{"days":[1,2,3,4,5],"time":"21:00"},{"days":[0],"time":"11:00"}]', '{"hours_before_draw":5,"bets":1}',
   '#8E1A9C', 'lotofacil', 'LOTOFACIL', 'America/Bahia', 20, '["#lotofacil","#loteria","#loteriacursos"]'),
  ('quina', 'Quina', true, 5, 5, 1, 80,
   '[{"days":[1,2,3,4,5],"time":"21:00"},{"days":[0],"time":"11:00"}]', '{"hours_before_draw":5,"bets":1}',
   '#1F4FBF', 'quina', 'QUINA', 'America/Bahia', 20, '["#quina","#loteria","#loteriacursos"]'),
  ('lotomania', 'Lotomania', true, 50, 20, 0, 99,
   '[{"days":[1,3,5],"time":"21:00"}]', '{"hours_before_draw":5,"bets":1}',
   '#F28C1B', 'lotomania', 'LOTOMANIA', 'America/Bahia', 20, '["#lotomania","#loteria","#loteriacursos"]')
ON CONFLICT (slug) DO NOTHING;

-- Configurações padrão (NÃO secretas). ON CONFLICT DO NOTHING preserva ajustes feitos depois.
-- Valores vindos do .env são sincronizados por database/migrate.mjs (source = 'env').
INSERT INTO system_settings (key, value, description) VALUES
  ('enable_real_instagram_publish', 'false', 'Só publica de verdade quando true. Espelha ENABLE_REAL_INSTAGRAM_PUBLISH.'),
  ('brand_name', '"LOTERIA CURSOS"', 'Nome da marca nas artes e legendas.'),
  ('default_cta', '"Comente \"EU QUERO\" para continuar acompanhando nossos palpites e resultados."', 'CTA padrão.'),
  ('engine_url', '"http://engine:3001"', 'URL interna do Lottery Core API.'),
  ('renderer_url', '"http://renderer:3000"', 'URL interna do serviço de artes.'),
  ('openai_base_url', '"https://api.openai.com/v1"', 'Base da API da OpenAI.'),
  ('openai_model', '""', 'Modelo da OpenAI (defina OPENAI_MODEL no .env).'),
  ('openai_max_attempts', '3', 'Tentativas para gerar legenda antes de usar o texto de reserva.'),
  ('openai_timeout_ms', '60000', 'Tempo limite por chamada à OpenAI.'),
  ('meta_graph_host', '"https://graph.instagram.com"', 'graph.instagram.com (Instagram Login) ou graph.facebook.com (Facebook Login).'),
  ('meta_graph_api_version', '"v26.0"', 'Versão da Graph API. Verifique a atual em developers.facebook.com/docs/graph-api/changelog.'),
  ('meta_ig_user_id', '""', 'ID da conta profissional do Instagram (não é segredo).'),
  ('meta_max_attempts', '4', 'Tentativas para erros transitórios da Meta (429, 5xx, rede).'),
  ('meta_container_max_polls', '10', 'Verificações máximas do status do container antes de desistir.'),
  ('meta_timeout_ms', '30000', 'Tempo limite por chamada à Meta.'),
  ('min_seconds_between_publishes', '60', 'Intervalo mínimo entre publicações reais (throttling).'),
  ('lottery_result_poll_interval_seconds', '180', 'Intervalo base entre consultas do resultado.'),
  ('lottery_result_max_attempts', '10', 'Tentativas máximas por rodada de polling.'),
  ('prediction_history_size', '100', 'Quantos concursos anteriores entram na estatística do palpite.'),
  ('prediction_bets', '1', 'Quantos palpites por concurso.'),
  ('backfill_max_contests', '50', 'Limite de concursos por execução de backfill.'),
  ('instagram_insight_metrics', '{"IMAGE":["views","reach","likes","comments","shares","saved","total_interactions"],"CAROUSEL":["views","reach","likes","comments","shares","saved","total_interactions"],"REELS":["views","reach","likes","comments","shares","saved","total_interactions"],"STORIES":["views","reach","shares","total_interactions"]}', 'Métricas por tipo de mídia. A Meta muda métricas com frequência: ajuste aqui sem mexer no workflow.'),
  ('insights_lookback_days', '30', 'Por quantos dias após publicar as métricas são coletadas.'),
  ('insights_min_interval_hours', '20', 'Intervalo mínimo entre coletas do mesmo post.'),
  ('alert_webhook_url', '""', 'Opcional: URL que recebe alertas (POST JSON). Vazio = sem alerta externo.'),
  ('n8n_health_url', '"http://127.0.0.1:5678/healthz"', 'Healthcheck interno do n8n.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO circuit_breakers (service, failure_threshold, cooldown_seconds) VALUES
  ('lottery_source', 5, 600),
  ('meta', 3, 1800)
ON CONFLICT (service) DO NOTHING;

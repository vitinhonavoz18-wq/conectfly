-- =============================================================================
-- Funções de comando usadas pelos workflows do n8n.
-- Convenção: cada função recebe parâmetros simples/JSONB e devolve UM objeto
-- JSONB com "outcome" — os workflows decidem o caminho olhando esse campo.
-- Toda operação crítica é atômica (INSERT … ON CONFLICT / UPDATE … WHERE status = …).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Configurações (system_settings → objeto único)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lc_settings() RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) FROM system_settings
$$;

CREATE OR REPLACE FUNCTION lc_game_json(g lottery_games) RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id', g.id, 'slug', g.slug, 'name', g.name, 'enabled', g.enabled,
    'numbers_per_bet', g.numbers_per_bet, 'numbers_drawn', g.numbers_drawn,
    'min_number', g.min_number, 'max_number', g.max_number,
    'brand_color', g.brand_color, 'hashtags', g.hashtags,
    'source_code', g.source_code, 'source_game_type', g.source_game_type,
    'timezone', g.timezone, 'draw_schedule', g.draw_schedule,
    'prediction_schedule', g.prediction_schedule, 'result_window_minutes', g.result_window_minutes)
$$;

CREATE OR REPLACE FUNCTION lc_draw_json(d lottery_draws) RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id', d.id, 'game_id', d.game_id, 'contest', d.contest, 'draw_day', to_char(d.draw_day, 'YYYY-MM-DD'),
    'draw_date', d.draw_date, 'numbers', d.numbers, 'draw_order', d.draw_order, 'accumulated', d.accumulated,
    'estimated_prize', d.estimated_prize, 'next_draw_day', to_char(d.next_draw_day, 'YYYY-MM-DD'),
    'next_contest', d.next_contest, 'source', d.source, 'source_hash', d.source_hash,
    'data_status', d.data_status, 'is_backfill', d.is_backfill, 'fetched_at', d.fetched_at)
$$;

-- Contexto completo de uma modalidade para os workflows (regras + último resultado + configurações).
CREATE OR REPLACE FUNCTION lc_game_context(p_slug TEXT) RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE
  g lottery_games%ROWTYPE;
  d lottery_draws%ROWTYPE;
BEGIN
  SELECT * INTO g FROM lottery_games WHERE slug = p_slug;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'outcome', 'UNKNOWN_GAME', 'message', format('modalidade desconhecida: %s', p_slug));
  END IF;
  SELECT * INTO d FROM lottery_draws WHERE game_id = g.id ORDER BY contest DESC LIMIT 1;
  RETURN jsonb_build_object(
    'ok', true, 'outcome', CASE WHEN g.enabled THEN 'OK' ELSE 'GAME_DISABLED' END,
    'game', lc_game_json(g),
    'last_draw', CASE WHEN d.id IS NULL THEN NULL ELSE lc_draw_json(d) END,
    'settings', lc_settings());
END $$;

-- ---------------------------------------------------------------------------
-- Ingestão de resultado (idempotente, segura contra concorrência)
-- outcome: INSERTED | DUPLICATE | CONFLICT | UNKNOWN_GAME | INVALID
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lc_ingest_draw(p_game_slug TEXT, p_draw JSONB, p_is_backfill BOOLEAN DEFAULT false)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  g lottery_games%ROWTYPE;
  v_id UUID;
  v_existing lottery_draws%ROWTYPE;
  v_prev_max BIGINT;
  v_contest BIGINT;
  v_problem TEXT;
BEGIN
  SELECT * INTO g FROM lottery_games WHERE slug = p_game_slug;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'outcome', 'UNKNOWN_GAME');
  END IF;
  IF p_draw->>'game' IS DISTINCT FROM g.slug THEN
    RETURN jsonb_build_object('ok', false, 'outcome', 'INVALID', 'message', 'resultado pertence a outra modalidade');
  END IF;
  v_contest := (p_draw->>'contest')::BIGINT;
  v_problem := lc_number_array_problem(p_draw->'numbers', g.numbers_drawn, g.min_number, g.max_number);
  IF v_problem IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'outcome', 'INVALID', 'message', v_problem, 'contest', v_contest);
  END IF;

  SELECT max(contest) INTO v_prev_max FROM lottery_draws WHERE game_id = g.id;

  INSERT INTO lottery_draws (
    game_id, contest, draw_date, draw_day, numbers, draw_order, accumulated, estimated_prize,
    next_draw, next_draw_day, next_contest, raw_payload, source, source_url, source_hash, fetched_at, is_backfill)
  VALUES (
    g.id, v_contest, (p_draw->>'draw_date')::TIMESTAMPTZ, (p_draw->>'draw_day')::DATE, p_draw->'numbers',
    NULLIF(p_draw->'draw_order', 'null'::jsonb), (p_draw->>'accumulated')::BOOLEAN,
    (p_draw->>'estimated_prize')::NUMERIC, (p_draw->>'next_draw')::TIMESTAMPTZ, (p_draw->>'next_draw_day')::DATE,
    (p_draw->>'next_contest')::BIGINT, COALESCE(p_draw->'raw_payload', '{}'::jsonb), COALESCE(p_draw->>'source', 'unknown'),
    p_draw->>'source_url', p_draw->>'source_hash', COALESCE((p_draw->>'fetched_at')::TIMESTAMPTZ, now()), p_is_backfill)
  ON CONFLICT ON CONSTRAINT lottery_draws_game_contest_key DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true, 'outcome', 'INSERTED', 'draw_id', v_id, 'game', g.slug, 'contest', v_contest,
      'previous_max_contest', v_prev_max,
      'is_latest', v_prev_max IS NULL OR v_contest > v_prev_max,
      'gap', v_prev_max IS NOT NULL AND v_contest > v_prev_max + 1,
      'draw', (SELECT lc_draw_json(d) FROM lottery_draws d WHERE d.id = v_id));
  END IF;

  SELECT * INTO v_existing FROM lottery_draws WHERE game_id = g.id AND contest = v_contest;
  IF v_existing.source_hash = p_draw->>'source_hash' THEN
    UPDATE lottery_draws SET last_seen_at = now() WHERE id = v_existing.id;
    RETURN jsonb_build_object(
      'ok', true, 'outcome', CASE WHEN v_existing.data_status = 'CONFLICT' THEN 'CONFLICT' ELSE 'DUPLICATE' END,
      'draw_id', v_existing.id, 'game', g.slug, 'contest', v_contest, 'previous_max_contest', v_prev_max,
      'is_latest', v_contest >= v_prev_max, 'gap', false, 'draw', lc_draw_json(v_existing));
  END IF;

  -- Mesmo concurso, conteúdo diferente: registra e BLOQUEIA (não sobrescreve).
  INSERT INTO data_conflicts (game_id, contest, draw_id, existing_hash, incoming_hash, existing_payload, incoming_payload)
  VALUES (g.id, v_contest, v_existing.id, v_existing.source_hash, p_draw->>'source_hash', v_existing.raw_payload, p_draw)
  ON CONFLICT ON CONSTRAINT data_conflicts_unique DO NOTHING;
  UPDATE lottery_draws SET data_status = 'CONFLICT', last_seen_at = now() WHERE id = v_existing.id;
  RETURN jsonb_build_object(
    'ok', false, 'outcome', 'CONFLICT', 'draw_id', v_existing.id, 'game', g.slug, 'contest', v_contest,
    'message', format('DATA_CONFLICT: concurso %s de %s chegou com conteúdo diferente do já gravado; publicação bloqueada até análise', v_contest, g.slug),
    'existing_hash', v_existing.source_hash, 'incoming_hash', p_draw->>'source_hash');
END $$;

-- ---------------------------------------------------------------------------
-- Posts: criação idempotente e transições atômicas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lc_post_json(p social_posts) RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT to_jsonb(p) - 'caption_request' || jsonb_build_object('game', (SELECT slug FROM lottery_games WHERE id = p.game_id))
$$;

-- Cria o post se a chave ainda não existe; se existe, devolve o existente (sem alterar).
CREATE OR REPLACE FUNCTION lc_upsert_post(p_plan JSONB, p_correlation_id TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  g lottery_games%ROWTYPE;
  v_post social_posts%ROWTYPE;
  v_inserted BOOLEAN := false;
  v_draw_data_status TEXT;
BEGIN
  SELECT * INTO g FROM lottery_games WHERE slug = p_plan->>'game';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'outcome', 'UNKNOWN_GAME');
  END IF;
  IF p_plan->>'draw_id' IS NOT NULL THEN
    SELECT data_status INTO v_draw_data_status FROM lottery_draws WHERE id = (p_plan->>'draw_id')::UUID;
    IF v_draw_data_status = 'CONFLICT' THEN
      RETURN jsonb_build_object('ok', false, 'outcome', 'DATA_CONFLICT',
        'message', 'resultado com conflito de dados: post não criado até análise manual');
    END IF;
  END IF;

  INSERT INTO social_posts (
    type, game_id, contest, draw_id, prediction_id, format, media_type, dry_run, content_data, render_payload,
    caption_request, storage_path, alt_text, idempotency_key, status, correlation_id)
  VALUES (
    p_plan->>'content_type', g.id, (p_plan->>'contest')::BIGINT, (p_plan->>'draw_id')::UUID,
    (p_plan->>'prediction_id')::UUID, COALESCE(p_plan->>'format', 'feed'), COALESCE(p_plan->>'media_type', 'IMAGE'),
    (p_plan->>'dry_run')::BOOLEAN, p_plan->'content_data', p_plan->'render_payload', p_plan->'caption_request',
    p_plan->>'storage_path', p_plan->>'alt_text_default', p_plan->>'idempotency_key', 'DRAFT', p_correlation_id)
  ON CONFLICT ON CONSTRAINT social_posts_idempotency_key_key DO NOTHING
  RETURNING * INTO v_post;

  IF v_post.id IS NOT NULL THEN
    v_inserted := true;
  ELSE
    SELECT * INTO v_post FROM social_posts WHERE idempotency_key = p_plan->>'idempotency_key';
  END IF;

  RETURN jsonb_build_object('ok', true, 'outcome', CASE WHEN v_inserted THEN 'CREATED' ELSE 'EXISTS' END,
    'inserted', v_inserted, 'post', lc_post_json(v_post), 'caption_request', v_post.caption_request);
END $$;

-- Transição com "compare-and-swap": só muda se o status atual estiver em p_from.
-- Duas execuções simultâneas → só UMA consegue (a outra recebe transitioned=false).
CREATE OR REPLACE FUNCTION lc_transition_post(p_post_id UUID, p_from TEXT[], p_to TEXT, p_patch JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_post social_posts%ROWTYPE;
  v_patch JSONB := COALESCE(p_patch, '{}'::jsonb);
BEGIN
  UPDATE social_posts SET
    status                 = p_to,
    headline               = CASE WHEN v_patch ? 'headline' THEN v_patch->>'headline' ELSE headline END,
    caption                = CASE WHEN v_patch ? 'caption' THEN v_patch->>'caption' ELSE caption END,
    caption_source         = CASE WHEN v_patch ? 'caption_source' THEN v_patch->>'caption_source' ELSE caption_source END,
    hashtags               = CASE WHEN v_patch ? 'hashtags' THEN v_patch->'hashtags' ELSE hashtags END,
    alt_text               = CASE WHEN v_patch ? 'alt_text' THEN v_patch->>'alt_text' ELSE alt_text END,
    storage_path           = CASE WHEN v_patch ? 'storage_path' THEN v_patch->>'storage_path' ELSE storage_path END,
    media_url              = CASE WHEN v_patch ? 'media_url' THEN v_patch->>'media_url' ELSE media_url END,
    media_sha256           = CASE WHEN v_patch ? 'media_sha256' THEN v_patch->>'media_sha256' ELSE media_sha256 END,
    media_width            = CASE WHEN v_patch ? 'media_width' THEN (v_patch->>'media_width')::INT ELSE media_width END,
    media_height           = CASE WHEN v_patch ? 'media_height' THEN (v_patch->>'media_height')::INT ELSE media_height END,
    instagram_container_id = CASE WHEN v_patch ? 'instagram_container_id' THEN v_patch->>'instagram_container_id' ELSE instagram_container_id END,
    instagram_media_id     = CASE WHEN v_patch ? 'instagram_media_id' THEN v_patch->>'instagram_media_id' ELSE instagram_media_id END,
    last_error             = CASE WHEN v_patch ? 'last_error' THEN v_patch->>'last_error'
                                  WHEN p_to IN ('READY', 'RENDERED', 'PUBLISHED', 'PUBLISHED_SIMULATED') THEN NULL
                                  ELSE last_error END,
    published_at           = CASE WHEN p_to = 'PUBLISHED' THEN COALESCE((v_patch->>'published_at')::TIMESTAMPTZ, now())
                                  ELSE published_at END
  WHERE id = p_post_id AND status = ANY (p_from)
  RETURNING * INTO v_post;

  IF v_post.id IS NULL THEN
    SELECT * INTO v_post FROM social_posts WHERE id = p_post_id;
    RETURN jsonb_build_object('ok', v_post.id IS NOT NULL, 'transitioned', false,
      'outcome', CASE WHEN v_post.id IS NULL THEN 'NOT_FOUND' ELSE 'SKIPPED_STATUS_' || v_post.status END,
      'post', CASE WHEN v_post.id IS NULL THEN NULL ELSE lc_post_json(v_post) END);
  END IF;
  RETURN jsonb_build_object('ok', true, 'transitioned', true, 'outcome', 'TRANSITIONED_' || p_to, 'post', lc_post_json(v_post));
END $$;

-- Carrega um post com o pedido de legenda (que não vai no JSON padrão).
CREATE OR REPLACE FUNCTION lc_get_post(p_post_id UUID) RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p.id IS NULL THEN jsonb_build_object('ok', false, 'outcome', 'NOT_FOUND')
         ELSE jsonb_build_object('ok', true, 'outcome', 'FOUND', 'post', lc_post_json(p), 'caption_request', p.caption_request,
              'settings', lc_settings(),
              'last_publish_at', (SELECT max(published_at) FROM social_posts WHERE status = 'PUBLISHED')) END
  FROM (SELECT 1) one LEFT JOIN social_posts p ON p.id = p_post_id
$$;

CREATE OR REPLACE FUNCTION lc_record_attempt(p JSONB) RETURNS JSONB LANGUAGE sql AS $$
  INSERT INTO publish_attempts (post_id, operation, attempt, http_status, outcome, error_code, error_message, response, duration_ms, correlation_id)
  VALUES ((p->>'post_id')::UUID, p->>'operation', COALESCE((p->>'attempt')::INT, 1), (p->>'http_status')::INT,
          p->>'outcome', p->>'error_code', left(p->>'error_message', 2000), p->'response', (p->>'duration_ms')::INT, p->>'correlation_id')
  RETURNING jsonb_build_object('ok', true, 'attempt_id', id)
$$;

-- Reprocessamento manual de post que falhou (só se nada foi publicado).
CREATE OR REPLACE FUNCTION lc_requeue_post(p_post_id UUID) RETURNS JSONB LANGUAGE sql AS $$
  SELECT lc_transition_post(p_post_id, ARRAY['FAILED'], 'READY', '{}'::jsonb)
$$;

-- Posts presos (execução interrompida no meio): vão para FAILED com motivo claro.
-- PUBLISHING preso NUNCA é republicado automaticamente — pode ter chegado à Meta.
CREATE OR REPLACE FUNCTION lc_recover_stuck_posts(p_minutes INT DEFAULT 30) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_count INT := 0;
  r RECORD;
BEGIN
  FOR r IN SELECT id, status FROM social_posts
           WHERE status IN ('RENDERING', 'PUBLISHING') AND status_changed_at < now() - make_interval(mins => p_minutes)
           FOR UPDATE SKIP LOCKED LOOP
    UPDATE social_posts SET status = 'FAILED',
      last_error = CASE WHEN r.status = 'PUBLISHING'
        THEN 'STUCK_PUBLISHING_REVIEW_REQUIRED: execução interrompida durante a publicação; confira no Instagram antes de reprocessar'
        ELSE 'STUCK_RENDERING: execução interrompida durante a renderização' END
    WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'recovered', v_count);
END $$;

-- ---------------------------------------------------------------------------
-- Circuit breaker (CLOSED → OPEN → HALF_OPEN → CLOSED)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lc_circuit_allow(p_service TEXT) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  c circuit_breakers%ROWTYPE;
BEGIN
  INSERT INTO circuit_breakers (service) VALUES (p_service) ON CONFLICT (service) DO NOTHING;
  SELECT * INTO c FROM circuit_breakers WHERE service = p_service FOR UPDATE;
  IF c.circuit_status = 'CLOSED' THEN
    RETURN jsonb_build_object('allowed', true, 'circuit_status', 'CLOSED', 'service', p_service);
  END IF;
  IF c.circuit_status = 'OPEN' AND now() < c.opened_at + make_interval(secs => c.cooldown_seconds) THEN
    RETURN jsonb_build_object('allowed', false, 'circuit_status', 'OPEN', 'service', p_service,
      'retry_after_seconds', CEIL(EXTRACT(EPOCH FROM (c.opened_at + make_interval(secs => c.cooldown_seconds) - now()))),
      'last_error', c.last_error);
  END IF;
  -- Esfriou: libera UMA chamada de teste por vez (HALF_OPEN).
  IF c.half_open_probe_at IS NOT NULL AND c.half_open_probe_at > now() - interval '2 minutes' THEN
    RETURN jsonb_build_object('allowed', false, 'circuit_status', 'HALF_OPEN', 'service', p_service, 'retry_after_seconds', 120);
  END IF;
  UPDATE circuit_breakers SET circuit_status = 'HALF_OPEN', half_open_probe_at = now() WHERE service = p_service;
  RETURN jsonb_build_object('allowed', true, 'circuit_status', 'HALF_OPEN', 'service', p_service, 'probe', true);
END $$;

CREATE OR REPLACE FUNCTION lc_circuit_record(p_service TEXT, p_success BOOLEAN, p_error TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  c circuit_breakers%ROWTYPE;
BEGIN
  INSERT INTO circuit_breakers (service) VALUES (p_service) ON CONFLICT (service) DO NOTHING;
  SELECT * INTO c FROM circuit_breakers WHERE service = p_service FOR UPDATE;
  IF p_success THEN
    UPDATE circuit_breakers SET circuit_status = 'CLOSED', failure_count = 0, last_success = now(),
      opened_at = NULL, half_open_probe_at = NULL
    WHERE service = p_service RETURNING * INTO c;
  ELSE
    UPDATE circuit_breakers SET
      failure_count = c.failure_count + 1,
      last_failure = now(),
      last_error = left(p_error, 1000),
      half_open_probe_at = NULL,
      circuit_status = CASE WHEN c.circuit_status = 'HALF_OPEN' OR c.failure_count + 1 >= c.failure_threshold THEN 'OPEN' ELSE c.circuit_status END,
      opened_at = CASE WHEN c.circuit_status = 'HALF_OPEN' OR c.failure_count + 1 >= c.failure_threshold THEN now() ELSE c.opened_at END
    WHERE service = p_service RETURNING * INTO c;
  END IF;
  RETURN jsonb_build_object('service', p_service, 'circuit_status', c.circuit_status, 'failure_count', c.failure_count);
END $$;

-- ---------------------------------------------------------------------------
-- Agenda de sorteios (tudo configurado em lottery_games, nada fixo no código)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lc_schedule_instants(p_game_id UUID, p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS TABLE (draw_at TIMESTAMPTZ) LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ((d::date + (e->>'time')::time) AT TIME ZONE g.timezone) AS draw_at
  FROM lottery_games g,
       generate_series(((p_from AT TIME ZONE g.timezone)::date - 1)::timestamp,
                       ((p_to AT TIME ZONE g.timezone)::date + 1)::timestamp, interval '1 day') AS d,
       jsonb_array_elements(g.draw_schedule) AS e
  WHERE g.id = p_game_id
    AND EXTRACT(DOW FROM d)::int IN (SELECT jsonb_array_elements_text(e->'days')::int)
    AND ((d::date + (e->>'time')::time) AT TIME ZONE g.timezone) BETWEEN p_from AND p_to
  ORDER BY 1
$$;

-- O que está "vencido" agora: buscar resultado, gerar palpite ou recuperar conteúdo pendente.
CREATE OR REPLACE FUNCTION lc_due_jobs(p_now TIMESTAMPTZ DEFAULT now())
RETURNS TABLE (job_type TEXT, game_slug TEXT, scheduled_draw_at TIMESTAMPTZ, contest BIGINT, draw_id UUID, reason TEXT)
LANGUAGE plpgsql STABLE AS $$
#variable_conflict use_column
DECLARE
  g lottery_games%ROWTYPE;
  v_last TIMESTAMPTZ;
  v_next TIMESTAMPTZ;
  v_latest lottery_draws%ROWTYPE;
BEGIN
  FOR g IN SELECT * FROM lottery_games WHERE enabled ORDER BY slug LOOP
    -- 1) Resultado: último sorteio programado + janela de espera, sem resultado gravado ainda.
    SELECT max(s.draw_at) INTO v_last FROM lc_schedule_instants(g.id, p_now - interval '3 days', p_now - make_interval(mins => g.result_window_minutes)) s;
    IF v_last IS NOT NULL AND p_now <= v_last + interval '6 hours'
       AND NOT EXISTS (SELECT 1 FROM lottery_draws d WHERE d.game_id = g.id AND d.draw_day = (v_last AT TIME ZONE g.timezone)::date)
       AND NOT EXISTS (SELECT 1 FROM result_poll_runs r WHERE r.game_id = g.id AND r.scheduled_draw_at = v_last
                       AND (r.status IN ('POLLING', 'FOUND') OR r.cycles >= 3 OR r.updated_at > p_now - interval '30 minutes')) THEN
      job_type := 'RESULT_POLL'; game_slug := g.slug; scheduled_draw_at := v_last; contest := NULL; draw_id := NULL;
      reason := 'sorteio programado sem resultado gravado';
      RETURN NEXT;
    END IF;

    -- 2) Palpite: X horas antes do próximo sorteio, se o último resultado oficial aponta para essa data.
    SELECT min(s.draw_at) INTO v_next FROM lc_schedule_instants(g.id, p_now, p_now + interval '3 days') s;
    SELECT * INTO v_latest FROM lottery_draws d WHERE d.game_id = g.id AND d.data_status = 'VALID' ORDER BY d.contest DESC LIMIT 1;
    IF v_next IS NOT NULL AND v_latest.id IS NOT NULL
       AND p_now >= v_next - make_interval(hours => COALESCE((g.prediction_schedule->>'hours_before_draw')::INT, 5))
       AND v_latest.next_draw_day = (v_next AT TIME ZONE g.timezone)::date
       AND NOT EXISTS (SELECT 1 FROM predictions p WHERE p.game_id = g.id AND p.contest = v_latest.contest + 1) THEN
      job_type := 'PREDICTION'; game_slug := g.slug; scheduled_draw_at := v_next; contest := v_latest.contest + 1; draw_id := NULL;
      reason := 'janela de palpite aberta';
      RETURN NEXT;
    END IF;
  END LOOP;

  -- 3) Recuperação: resultado gravado nos últimos 3 dias sem post RESULT (execução interrompida).
  RETURN QUERY
    SELECT 'RESULT_CONTENT'::TEXT, gg.slug, NULL::TIMESTAMPTZ, d.contest, d.id, 'resultado sem post'::TEXT
    FROM lottery_draws d JOIN lottery_games gg ON gg.id = d.game_id
    WHERE gg.enabled AND d.data_status = 'VALID' AND NOT d.is_backfill
      AND d.created_at > p_now - interval '3 days' AND d.created_at < p_now - interval '20 minutes'
      AND NOT EXISTS (SELECT 1 FROM social_posts sp WHERE sp.type = 'RESULT' AND sp.game_id = d.game_id AND sp.contest = d.contest);

  -- 4) Recuperação: palpites do concurso ainda não conferidos.
  RETURN QUERY
    SELECT DISTINCT 'CHECK'::TEXT, gg.slug, NULL::TIMESTAMPTZ, d.contest, d.id, 'palpite não conferido'::TEXT
    FROM lottery_draws d JOIN lottery_games gg ON gg.id = d.game_id
    JOIN predictions p ON p.game_id = d.game_id AND p.contest = d.contest
    WHERE gg.enabled AND d.data_status = 'VALID' AND p.checked_at IS NULL
      AND d.created_at > p_now - interval '3 days' AND d.created_at < p_now - interval '20 minutes';
END $$;

-- Reserva a rodada de polling de um sorteio (impede duas execuções paralelas).
CREATE OR REPLACE FUNCTION lc_claim_poll_run(p_game_slug TEXT, p_scheduled_draw_at TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  g lottery_games%ROWTYPE;
  v_run result_poll_runs%ROWTYPE;
BEGIN
  SELECT * INTO g FROM lottery_games WHERE slug = p_game_slug;
  IF NOT FOUND THEN RETURN jsonb_build_object('claimed', false, 'outcome', 'UNKNOWN_GAME'); END IF;
  INSERT INTO result_poll_runs (game_id, scheduled_draw_at) VALUES (g.id, p_scheduled_draw_at)
  ON CONFLICT ON CONSTRAINT result_poll_runs_unique DO UPDATE
    SET status = 'POLLING', cycles = result_poll_runs.cycles + 1, attempts = 0, finished_at = NULL, last_error = NULL
    WHERE result_poll_runs.status IN ('EXHAUSTED', 'FAILED') AND result_poll_runs.cycles < 3
      AND result_poll_runs.updated_at < now() - interval '30 minutes'
  RETURNING * INTO v_run;
  IF v_run.id IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'outcome', 'ALREADY_RUNNING_OR_DONE');
  END IF;
  RETURN jsonb_build_object('claimed', true, 'outcome', 'CLAIMED', 'run_id', v_run.id, 'cycle', v_run.cycles);
END $$;

CREATE OR REPLACE FUNCTION lc_finish_poll_run(p_run_id UUID, p_status TEXT, p_attempts INT, p_last_contest BIGINT, p_error TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE sql AS $$
  UPDATE result_poll_runs SET status = p_status, attempts = p_attempts, last_contest_seen = p_last_contest,
    last_error = left(p_error, 1000), finished_at = CASE WHEN p_status = 'POLLING' THEN NULL ELSE now() END
  WHERE id = p_run_id
  RETURNING jsonb_build_object('ok', true, 'run_id', id, 'status', status)
$$;

-- ---------------------------------------------------------------------------
-- Palpites
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lc_prediction_context(p_game_slug TEXT, p_contest BIGINT DEFAULT NULL, p_history_size INT DEFAULT 100)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE
  g lottery_games%ROWTYPE;
  v_latest lottery_draws%ROWTYPE;
  v_target BIGINT;
BEGIN
  SELECT * INTO g FROM lottery_games WHERE slug = p_game_slug;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'outcome', 'UNKNOWN_GAME'); END IF;
  SELECT * INTO v_latest FROM lottery_draws WHERE game_id = g.id AND data_status = 'VALID' ORDER BY contest DESC LIMIT 1;
  v_target := COALESCE(p_contest, v_latest.contest + 1);
  IF v_target IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'outcome', 'NO_HISTORY',
      'message', 'sem resultado gravado: rode a busca de resultado (ou backfill) antes de gerar palpite');
  END IF;
  RETURN jsonb_build_object(
    'ok', true, 'outcome', 'OK', 'game', lc_game_json(g), 'target_contest', v_target, 'settings', lc_settings(),
    'history', COALESCE((SELECT jsonb_agg(jsonb_build_object('contest', h.contest, 'numbers', h.numbers) ORDER BY h.contest DESC)
                         FROM (SELECT contest, numbers FROM lottery_draws WHERE game_id = g.id AND data_status = 'VALID'
                               AND contest < v_target ORDER BY contest DESC LIMIT p_history_size) h), '[]'::jsonb),
    'existing', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'contest', p.contest, 'numbers', p.numbers,
                          'method', p.method, 'algorithm_version', p.algorithm_version, 'variant', p.variant) ORDER BY p.variant)
                          FROM predictions p WHERE p.game_id = g.id AND p.contest = v_target), '[]'::jsonb));
END $$;

-- Grava palpites (idempotente) e devolve todos os do concurso para aquele método/versão.
CREATE OR REPLACE FUNCTION lc_save_predictions(p JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  g lottery_games%ROWTYPE;
  v_item JSONB;
  v_variant INT := 0;
BEGIN
  SELECT * INTO g FROM lottery_games WHERE slug = p->>'game';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'outcome', 'UNKNOWN_GAME'); END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p->'predictions') LOOP
    v_variant := v_variant + 1;
    INSERT INTO predictions (game_id, contest, variant, numbers, method, algorithm_version, seed, metadata)
    VALUES (g.id, (p->>'contest')::BIGINT, v_variant, v_item->'numbers', p->>'method', p->>'algorithm_version', p->>'seed',
            jsonb_build_object('score', v_item->'score', 'metrics', v_item->'metrics', 'history_size', p->'history_size',
                               'disclaimer', p->>'disclaimer'))
    ON CONFLICT ON CONSTRAINT predictions_unique_variant DO NOTHING;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'outcome', 'SAVED', 'game', g.slug, 'contest', (p->>'contest')::BIGINT,
    'predictions', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'contest', x.contest, 'numbers', x.numbers,
                    'method', x.method, 'algorithm_version', x.algorithm_version, 'variant', x.variant) ORDER BY x.variant)
                    FROM predictions x WHERE x.game_id = g.id AND x.contest = (p->>'contest')::BIGINT
                    AND x.method = p->>'method' AND x.algorithm_version = p->>'algorithm_version'), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION lc_check_context(p_draw_id UUID) RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE
  d lottery_draws%ROWTYPE;
  g lottery_games%ROWTYPE;
BEGIN
  SELECT * INTO d FROM lottery_draws WHERE id = p_draw_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'outcome', 'DRAW_NOT_FOUND'); END IF;
  SELECT * INTO g FROM lottery_games WHERE id = d.game_id;
  IF d.data_status <> 'VALID' THEN
    RETURN jsonb_build_object('ok', false, 'outcome', 'DATA_CONFLICT', 'message', 'resultado em conflito: conferência bloqueada');
  END IF;
  RETURN jsonb_build_object('ok', true, 'outcome', 'OK', 'game', lc_game_json(g), 'draw', lc_draw_json(d), 'settings', lc_settings(),
    'predictions', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'contest', p.contest, 'numbers', p.numbers,
                    'method', p.method, 'algorithm_version', p.algorithm_version, 'variant', p.variant) ORDER BY p.variant)
                    FROM predictions p WHERE p.game_id = d.game_id AND p.contest = d.contest), '[]'::jsonb));
END $$;

-- Grava a conferência (determinística, calculada pelo engine). Idempotente.
CREATE OR REPLACE FUNCTION lc_save_checks(p_draw_id UUID, p_checks JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_item JSONB;
  v_count INT := 0;
BEGIN
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_checks) LOOP
    UPDATE predictions SET hits = (v_item->>'hits')::INT, matching_numbers = v_item->'matching_numbers',
      checked_draw_id = p_draw_id, checked_at = COALESCE(checked_at, now())
    WHERE id = (v_item->>'id')::UUID;
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'outcome', 'CHECKS_SAVED', 'count', v_count);
END $$;

-- ---------------------------------------------------------------------------
-- Insights
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lc_insight_targets(p_lookback_days INT DEFAULT 30, p_min_interval_hours INT DEFAULT 20, p_limit INT DEFAULT 50)
RETURNS TABLE (post_id UUID, instagram_media_id TEXT, media_type TEXT, type TEXT, game TEXT, contest BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT sp.id, sp.instagram_media_id, sp.media_type, sp.type, g.slug, sp.contest
  FROM social_posts sp JOIN lottery_games g ON g.id = sp.game_id
  WHERE sp.status = 'PUBLISHED' AND sp.instagram_media_id IS NOT NULL
    AND sp.published_at > now() - make_interval(days => p_lookback_days)
    AND NOT EXISTS (SELECT 1 FROM instagram_insights ii WHERE ii.instagram_media_id = sp.instagram_media_id
                    AND ii.error IS NULL AND ii.captured_at > now() - make_interval(hours => p_min_interval_hours))
  ORDER BY sp.published_at DESC
  LIMIT p_limit
$$;

CREATE OR REPLACE FUNCTION lc_save_insight(p JSONB) RETURNS JSONB LANGUAGE sql AS $$
  INSERT INTO instagram_insights (post_id, instagram_media_id, metrics, http_status, error)
  VALUES ((p->>'post_id')::UUID, p->>'instagram_media_id', COALESCE(p->'metrics', '{}'::jsonb), (p->>'http_status')::INT, p->>'error')
  RETURNING jsonb_build_object('ok', true, 'id', id)
$$;

-- Converte a resposta da Graph API ([{name, values:[{value}]}]) em {"views": 10, ...}.
CREATE OR REPLACE FUNCTION lc_flatten_insights(p_data JSONB) RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_object_agg(m->>'name', COALESCE(m->'values'->0->'value', m->'total_value'->'value')), '{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(p_data, '[]'::jsonb)) m
$$;

-- ---------------------------------------------------------------------------
-- Erros de workflow
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lc_log_workflow_error(p JSONB) RETURNS JSONB LANGUAGE sql AS $$
  INSERT INTO workflow_errors (workflow_id, workflow_name, execution_id, execution_url, node, error_code, message, stack, mode, payload, occurred_at)
  VALUES (p->>'workflow_id', p->>'workflow_name', p->>'execution_id', p->>'execution_url', p->>'node', p->>'error_code',
          COALESCE(left(p->>'message', 4000), 'erro sem mensagem'), left(p->>'stack', 8000), p->>'mode',
          COALESCE(p->'payload', '{}'::jsonb), COALESCE((p->>'occurred_at')::TIMESTAMPTZ, now()))
  RETURNING jsonb_build_object('ok', true, 'id', id)
$$;

-- ---------------------------------------------------------------------------
-- Contexto de um "trabalho de conteúdo" (RESULT/PREDICTION/CHECK…)
-- Entrada: {"content_type","game","draw_id"?,"prediction_id"?,"contest"?}
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lc_content_context(p JSONB) RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE
  g lottery_games%ROWTYPE;
  d lottery_draws%ROWTYPE;
  pr predictions%ROWTYPE;
  v_type TEXT := p->>'content_type';
  v_contest BIGINT := (p->>'contest')::BIGINT;
BEGIN
  SELECT * INTO g FROM lottery_games WHERE slug = p->>'game';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'outcome', 'UNKNOWN_GAME'); END IF;

  IF p->>'draw_id' IS NOT NULL THEN
    SELECT * INTO d FROM lottery_draws WHERE id = (p->>'draw_id')::UUID AND game_id = g.id;
  ELSIF v_type IN ('RESULT', 'CHECK') AND v_contest IS NOT NULL THEN
    SELECT * INTO d FROM lottery_draws WHERE game_id = g.id AND contest = v_contest;
  END IF;
  IF v_type IN ('RESULT', 'CHECK') THEN
    IF d.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'outcome', 'DRAW_NOT_FOUND'); END IF;
    IF d.data_status <> 'VALID' THEN
      RETURN jsonb_build_object('ok', false, 'outcome', 'DATA_CONFLICT', 'message', 'resultado em conflito: conteúdo bloqueado');
    END IF;
    v_contest := d.contest;
  END IF;

  IF p->>'prediction_id' IS NOT NULL THEN
    SELECT * INTO pr FROM predictions WHERE id = (p->>'prediction_id')::UUID AND game_id = g.id;
  ELSIF v_type IN ('PREDICTION', 'CHECK') AND v_contest IS NOT NULL THEN
    SELECT * INTO pr FROM predictions WHERE game_id = g.id AND contest = v_contest ORDER BY variant LIMIT 1;
  END IF;
  IF v_type IN ('PREDICTION', 'CHECK') AND pr.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'outcome', 'PREDICTION_NOT_FOUND');
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'outcome', 'OK', 'content_type', v_type, 'game', lc_game_json(g),
    'draw', CASE WHEN d.id IS NULL THEN NULL ELSE lc_draw_json(d) END,
    'prediction', CASE WHEN pr.id IS NULL THEN NULL ELSE jsonb_build_object('id', pr.id, 'contest', pr.contest, 'numbers', pr.numbers,
                  'method', pr.method, 'algorithm_version', pr.algorithm_version, 'variant', pr.variant) END,
    'settings', lc_settings());
END $$;

-- Concursos que faltam no histórico (para backfill), do mais recente para o mais antigo.
CREATE OR REPLACE FUNCTION lc_missing_contests(p_game_slug TEXT, p_until BIGINT, p_count INT)
RETURNS TABLE (contest BIGINT) LANGUAGE sql STABLE AS $$
  SELECT c FROM lottery_games g, generate_series(GREATEST(1, p_until - p_count + 1), p_until) AS c
  WHERE g.slug = p_game_slug AND NOT EXISTS (SELECT 1 FROM lottery_draws d WHERE d.game_id = g.id AND d.contest = c)
  ORDER BY c DESC
$$;

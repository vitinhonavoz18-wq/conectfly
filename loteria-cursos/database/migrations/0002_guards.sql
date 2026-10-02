-- =============================================================================
-- Travas de integridade (a "barreira final" no banco)
-- Mesmo que um workflow tenha bug, o banco recusa:
--   • dezenas fora da regra da modalidade;
--   • alteração de resultado oficial já gravado;
--   • transição de estado inválida de um post (ex.: PUBLISHED → PUBLISHING);
--   • troca do ID de mídia do Instagram depois de gravado.
-- =============================================================================

CREATE OR REPLACE FUNCTION lc_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER lottery_games_touch BEFORE UPDATE ON lottery_games FOR EACH ROW EXECUTE FUNCTION lc_touch_updated_at();
CREATE TRIGGER system_settings_touch BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION lc_touch_updated_at();
CREATE TRIGGER circuit_breakers_touch BEFORE UPDATE ON circuit_breakers FOR EACH ROW EXECUTE FUNCTION lc_touch_updated_at();
CREATE TRIGGER result_poll_runs_touch BEFORE UPDATE ON result_poll_runs FOR EACH ROW EXECUTE FUNCTION lc_touch_updated_at();

-- Valida uma lista JSON de dezenas. Retorna NULL se ok, ou o motivo.
CREATE OR REPLACE FUNCTION lc_number_array_problem(p_numbers JSONB, p_expected INT, p_min INT, p_max INT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_len INT;
  v_prev INT := NULL;
  v_elem JSONB;
  v_val INT;
BEGIN
  IF p_numbers IS NULL OR jsonb_typeof(p_numbers) <> 'array' THEN
    RETURN 'dezenas devem ser um array JSON';
  END IF;
  v_len := jsonb_array_length(p_numbers);
  IF v_len <> p_expected THEN
    RETURN format('quantidade de dezenas %s diferente da esperada %s', v_len, p_expected);
  END IF;
  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_numbers) LOOP
    IF jsonb_typeof(v_elem) <> 'number' OR (v_elem #>> '{}') !~ '^[0-9]+$' THEN
      RETURN format('dezena não inteira: %s', v_elem);
    END IF;
    v_val := (v_elem #>> '{}')::INT;
    IF v_val < p_min OR v_val > p_max THEN
      RETURN format('dezena %s fora do intervalo %s-%s', v_val, p_min, p_max);
    END IF;
    IF v_prev IS NOT NULL AND v_val <= v_prev THEN
      RETURN 'dezenas devem ser únicas e em ordem crescente';
    END IF;
    v_prev := v_val;
  END LOOP;
  RETURN NULL;
END $$;

-- Resultado oficial: valida contra a modalidade e é IMUTÁVEL depois de gravado.
CREATE OR REPLACE FUNCTION lc_guard_lottery_draw() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  g lottery_games%ROWTYPE;
  v_problem TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.game_id IS DISTINCT FROM OLD.game_id OR NEW.contest IS DISTINCT FROM OLD.contest
       OR NEW.numbers IS DISTINCT FROM OLD.numbers OR NEW.source_hash IS DISTINCT FROM OLD.source_hash
       OR NEW.draw_day IS DISTINCT FROM OLD.draw_day OR NEW.raw_payload IS DISTINCT FROM OLD.raw_payload THEN
      RAISE EXCEPTION 'OFFICIAL_RESULT_IMMUTABLE: resultado do concurso % não pode ser alterado', OLD.contest
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO g FROM lottery_games WHERE id = NEW.game_id;
  v_problem := lc_number_array_problem(NEW.numbers, g.numbers_drawn, g.min_number, g.max_number);
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_DRAW_NUMBERS (% concurso %): %', g.slug, NEW.contest, v_problem
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER lottery_draws_guard BEFORE INSERT OR UPDATE ON lottery_draws
  FOR EACH ROW EXECUTE FUNCTION lc_guard_lottery_draw();

-- Palpite: valida contra a modalidade e as dezenas são imutáveis.
CREATE OR REPLACE FUNCTION lc_guard_prediction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  g lottery_games%ROWTYPE;
  v_problem TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.numbers IS DISTINCT FROM OLD.numbers OR NEW.game_id IS DISTINCT FROM OLD.game_id
       OR NEW.contest IS DISTINCT FROM OLD.contest THEN
      RAISE EXCEPTION 'PREDICTION_IMMUTABLE: dezenas do palpite não podem ser alteradas'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO g FROM lottery_games WHERE id = NEW.game_id;
  v_problem := lc_number_array_problem(NEW.numbers, g.numbers_per_bet, g.min_number, g.max_number);
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_PREDICTION_NUMBERS (%): %', g.slug, v_problem USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER predictions_guard BEFORE INSERT OR UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION lc_guard_prediction();

-- Máquina de estados (espelho de packages/lottery-core/src/post-state.ts).
CREATE OR REPLACE FUNCTION lc_post_transition_allowed(p_from TEXT, p_to TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_from
    WHEN 'DRAFT'      THEN p_to IN ('READY', 'FAILED', 'CANCELLED')
    WHEN 'READY'      THEN p_to IN ('RENDERING', 'FAILED', 'CANCELLED')
    WHEN 'RENDERING'  THEN p_to IN ('RENDERED', 'FAILED')
    WHEN 'RENDERED'   THEN p_to IN ('PUBLISHING', 'FAILED', 'CANCELLED')
    WHEN 'PUBLISHING' THEN p_to IN ('PUBLISHED', 'PUBLISHED_SIMULATED', 'FAILED', 'RENDERED')
    WHEN 'FAILED'     THEN p_to IN ('READY', 'CANCELLED')
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION lc_guard_social_post() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('DRAFT', 'READY') THEN
      RAISE EXCEPTION 'INVALID_INITIAL_STATUS: post deve nascer DRAFT ou READY (recebido %)', NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.instagram_media_id IS NOT NULL THEN
      RAISE EXCEPTION 'INVALID_INITIAL_STATUS: post novo não pode ter instagram_media_id' USING ERRCODE = 'check_violation';
    END IF;
    NEW.status_changed_at := now();
    RETURN NEW;
  END IF;

  IF NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.game_id IS DISTINCT FROM OLD.game_id OR NEW.contest IS DISTINCT FROM OLD.contest
     OR NEW.dry_run IS DISTINCT FROM OLD.dry_run OR NEW.format IS DISTINCT FROM OLD.format THEN
    RAISE EXCEPTION 'POST_IDENTITY_IMMUTABLE: identidade do post % não pode mudar', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.instagram_media_id IS NOT NULL AND NEW.instagram_media_id IS DISTINCT FROM OLD.instagram_media_id THEN
    RAISE EXCEPTION 'INSTAGRAM_MEDIA_ID_IMMUTABLE: post % já tem mídia publicada', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT lc_post_transition_allowed(OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'INVALID_POST_TRANSITION %->% (post %)', OLD.status, NEW.status, OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.status = 'FAILED' AND NEW.status = 'READY' AND OLD.instagram_media_id IS NOT NULL THEN
      RAISE EXCEPTION 'INVALID_POST_TRANSITION: post % já publicado não pode voltar para a fila', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.status_changed_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER social_posts_guard BEFORE INSERT OR UPDATE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION lc_guard_social_post();

-- =============================================================================
-- Loteria Cursos — esquema principal
-- PostgreSQL 14+ (usa gen_random_uuid() nativo). Compatível com Supabase.
-- Todas as tabelas ficam no schema "public" do banco da aplicação (NÃO no banco
-- interno do n8n).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Modalidades (fonte da verdade de regras, horários e cores)
-- ---------------------------------------------------------------------------
CREATE TABLE lottery_games (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9_]+$'),
  name                  TEXT NOT NULL,
  enabled               BOOLEAN NOT NULL DEFAULT true,
  numbers_per_bet       INT NOT NULL CHECK (numbers_per_bet > 0),
  numbers_drawn         INT NOT NULL CHECK (numbers_drawn > 0),
  min_number            INT NOT NULL CHECK (min_number >= 0),
  max_number            INT NOT NULL,
  -- [{"days":[2,4],"time":"21:00"},{"days":[0],"time":"11:00"}] (0 = domingo), no fuso "timezone"
  draw_schedule         JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(draw_schedule) = 'array'),
  -- {"hours_before_draw":5,"bets":1}
  prediction_schedule   JSONB NOT NULL DEFAULT '{"hours_before_draw":5,"bets":1}'::jsonb
                        CHECK (jsonb_typeof(prediction_schedule) = 'object'),
  brand_color           TEXT NOT NULL CHECK (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  source_code           TEXT NOT NULL,
  source_game_type      TEXT NOT NULL,
  timezone              TEXT NOT NULL DEFAULT 'America/Bahia',
  result_window_minutes INT NOT NULL DEFAULT 20 CHECK (result_window_minutes BETWEEN 0 AND 720),
  hashtags              JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(hashtags) = 'array'),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (max_number > min_number),
  CHECK (numbers_per_bet <= max_number - min_number + 1),
  CHECK (numbers_drawn <= max_number - min_number + 1)
);

-- ---------------------------------------------------------------------------
-- Resultados oficiais
-- ---------------------------------------------------------------------------
CREATE TABLE lottery_draws (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          UUID NOT NULL REFERENCES lottery_games(id),
  contest          BIGINT NOT NULL CHECK (contest > 0),
  draw_date        TIMESTAMPTZ NOT NULL,
  draw_day         DATE NOT NULL,
  numbers          JSONB NOT NULL,
  draw_order       JSONB,
  accumulated      BOOLEAN NOT NULL,
  estimated_prize  NUMERIC(18, 2) CHECK (estimated_prize IS NULL OR estimated_prize >= 0),
  next_draw        TIMESTAMPTZ,
  next_draw_day    DATE,
  next_contest     BIGINT,
  raw_payload      JSONB NOT NULL,
  source           TEXT NOT NULL,
  source_url       TEXT,
  source_hash      TEXT NOT NULL CHECK (source_hash ~ '^[a-f0-9]{64}$'),
  fetched_at       TIMESTAMPTZ NOT NULL,
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_backfill      BOOLEAN NOT NULL DEFAULT false,
  -- VALID | CONFLICT (mesmo concurso chegou depois com conteúdo diferente → bloqueia publicação)
  data_status      TEXT NOT NULL DEFAULT 'VALID' CHECK (data_status IN ('VALID', 'CONFLICT')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lottery_draws_game_contest_key UNIQUE (game_id, contest),
  CHECK (jsonb_typeof(numbers) = 'array'),
  CHECK (next_contest IS NULL OR next_contest = contest + 1)
);
CREATE INDEX lottery_draws_game_day_idx ON lottery_draws (game_id, draw_day DESC);

-- Conflitos de dados (DATA_CONFLICT): nunca sobrescrevemos em silêncio.
CREATE TABLE data_conflicts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          UUID NOT NULL REFERENCES lottery_games(id),
  contest          BIGINT NOT NULL,
  draw_id          UUID REFERENCES lottery_draws(id),
  existing_hash    TEXT NOT NULL,
  incoming_hash    TEXT NOT NULL,
  existing_payload JSONB,
  incoming_payload JSONB NOT NULL,
  detected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ,
  resolution       TEXT,
  CONSTRAINT data_conflicts_unique UNIQUE (game_id, contest, incoming_hash)
);

-- ---------------------------------------------------------------------------
-- Palpites
-- ---------------------------------------------------------------------------
CREATE TABLE predictions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id           UUID NOT NULL REFERENCES lottery_games(id),
  contest           BIGINT NOT NULL CHECK (contest > 0),
  variant           INT NOT NULL DEFAULT 1 CHECK (variant >= 1),
  numbers           JSONB NOT NULL CHECK (jsonb_typeof(numbers) = 'array'),
  method            TEXT NOT NULL,
  algorithm_version TEXT NOT NULL,
  seed              TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  hits              INT CHECK (hits IS NULL OR hits >= 0),
  matching_numbers  JSONB,
  checked_draw_id   UUID REFERENCES lottery_draws(id),
  checked_at        TIMESTAMPTZ,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT predictions_unique_variant UNIQUE (game_id, contest, method, algorithm_version, variant)
);
CREATE INDEX predictions_game_contest_idx ON predictions (game_id, contest);

-- ---------------------------------------------------------------------------
-- Posts sociais (máquina de estados + idempotência)
-- ---------------------------------------------------------------------------
CREATE TABLE social_posts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                    TEXT NOT NULL CHECK (type ~ '^[A-Z_]+$'),
  game_id                 UUID NOT NULL REFERENCES lottery_games(id),
  contest                 BIGINT NOT NULL CHECK (contest > 0),
  draw_id                 UUID REFERENCES lottery_draws(id),
  prediction_id           UUID REFERENCES predictions(id),
  format                  TEXT NOT NULL DEFAULT 'feed' CHECK (format IN ('feed', 'story', 'reel')),
  media_type              TEXT NOT NULL DEFAULT 'IMAGE' CHECK (media_type IN ('IMAGE', 'STORIES', 'REELS', 'CAROUSEL')),
  dry_run                 BOOLEAN NOT NULL,
  headline                TEXT,
  caption                 TEXT,
  caption_source          TEXT CHECK (caption_source IS NULL OR caption_source IN ('openai', 'fallback')),
  hashtags                JSONB,
  alt_text                TEXT,
  content_data            JSONB NOT NULL,
  render_payload          JSONB NOT NULL,
  caption_request         JSONB,
  storage_path            TEXT,
  media_url               TEXT,
  media_sha256            TEXT,
  media_width             INT,
  media_height            INT,
  instagram_container_id  TEXT,
  instagram_media_id      TEXT,
  idempotency_key         TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
                            'DRAFT', 'READY', 'RENDERING', 'RENDERED', 'PUBLISHING',
                            'PUBLISHED', 'PUBLISHED_SIMULATED', 'FAILED', 'CANCELLED')),
  status_changed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_at            TIMESTAMPTZ,
  published_at            TIMESTAMPTZ,
  last_error              TEXT,
  correlation_id          TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT social_posts_idempotency_key_key UNIQUE (idempotency_key),
  CHECK (status <> 'PUBLISHED' OR (dry_run = false AND published_at IS NOT NULL)),
  CHECK (status <> 'PUBLISHED_SIMULATED' OR dry_run = true OR instagram_media_id IS NULL)
);
-- Barreira extra: um único post REAL publicado por (tipo, modalidade, concurso, formato).
CREATE UNIQUE INDEX social_posts_one_real_publication
  ON social_posts (type, game_id, contest, format)
  WHERE status = 'PUBLISHED' AND dry_run = false;
CREATE UNIQUE INDEX social_posts_instagram_media_id_key ON social_posts (instagram_media_id) WHERE instagram_media_id IS NOT NULL;
CREATE INDEX social_posts_status_idx ON social_posts (status, updated_at);
CREATE INDEX social_posts_game_contest_idx ON social_posts (game_id, contest);

-- Cada chamada à Meta (ou simulação) fica registrada.
CREATE TABLE publish_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES social_posts(id),
  operation       TEXT NOT NULL CHECK (operation IN (
                    'create_container', 'container_status', 'media_publish', 'dry_run',
                    'caption', 'render', 'circuit_open', 'claim')),
  attempt         INT NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  http_status     INT,
  outcome         TEXT NOT NULL CHECK (outcome IN ('success', 'retry', 'fail', 'skipped', 'wait', 'ready', 'already_published', 'ok', 'fallback')),
  error_code      TEXT,
  error_message   TEXT,
  response        JSONB,
  duration_ms     INT,
  correlation_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX publish_attempts_post_idx ON publish_attempts (post_id, created_at);

-- Métricas do Instagram (série histórica: uma linha por coleta).
CREATE TABLE instagram_insights (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id             UUID REFERENCES social_posts(id),
  instagram_media_id  TEXT NOT NULL,
  captured_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  metrics             JSONB NOT NULL DEFAULT '{}'::jsonb,
  http_status         INT,
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX instagram_insights_media_idx ON instagram_insights (instagram_media_id, captured_at DESC);

-- ---------------------------------------------------------------------------
-- Observabilidade e controle
-- ---------------------------------------------------------------------------
CREATE TABLE workflow_errors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     TEXT,
  workflow_name   TEXT,
  execution_id    TEXT,
  execution_url   TEXT,
  node            TEXT,
  error_code      TEXT,
  message         TEXT NOT NULL,
  stack           TEXT,
  mode            TEXT,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX workflow_errors_occurred_idx ON workflow_errors (occurred_at DESC);

-- Configurações NÃO secretas. A coluna is_secret existe só para impedir (CHECK)
-- que alguém grave segredo aqui por engano.
CREATE TABLE system_settings (
  key          TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_]+$'),
  value        JSONB NOT NULL,
  description  TEXT,
  source       TEXT NOT NULL DEFAULT 'default' CHECK (source IN ('default', 'env', 'manual')),
  is_secret    BOOLEAN NOT NULL DEFAULT false CHECK (is_secret = false),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE circuit_breakers (
  service             TEXT PRIMARY KEY,
  circuit_status      TEXT NOT NULL DEFAULT 'CLOSED' CHECK (circuit_status IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
  failure_count       INT NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  failure_threshold   INT NOT NULL DEFAULT 5 CHECK (failure_threshold >= 1),
  cooldown_seconds    INT NOT NULL DEFAULT 600 CHECK (cooldown_seconds >= 1),
  last_failure        TIMESTAMPTZ,
  last_success        TIMESTAMPTZ,
  opened_at           TIMESTAMPTZ,
  half_open_probe_at  TIMESTAMPTZ,
  last_error          TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Controle das rodadas de polling (impede duas execuções simultâneas para o mesmo sorteio).
CREATE TABLE result_poll_runs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id            UUID NOT NULL REFERENCES lottery_games(id),
  scheduled_draw_at  TIMESTAMPTZ NOT NULL,
  status             TEXT NOT NULL DEFAULT 'POLLING' CHECK (status IN ('POLLING', 'FOUND', 'EXHAUSTED', 'FAILED')),
  attempts           INT NOT NULL DEFAULT 0,
  cycles             INT NOT NULL DEFAULT 1,
  last_contest_seen  BIGINT,
  last_error         TEXT,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at        TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT result_poll_runs_unique UNIQUE (game_id, scheduled_draw_at)
);

CREATE TABLE health_checks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status      TEXT NOT NULL CHECK (status IN ('ok', 'degraded', 'down')),
  services    JSONB NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

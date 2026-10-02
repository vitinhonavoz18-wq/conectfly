-- =============================================================================
-- Visões para acompanhamento (podem ser abertas no Supabase/pgAdmin/Metabase)
-- =============================================================================

-- Situação dos posts.
CREATE OR REPLACE VIEW v_post_overview AS
SELECT sp.id, sp.type, g.slug AS game, sp.contest, sp.format, sp.status, sp.dry_run, sp.caption_source,
       sp.media_url, sp.instagram_media_id, sp.published_at, sp.last_error, sp.idempotency_key,
       sp.created_at, sp.updated_at,
       (SELECT count(*) FROM publish_attempts pa WHERE pa.post_id = sp.id) AS attempts
FROM social_posts sp JOIN lottery_games g ON g.id = sp.game_id;

-- Última coleta de métricas por post publicado.
CREATE OR REPLACE VIEW v_content_performance AS
SELECT sp.id AS post_id, sp.type AS content_type, g.slug AS game, sp.contest, sp.published_at,
       sp.instagram_media_id, li.captured_at, li.metrics,
       NULLIF(li.metrics->>'views', '')::NUMERIC AS views,
       NULLIF(li.metrics->>'reach', '')::NUMERIC AS reach,
       NULLIF(li.metrics->>'likes', '')::NUMERIC AS likes,
       NULLIF(li.metrics->>'comments', '')::NUMERIC AS comments,
       NULLIF(li.metrics->>'saved', '')::NUMERIC AS saved,
       NULLIF(li.metrics->>'shares', '')::NUMERIC AS shares,
       NULLIF(li.metrics->>'total_interactions', '')::NUMERIC AS total_interactions
FROM social_posts sp
JOIN lottery_games g ON g.id = sp.game_id
LEFT JOIN LATERAL (
  SELECT ii.captured_at, ii.metrics FROM instagram_insights ii
  WHERE ii.instagram_media_id = sp.instagram_media_id AND ii.error IS NULL
  ORDER BY ii.captured_at DESC LIMIT 1
) li ON true
WHERE sp.status = 'PUBLISHED';

-- Comparação RESULT × PREDICTION × CHECK por modalidade.
CREATE OR REPLACE VIEW v_content_performance_summary AS
SELECT content_type, game, count(*) AS posts,
       round(avg(views), 1) AS avg_views, round(avg(reach), 1) AS avg_reach,
       round(avg(total_interactions), 1) AS avg_interactions, round(avg(saved), 1) AS avg_saved,
       round(avg(shares), 1) AS avg_shares
FROM v_content_performance
GROUP BY content_type, game;

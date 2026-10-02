-- =============================================================================
-- RLS ligado em todas as tabelas, SEM políticas.
-- Efeito: se o banco estiver no Supabase, a API REST automática (anon/authenticated)
-- NÃO consegue ler nem escrever nada. O dono das tabelas (usuário do n8n/scripts)
-- continua com acesso normal. Em Postgres comum (Docker) não muda nada.
-- =============================================================================
ALTER TABLE lottery_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE circuit_breakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_poll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;
-- Views herdam a permissão de quem consulta (security_invoker), sem furar o RLS.
ALTER VIEW v_post_overview SET (security_invoker = true);
ALTER VIEW v_content_performance SET (security_invoker = true);
ALTER VIEW v_content_performance_summary SET (security_invoker = true);

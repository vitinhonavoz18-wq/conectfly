-- Alterar a view para usar security_invoker=true (Postgres 15+)
ALTER VIEW public.pizzerias_public SET (security_invoker = true);

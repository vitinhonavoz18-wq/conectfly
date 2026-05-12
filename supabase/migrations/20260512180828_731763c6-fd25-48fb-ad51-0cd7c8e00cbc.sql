-- Restringe leitura pública das credenciais do FlyControl
REVOKE SELECT (
  flycontrol_api_key,
  flycontrol_api_url,
  flycontrol_base_url,
  flycontrol_register_url,
  flycontrol_tenant_id
) ON public.restaurants FROM anon;

-- Garante que o role authenticated continue podendo ler (RLS controla por linha via owner_id)
GRANT SELECT (
  flycontrol_api_key,
  flycontrol_api_url,
  flycontrol_base_url,
  flycontrol_register_url,
  flycontrol_tenant_id
) ON public.restaurants TO authenticated;
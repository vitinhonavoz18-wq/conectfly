/**
 * Conteúdo pronto da Edge Function `create-order` para colar no projeto FLYCONTROL.
 * Cole em: supabase/functions/create-order/index.ts
 * Lembre de configurar `verify_jwt = false` no supabase/config.toml para essa função
 * (ela é chamada por sites públicos com Bearer = api_key da pizzaria).
 */
export const FLYCONTROL_EDGE_FUNCTION_TS = `// supabase/functions/create-order/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const auth = req.headers.get("Authorization") ?? "";
  const apiKey = auth.replace(/^Bearer\\s+/i, "").trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API Key ausente" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: pizzaria, error: pErr } = await supabase
    .from("pizzarias")
    .select("id")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (pErr || !pizzaria) {
    return new Response(JSON.stringify({ error: "API Key inválida" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { error } = await supabase.from("orders").insert({
    pizzaria_id: pizzaria.id,
    customer_name: body.customer_name,
    customer_phone: body.customer_phone,
    customer_address: body.customer_address,
    items: body.items,
    total: body.total,
    payment_method: body.payment_method ?? null,
    change_for: body.change_for ?? null,
    notes: body.notes ?? "",
    status: "novo",
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
`;

export const FLYCONTROL_SCHEMA_SQL = `-- Cole no SQL Editor da Supabase do FLYCONTROL
create extension if not exists pgcrypto;

create table if not exists public.pizzarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  api_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  pizzaria_id uuid not null references public.pizzarias(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  customer_address text not null,
  items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,
  payment_method text,
  change_for numeric,
  notes text default '',
  status text not null default 'novo',
  created_at timestamptz not null default now()
);

alter publication supabase_realtime add table public.orders;

alter table public.orders enable row level security;
alter table public.pizzarias enable row level security;

-- Painel autenticado lê apenas pedidos da sua pizzaria (ajuste conforme seu modelo de auth/admin)
create policy if not exists "orders read for authenticated"
  on public.orders for select
  to authenticated using (true);
`;
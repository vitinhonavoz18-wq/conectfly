/**
 * Edge Function `create-order` (FLYCONTROL).
 * Cole em: supabase/functions/create-order/index.ts
 * Configure `verify_jwt = false` em supabase/config.toml para esta função.
 * Aceita header `x-api-key` (preferido) ou `Authorization: Bearer <key>`.
 */
export const FLYCONTROL_EDGE_FUNCTION_TS = `// supabase/functions/create-order/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
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

  const headerKey = req.headers.get("x-api-key") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  const apiKey = (headerKey || auth.replace(/^Bearer\\s+/i, "")).trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API Key ausente" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: pizzaria, error: pErr } = await supabase
    .from("pizzerias")
    .select("id")
    .eq("api_key", apiKey)
    .eq("status", "active")
    .maybeSingle();

  if (pErr || !pizzaria) {
    return new Response(JSON.stringify({ error: "API Key inválida" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const customerName = body?.customer?.name ?? body?.customer_name ?? "";
  const customerPhone = body?.customer?.phone ?? body?.customer_phone ?? "";
  const addr = body?.address ?? {};
  const customerAddress = typeof addr === "string"
    ? addr
    : [addr.street, addr.number].filter(Boolean).join(", ");
  const neighborhood = (typeof addr === "object" ? addr.neighborhood : null) ?? body?.neighborhood ?? null;

  const { error } = await supabase.from("orders").insert({
    tenant_id: pizzaria.id,
    order_id: body.order_id ?? null,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_address: customerAddress,
    neighborhood,
    items: body.items ?? [],
    total: Number(body.total ?? 0),
    delivery_fee: Number(body.delivery_fee ?? 0),
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

/**
 * Edge Function `create-pizzeria` — auto-cadastro de pizzaria.
 * Cole em: supabase/functions/create-pizzeria/index.ts
 * Configure `verify_jwt = false` em supabase/config.toml.
 * Recebe { name, phone, address, slug } e retorna { tenant_id, api_key }.
 */
export const FLYCONTROL_CREATE_PIZZERIA_TS = `// supabase/functions/create-pizzeria/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "fc_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const name = String(body?.name ?? "").trim();
  const slug = String(body?.slug ?? "").trim();
   const phone = String(body?.phone ?? "").trim();
   const address = String(body?.address ?? "").trim();
   const providedApiKey = String(body?.api_key ?? "").trim();
   if (!name || !slug) {
    return new Response(JSON.stringify({ error: "name e slug obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Idempotência por slug: se já existe, devolve as mesmas credenciais
  const { data: existing } = await supabase
    .from("pizzerias")
    .select("id, api_key")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ tenant_id: existing.id, api_key: existing.api_key }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const api_key = providedApiKey || generateApiKey();
  const { data, error } = await supabase
    .from("pizzerias")
    .insert({ name, slug, phone, address, api_key, status: "active" })
    .select("id, api_key")
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ error: error?.message ?? "Falha ao criar" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ tenant_id: data.id, api_key: data.api_key }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
`;

export const FLYCONTROL_SCHEMA_SQL = `-- Cole no SQL Editor da Supabase do FLYCONTROL
create extension if not exists pgcrypto;

create table if not exists public.pizzerias (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  phone text,
  address text,
  api_key text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.pizzerias(id) on delete cascade,
  order_id text,
  customer_name text not null,
  customer_phone text not null,
  customer_address text not null,
  neighborhood text,
  items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,
  delivery_fee numeric not null default 0,
  payment_method text,
  change_for numeric,
  notes text default '',
  status text not null default 'novo',
  created_at timestamptz not null default now()
);

create index if not exists orders_tenant_created_idx on public.orders(tenant_id, created_at desc);

alter publication supabase_realtime add table public.orders;

alter table public.orders enable row level security;
alter table public.pizzerias enable row level security;

-- Service role (Edge Functions) bypassa RLS automaticamente.
-- Ajuste estas policies conforme o modelo de auth do seu painel:
create policy if not exists "orders read for authenticated"
  on public.orders for select
  to authenticated using (true);
create policy if not exists "pizzerias read for authenticated"
  on public.pizzerias for select
  to authenticated using (true);
`;
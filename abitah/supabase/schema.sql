-- ===========================================================================
-- ABITAH — Estrutura completa do banco (Supabase / PostgreSQL)
-- Execute este arquivo no SQL Editor do Supabase (uma única vez).
-- Depois execute supabase/seed.sql para carregar os dados de demonstração.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- PERFIS (espelha auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text,
  cpf text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

-- Cria o perfil automaticamente a cada novo cadastro.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Função auxiliar usada nas policies (evita recursão de RLS).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- CATEGORIAS
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  group_key text not null default 'roupas' check (group_key in ('roupas', 'acessorios')),
  description text,
  image_url text,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists categories_position_idx on public.categories (position);
create index if not exists categories_group_idx on public.categories (group_key);

-- ---------------------------------------------------------------------------
-- PRODUTOS
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_description text not null default '',
  description text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  subcategory text,
  price numeric(10,2) not null check (price >= 0),
  sale_price numeric(10,2) check (sale_price >= 0),
  cost_price numeric(10,2) check (cost_price >= 0),
  sku text not null unique,
  barcode text,
  material text not null default '',
  care text[] not null default '{}',
  size_guide jsonb not null default '[]'::jsonb,
  weight_grams integer not null default 0,
  height_cm integer not null default 0,
  width_cm integer not null default 0,
  length_cm integer not null default 0,
  is_featured boolean not null default false,
  is_new boolean not null default false,
  is_best_seller boolean not null default false,
  is_active boolean not null default true,
  is_demo boolean not null default false,
  sales_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_active_idx on public.products (is_active);
create index if not exists products_flags_idx on public.products (is_featured, is_new, is_best_seller);
create index if not exists products_created_idx on public.products (created_at desc);
create index if not exists products_price_idx on public.products (price);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- IMAGENS DO PRODUTO
-- ---------------------------------------------------------------------------
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt text not null default '',
  position integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_idx on public.product_images (product_id, position);

-- ---------------------------------------------------------------------------
-- VARIAÇÕES E ESTOQUE
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null default 'Único',
  color text not null default 'Preto',
  color_hex text not null default '#0A0A0A',
  sku text not null default '',
  stock integer not null default 0 check (stock >= 0),
  price_delta numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, size, color)
);

create index if not exists product_variants_product_idx on public.product_variants (product_id);
create index if not exists product_variants_stock_idx on public.product_variants (stock);

-- Movimentações de estoque (histórico opcional, útil para auditoria).
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  change integer not null,
  reason text not null default 'ajuste',
  created_at timestamptz not null default now()
);

create index if not exists inventory_variant_idx on public.inventory (variant_id);

-- ---------------------------------------------------------------------------
-- ENDEREÇOS
-- ---------------------------------------------------------------------------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Casa',
  recipient text not null default '',
  cep text not null,
  street text not null,
  number text not null,
  complement text,
  district text not null,
  city text not null,
  state text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists addresses_user_idx on public.addresses (user_id);

-- ---------------------------------------------------------------------------
-- CUPONS
-- ---------------------------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null default 'percent' check (type in ('percent', 'fixed')),
  value numeric(10,2) not null check (value > 0),
  min_order_value numeric(10,2) not null default 0,
  description text not null default '',
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists coupons_code_idx on public.coupons (code);

-- ---------------------------------------------------------------------------
-- PEDIDOS
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'aguardando'
    check (status in ('aguardando','confirmado','em_separacao','enviado','entregue','cancelado')),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  customer_cpf text,
  shipping_method text not null default '',
  shipping_price numeric(10,2) not null default 0,
  coupon_code text,
  discount numeric(10,2) not null default 0,
  subtotal numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  notes text,
  address jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_idx on public.orders (created_at desc);

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_slug text not null default '',
  image_url text,
  size text not null default '',
  color text not null default '',
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- FAVORITOS
-- ---------------------------------------------------------------------------
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists favorites_user_idx on public.favorites (user_id);

-- ---------------------------------------------------------------------------
-- BANNERS, CONFIGURAÇÕES, NEWSLETTER E CONTATO
-- ---------------------------------------------------------------------------
create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null default '',
  subtitle text not null default '',
  cta_label text not null default '',
  cta_href text not null default '/loja',
  image_url text,
  active boolean not null default true,
  position integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null unique,
  whatsapp text,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null default '',
  subject text not null default '',
  message text not null,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.addresses enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.favorites enable row level security;
alter table public.banners enable row level security;
alter table public.site_settings enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages enable row level security;

-- PERFIS: cada um vê e edita o próprio; admin vê todos.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- CATÁLOGO: leitura pública, escrita apenas para admin.
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories for select using (true);

drop policy if exists "categories_admin_write" on public.categories;
create policy "categories_admin_write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
  for select using (is_active or public.is_admin());

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "product_images_public_read" on public.product_images;
create policy "product_images_public_read" on public.product_images for select using (true);

drop policy if exists "product_images_admin_write" on public.product_images;
create policy "product_images_admin_write" on public.product_images
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "product_variants_public_read" on public.product_variants;
create policy "product_variants_public_read" on public.product_variants for select using (true);

drop policy if exists "product_variants_admin_write" on public.product_variants;
create policy "product_variants_admin_write" on public.product_variants
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "inventory_admin_all" on public.inventory;
create policy "inventory_admin_all" on public.inventory
  for all using (public.is_admin()) with check (public.is_admin());

-- ENDEREÇOS: apenas o dono.
drop policy if exists "addresses_own" on public.addresses;
create policy "addresses_own" on public.addresses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- CUPONS: leitura pública apenas dos ativos (validação server-side).
drop policy if exists "coupons_public_read" on public.coupons;
create policy "coupons_public_read" on public.coupons for select using (active);

drop policy if exists "coupons_admin_write" on public.coupons;
create policy "coupons_admin_write" on public.coupons
  for all using (public.is_admin()) with check (public.is_admin());

-- PEDIDOS: o cliente vê os próprios; qualquer visitante pode criar
-- (checkout como convidado); admin vê e gerencia tudo.
drop policy if exists "orders_insert_any" on public.orders;
create policy "orders_insert_any" on public.orders for insert with check (true);

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "orders_admin_write" on public.orders;
create policy "orders_admin_write" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orders_admin_delete" on public.orders;
create policy "orders_admin_delete" on public.orders for delete using (public.is_admin());

drop policy if exists "order_items_insert_any" on public.order_items;
create policy "order_items_insert_any" on public.order_items for insert with check (true);

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

-- FAVORITOS: apenas o dono.
drop policy if exists "favorites_own" on public.favorites;
create policy "favorites_own" on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- CONTEÚDO DO SITE: leitura pública, escrita admin.
drop policy if exists "banners_public_read" on public.banners;
create policy "banners_public_read" on public.banners for select using (true);

drop policy if exists "banners_admin_write" on public.banners;
create policy "banners_admin_write" on public.banners
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "site_settings_public_read" on public.site_settings;
create policy "site_settings_public_read" on public.site_settings for select using (true);

drop policy if exists "site_settings_admin_write" on public.site_settings;
create policy "site_settings_admin_write" on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- NEWSLETTER e CONTATO: qualquer pessoa envia, somente admin lê.
drop policy if exists "newsletter_insert_any" on public.newsletter_subscribers;
create policy "newsletter_insert_any" on public.newsletter_subscribers
  for insert with check (true);

drop policy if exists "newsletter_admin_read" on public.newsletter_subscribers;
create policy "newsletter_admin_read" on public.newsletter_subscribers
  for select using (public.is_admin());

drop policy if exists "newsletter_admin_write" on public.newsletter_subscribers;
create policy "newsletter_admin_write" on public.newsletter_subscribers
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "contact_insert_any" on public.contact_messages;
create policy "contact_insert_any" on public.contact_messages for insert with check (true);

drop policy if exists "contact_admin_read" on public.contact_messages;
create policy "contact_admin_read" on public.contact_messages
  for all using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- STORAGE — bucket público para as imagens dos produtos
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_select" on storage.objects;
create policy "product_images_public_select" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update" on storage.objects
  for update using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete" on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());

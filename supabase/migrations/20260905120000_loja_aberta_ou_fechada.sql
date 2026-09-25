-- A plaquinha "ABERTO / FECHADO" na porta da loja.
--
-- O QUE ESTAVA FALTANDO
--
-- O painel FlyControl sempre teve o botão "Fechar Loja Agora". Só que aqui,
-- no site que o cliente acessa, não existia onde anotar esse recado: a ficha
-- da loja tinha "site no ar" (`published`) e o texto do horário (`hours`), e
-- mais nada.
--
-- Então o dono apertava o botão, o painel tentava avisar o site, e o site
-- respondia "não sei onde guardar isso". Era como mandar o garçom pendurar a
-- plaquinha de fechado numa porta que não tem prego.
--
-- A DIFERENÇA ENTRE `published` E `is_open`
--
-- São duas perguntas diferentes, e por isso são duas colunas:
--
--   `published` = a loja EXISTE na internet. Some o site inteiro do ar.
--                 É a loja que fechou as portas para sempre, ou que ainda
--                 nem inaugurou.
--
--   `is_open`   = a loja está aceitando pedidos AGORA. O site continua no
--                 ar, o cliente vê o cardápio, os preços e as fotos — só não
--                 consegue finalizar o pedido. É a loja que está de portas
--                 fechadas às 3 da manhã, mas com o cardápio na vitrine.
--
-- Nasce como `true` porque toda loja que já existe hoje está funcionando
-- normalmente. Ninguém acorda amanhã com a loja fechada sem ter pedido isso.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.restaurants.is_open IS
  'Loja aceitando pedidos agora. Diferente de `published`: o site continua '
  'visível, mas o checkout recusa. Controlado pelo botão "Fechar Loja Agora" '
  'do FlyControl e sincronizado pelo menu-sync.';

-- LIBERAR A LEITURA PARA O VISITANTE — SEM ISTO, NADA FUNCIONA.
--
-- A migração `20260903052943` trocou a permissão desta tabela de "a tabela
-- inteira" para "coluna por coluna", e deixou o aviso: coluna nova nasce
-- invisível para quem não fez login.
--
-- Se esta linha não existisse, o efeito seria o pior possível de todos: o
-- dono apertaria "Fechar Loja Agora", o painel diria "salvo com sucesso", a
-- plaquinha ficaria pendurada — e o cliente continuaria fazendo pedido, porque
-- do lado de fora ninguém consegue LER a plaquinha. Loja fechada recebendo
-- pedido é pior do que loja sem botão nenhum.
GRANT SELECT (is_open) ON public.restaurants TO anon;
GRANT SELECT (is_open) ON public.restaurants TO authenticated;

-- E A MESMA ARMADILHA, UM ANDAR ACIMA: A VITRINE.
--
-- O cardápio não lê a ficha da loja direto — ele lê uma VITRINE
-- (`pizzerias_public`), que é uma cópia da ficha mostrando só o que pode ser
-- visto de fora. E essa vitrine tem a lista de campos escrita à mão, um por
-- um.
--
-- É a vitrine da padaria: colocar um pão novo na prateleira lá dentro não faz
-- ele aparecer no vidro da frente. Alguém precisa levar.
--
-- Por isso a plaquinha é adicionada ao final da lista aqui. Sem esta parte, a
-- coluna existiria, o visitante teria permissão de lê-la, e mesmo assim o
-- cardápio continuaria sem enxergar — porque não é ali que ele olha.
CREATE OR REPLACE VIEW public.pizzerias_public AS
 SELECT id,
    slug,
    name,
    tagline,
    description,
    whatsapp_number,
    whatsapp_display,
    address,
    hours,
    city,
    logo_url,
    hero_image_url,
    primary_color,
    secondary_color,
    published,
    hero_media_type,
    hero_video_url,
    flycontrol_enabled,
    flycontrol_api_url,
    whatsapp_enabled,
    flycontrol_base_url,
    flycontrol_tenant_id,
    flycontrol_register_url,
    show_item_images,
    owner_id,
    custom_subdomain,
    selected_template,
    business_type,
    theme_settings,
    site_settings,
    checkout_settings,
    delivery_settings,
    seo_settings,
    order_flow_mode,
    fiqon_webhook_url,
    continue_opening_whatsapp,
    allow_dual_send,
    flycontrol_direct_url,
    menu_sync_endpoint,
    delivery_enabled,
    pickup_enabled,
    table_enabled,
    is_open
   FROM restaurants
  WHERE published = true;

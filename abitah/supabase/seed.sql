-- ===========================================================================
-- ABITAH — Dados iniciais de DEMONSTRAÇÃO
-- Execute depois de supabase/schema.sql.
-- Todos os produtos são criados com is_demo = true e aparecem no painel com o
-- selo "Demonstração" — podem ser editados ou excluídos com segurança.
--
-- Para remover toda a demonstração de uma vez:
--   delete from public.products where is_demo = true;
-- ===========================================================================

-- ------------------------------- CATEGORIAS --------------------------------
insert into public.categories (slug, name, group_key, description, position) values
  ('camisetas', 'Camisetas', 'roupas', 'Malhas respiráveis para treino pesado e uso diário.', 1),
  ('regatas', 'Regatas', 'roupas', 'Liberdade total de ombro para os dias de força.', 2),
  ('shorts', 'Shorts', 'roupas', 'Leveza, elasticidade e secagem rápida.', 3),
  ('calcas-e-leggings', 'Calças e leggings', 'roupas', 'Compressão inteligente para performance e conforto.', 4),
  ('moletons', 'Moletons', 'roupas', 'Aquecimento pré-treino com pegada streetwear.', 5),
  ('bones', 'Bonés', 'acessorios', 'Assinatura ABITAH da academia à rua.', 6),
  ('garrafas-e-coqueteleiras', 'Garrafas e coqueteleiras', 'acessorios', 'Hidratação e suplementação sem complicação.', 7),
  ('mochilas-e-acessorios', 'Mochilas e acessórios', 'acessorios', 'Equipamento de apoio para levar o treino junto.', 8)
on conflict (slug) do nothing;

-- -------------------------------- PRODUTOS ---------------------------------
insert into public.products (
  slug, name, short_description, description, category_id, subcategory,
  price, sale_price, cost_price, sku, material, care, size_guide,
  weight_grams, height_cm, width_cm, length_cm,
  is_featured, is_new, is_best_seller, is_active, is_demo, sales_count
)
select
  d.slug, d.name, d.short_description, d.description,
  c.id, d.subcategory,
  d.price, d.sale_price, d.cost_price, d.sku, d.material,
  array[
    'Lave à máquina em água fria, com peças de cores semelhantes',
    'Não use alvejante ou amaciante em excesso',
    'Seque à sombra — evite secadora em alta temperatura',
    'Passe em temperatura baixa, do avesso, sem passar sobre a estampa'
  ],
  case when d.has_sizes then
    '[{"size":"P","chest":"94 cm","waist":"78 cm","length":"68 cm"},
      {"size":"M","chest":"100 cm","waist":"84 cm","length":"70 cm"},
      {"size":"G","chest":"106 cm","waist":"90 cm","length":"72 cm"},
      {"size":"GG","chest":"112 cm","waist":"96 cm","length":"74 cm"},
      {"size":"XGG","chest":"118 cm","waist":"102 cm","length":"76 cm"}]'::jsonb
  else '[]'::jsonb end,
  d.weight_grams, 6, 26, 34,
  d.is_featured, d.is_new, d.is_best_seller, true, true, d.sales_count
from (values
  ('camiseta-oversized-oficial','Camiseta Oversized Oficial','Caimento amplo, algodão pesado e assinatura ABITAH nas costas.','A Camiseta Oversized Oficial é a peça de entrada da comunidade ABITAH. Confeccionada em algodão penteado de gramatura alta, mantém o caimento estruturado mesmo depois de muitas lavagens. O corte oversized dá liberdade nos movimentos de ombro e um visual streetwear que funciona dentro e fora da academia.','camisetas','Oversized',89.90,null,34.50,'ABT-0001','100% algodão penteado 30.1 — gramatura 185g/m²',260,true,true,true,412,true),
  ('camiseta-dry-fit-performance','Camiseta Dry Fit Performance','Tecido tecnológico que afasta o suor e seca em minutos.','Desenvolvida para os treinos mais intensos, a Dry Fit Performance usa malha em poliamida com canais de ventilação nas laterais e nas costas. Costuras planas evitam atrito em séries longas de puxada e supino.','camisetas','Performance',79.90,64.90,29.90,'ABT-0002','88% poliamida · 12% elastano com tratamento antiodor',180,true,false,true,388,true),
  ('regata-training','Regata Training','Cava ampla e leveza absoluta para os dias de força.','A Regata Training foi desenhada para quem treina pesado e precisa de amplitude total nos ombros. O acabamento em ribana reforçada mantém a gola firme depois de dezenas de lavagens.','regatas',null,69.90,null,24.90,'ABT-0003','60% algodão · 40% poliéster — malha leve 160g/m²',165,false,true,true,297,true),
  ('short-masculino-performance','Short Masculino Performance','Bolsos com zíper, cordão interno e secagem rápida.','Short de treino com tecido leve e forro em compressão que evita atrito em corridas e agachamentos. Ideal para funcional, corrida e treino de pernas.','shorts',null,99.90,null,38.00,'ABT-0004','Poliéster microfibra com forro em elastano',210,true,true,false,214,true),
  ('legging-feminina-high-performance','Legging Feminina High Performance','Cintura alta, compressão firme e tecido que não fica transparente.','A Legging High Performance combina cintura alta com compressão progressiva, sustentando o abdômen sem apertar. O tecido tem teste de opacidade aprovado no agachamento profundo.','calcas-e-leggings','Feminino',129.90,109.90,46.00,'ABT-0005','72% poliamida · 28% elastano — gramatura 280g/m²',240,true,false,true,501,true),
  ('top-esportivo-training','Top Esportivo Training','Sustentação média com alças ajustáveis e costas nadador.','Top de sustentação média pensado para musculação e treinos funcionais. Bojo removível e faixa elástica sob o busto garantem estabilidade sem marcar.','calcas-e-leggings','Feminino',89.90,null,32.00,'ABT-0006','80% poliamida · 20% elastano com bojo removível',140,false,true,false,176,true),
  ('moletom-oficial','Moletom Oficial','Flanelado por dentro, capuz duplo e bordado da marca.','O Moletom Oficial é a peça de aquecimento da comunidade. Capuz duplo, punhos em ribana canelada e bolso canguru forrado, com logotipo em bordado de alta densidade.','moletons',null,189.90,159.90,72.00,'ABT-0007','Moletom flanelado 320g/m² — 80% algodão · 20% poliéster',620,true,false,true,268,true),
  ('bone-oficial','Boné Oficial','Aba curva, fecho regulável e bordado frontal em relevo.','Boné estruturado com aba curva e seis gomos ventilados. A faixa interna absorve o suor durante o treino ao ar livre.','bones',null,69.90,null,22.00,'ABT-0008','Sarja de algodão com forro interno absorvente',120,false,true,false,143,false),
  ('garrafa-esportiva','Garrafa Esportiva','700 ml, livre de BPA, com marcação de volume e bico esportivo.','Garrafa de 700 ml em material resistente e livre de BPA, com marcação lateral de volume. O bico esportivo com trava evita vazamentos na mochila.','garrafas-e-coqueteleiras',null,49.90,null,16.00,'ABT-0009','Tritan livre de BPA · 700 ml',190,false,false,true,322,false),
  ('coqueteleira-oficial','Coqueteleira Oficial','600 ml com mola misturadora e tampa com trava de segurança.','Coqueteleira de 600 ml com mola misturadora em aço inox que dissolve o suplemento sem grumos. Compatível com lava-louças.','garrafas-e-coqueteleiras',null,39.90,null,12.50,'ABT-0010','Polipropileno atóxico com mola em aço inox · 600 ml',160,false,true,false,289,false),
  ('mochila-training','Mochila Training','Compartimento para tênis, bolso térmico e costas ventiladas.','Mochila de 28 litros com compartimento inferior isolado para tênis, bolso térmico e divisória acolchoada para notebook de até 15 polegadas.','mochilas-e-acessorios',null,149.90,129.90,58.00,'ABT-0011','Poliéster 600D com revestimento repelente',780,true,false,true,231,false),
  ('munhequeira-esportiva','Munhequeira Esportiva','Par com velcro reforçado e apoio firme para cargas altas.','Par de munhequeiras com faixa elástica de alta compressão e velcro reforçado, estabilizando o punho em supino, desenvolvimento e movimentos olímpicos.','mochilas-e-acessorios',null,29.90,null,9.00,'ABT-0012','Algodão elástico com velcro reforçado — par',110,false,true,false,198,false),
  ('camiseta-manga-longa-uv','Camiseta Manga Longa UV','Proteção UV 50+ para treinos ao ar livre.','Manga longa com proteção solar UV 50+, indicada para corrida, funcional outdoor e treinos ao ar livre. Polegueira nos punhos mantém as mangas no lugar.','camisetas','Outdoor',109.90,null,41.00,'ABT-0013','Poliamida com proteção UV 50+ e toque gelado',190,false,true,false,87,true),
  ('regata-cavada-power','Regata Cavada Power','Cava profunda para amplitude máxima no treino de costas.','Regata de cava profunda para quem prioriza amplitude total em puxadas e remadas. Barra arredondada que acompanha o movimento sem subir.','regatas',null,74.90,59.90,26.00,'ABT-0014','Malha PV leve com toque seco',155,false,true,false,121,true),
  ('short-feminino-essential','Short Feminino Essential','Cintura alta com compressão leve e bolso interno.','Short de cintura alta com compressão leve, ideal para musculação e treinos funcionais. Tecido de secagem rápida com teste de opacidade aprovado.','shorts','Feminino',89.90,null,33.00,'ABT-0015','76% poliamida · 24% elastano',150,false,true,false,164,true),
  ('calca-jogger-training','Calça Jogger Training','Punho elástico, tecido leve e bolsos com zíper.','Jogger de treino em tecido leve com elastano, punho elástico e bolsos laterais com zíper. Excelente para aquecimento e dias frios.','calcas-e-leggings',null,159.90,null,62.00,'ABT-0016','Poliéster com elastano e tratamento antipilling',380,true,false,false,133,true),
  ('moletom-cropped-community','Moletom Cropped Community','Corte cropped, capuz amplo e assinatura da comunidade.','Moletom cropped com capuz amplo e barra em ribana, pensado para o pré-treino e para o dia a dia. Etiqueta interna com o manifesto da comunidade.','moletons','Feminino',169.90,null,64.00,'ABT-0017','Moletom flanelado 300g/m²',480,false,true,false,118,true),
  ('bone-trucker-neon','Boné Trucker Neon','Tela traseira ventilada com detalhe em verde neon.','Boné modelo trucker com frente estruturada e tela traseira ventilada, perfeito para treinos ao ar livre. Fecho snapback regulável.','bones',null,79.90,64.90,24.00,'ABT-0018','Frente em sarja e traseira em tela ventilada',110,false,true,false,96,false),
  ('garrafa-termica-inox','Garrafa Térmica Inox','Parede dupla que mantém a temperatura por até 12 horas.','Garrafa térmica de 750 ml em aço inox com parede dupla a vácuo. Tampa rosqueável com vedação em silicone e pintura texturizada antideslizante.','garrafas-e-coqueteleiras',null,119.90,null,44.00,'ABT-0019','Aço inox 304 com isolamento a vácuo · 750 ml',420,true,false,false,154,false),
  ('necessaire-gym-bag','Necessaire Gym Bag','Bolsa compacta para acessórios, cinto e suplementos.','Bolsa compacta para organizar cinto, luvas, straps e potes de suplemento dentro da mochila. Divisória interna e alça de mão reforçada.','mochilas-e-acessorios',null,59.90,null,19.00,'ABT-0020','Poliéster 600D com forro impermeável',210,false,true,false,74,false)
) as d(
  slug, name, short_description, description, category_slug, subcategory,
  price, sale_price, cost_price, sku, material, weight_grams,
  is_featured, is_new, is_best_seller, sales_count, has_sizes
)
join public.categories c on c.slug = d.category_slug
on conflict (slug) do nothing;

-- ------------------------ VARIAÇÕES (grade + estoque) ----------------------
-- Roupas: P/M/G/GG/XGG. Acessórios: tamanho Único.
do $$
declare
  prod record;
  sz text;
  col record;
  sizes text[];
  base_stock integer;
begin
  for prod in
    select p.id, p.slug, p.sku, c.group_key
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.is_demo = true
  loop
    if prod.group_key = 'roupas' then
      sizes := array['P','M','G','GG','XGG'];
      base_stock := 12;
    else
      sizes := array['Único'];
      base_stock := 35;
    end if;

    for col in
      select * from (values
        ('Preto', '#0A0A0A'),
        ('Grafite', '#2E3532'),
        ('Branco', '#F5F6F5')
      ) as c(color, hex)
    loop
      foreach sz in array sizes loop
        insert into public.product_variants (product_id, size, color, color_hex, sku, stock)
        values (
          prod.id, sz, col.color, col.hex,
          prod.sku || '-' || upper(left(col.color, 3)) || '-' || sz,
          greatest(0, base_stock - (length(sz) + length(col.color)) % 7)
        )
        on conflict (product_id, size, color) do nothing;
      end loop;
    end loop;
  end loop;
end $$;

-- --------------------------------- CUPONS ----------------------------------
insert into public.coupons (code, type, value, min_order_value, description, active) values
  ('COMUNIDADE10', 'percent', 10, 149, '10% de desconto em compras acima de R$ 149,00', true),
  ('PRIMEIROTREINO', 'fixed', 25, 199, 'R$ 25,00 de desconto na primeira compra acima de R$ 199,00', true),
  ('ABITAH15', 'percent', 15, 299, '15% de desconto em compras acima de R$ 299,00', true)
on conflict (code) do nothing;

-- --------------------------------- BANNERS ---------------------------------
insert into public.banners (key, title, subtitle, cta_label, cta_href, position) values
  ('home_hero', 'TREINE FORTE. VISTA SUA IDENTIDADE.', 'Roupas e acessórios oficiais para quem leva o treino além dos limites.', 'Conhecer coleção', '/loja', 1),
  ('home_community', 'Não é apenas uma marca. É o uniforme de quem não desiste.', 'Cada peça carrega a rotina de quem treina de verdade: disciplina, constância e pertencimento.', 'Conhecer nossa história', '/sobre', 2),
  ('home_showcase', 'Últimos lançamentos', 'As peças mais novas da coleção, direto do nosso desenvolvimento.', 'Ver todos', '/lancamentos', 3)
on conflict (key) do nothing;

-- ----------------------------- CONFIGURAÇÕES -------------------------------
insert into public.site_settings (key, value) values
  ('whatsapp', '5511999999999'),
  ('whatsapp_label', '(11) 99999-9999'),
  ('email', 'contato@abitah.com.br'),
  ('instagram', 'https://instagram.com/abitah'),
  ('facebook', 'https://facebook.com/abitah'),
  ('address', 'Av. das Palmeiras, 1200 - Centro, São Paulo/SP'),
  ('hours', 'Seg a sex, 06h às 22h · Sáb, 08h às 16h'),
  ('free_shipping_threshold', '299')
on conflict (key) do nothing;

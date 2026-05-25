-- Adiciona colunas de configuração à tabela menu_categories
ALTER TABLE public.menu_categories 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'SIMPLE',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_on_public_site BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_directly_in_menu BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_as_clickable_category BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_cart_addition BOOLEAN DEFAULT true;

-- Comentários para documentação
COMMENT ON COLUMN public.menu_categories.type IS 'Tipo da categoria: SIMPLE, FLAVORS, BEVERAGE, SIDE, ADDITIONAL, COMBOS, PIZZA, OTHER';
COMMENT ON COLUMN public.menu_categories.show_directly_in_menu IS 'Se verdadeiro, exibe os itens diretamente no scroll do cardápio público';
COMMENT ON COLUMN public.menu_categories.show_as_clickable_category IS 'Se verdadeiro, exibe a categoria como uma aba/filtro clicável';

-- Garante que projetos antigos tenham valores coerentes
UPDATE public.menu_categories 
SET type = CASE WHEN is_pizza THEN 'PIZZA' ELSE 'SIMPLE' END
WHERE type IS NULL OR type = 'SIMPLE';

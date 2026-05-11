-- Garantir que RLS está ativo
ALTER TABLE public.pizzeria_beverages ENABLE ROW LEVEL SECURITY;

-- Limpar políticas anteriores
DROP POLICY IF EXISTS "Public can view active beverages" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "Authenticated users can manage beverages" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "Enable read access for active beverages" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.pizzeria_beverages;

-- 1. Política de Leitura Pública: Apenas bebidas ativas ou qualquer uma se autenticado
CREATE POLICY "beverages_select_policy"
ON public.pizzeria_beverages
FOR SELECT
USING (is_active = true OR auth.role() = 'authenticated');

-- 2. Política de Inserção: Exige autenticação e pizzeria_id válido
CREATE POLICY "beverages_insert_policy"
ON public.pizzeria_beverages
FOR INSERT
TO authenticated
WITH CHECK (pizzeria_id IS NOT NULL);

-- 3. Política de Atualização: Apenas usuários autenticados
CREATE POLICY "beverages_update_policy"
ON public.pizzeria_beverages
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Política de Exclusão: Apenas usuários autenticados
CREATE POLICY "beverages_delete_policy"
ON public.pizzeria_beverages
FOR DELETE
TO authenticated
USING (true);

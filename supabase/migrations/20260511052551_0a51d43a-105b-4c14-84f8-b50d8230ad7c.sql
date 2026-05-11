-- Remover políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "Public can view active beverages" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "Authenticated users can manage beverages" ON public.pizzeria_beverages;

-- Política de leitura: Qualquer pessoa (público) pode ver bebidas ativas
CREATE POLICY "Enable read access for active beverages"
ON public.pizzeria_beverages
FOR SELECT
USING (is_active = true OR auth.role() = 'authenticated');

-- Política de inserção: Usuários autenticados podem inserir
CREATE POLICY "Enable insert for authenticated users"
ON public.pizzeria_beverages
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política de atualização: Usuários autenticados podem atualizar
CREATE POLICY "Enable update for authenticated users"
ON public.pizzeria_beverages
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Política de exclusão: Usuários autenticados podem excluir
CREATE POLICY "Enable delete for authenticated users"
ON public.pizzeria_beverages
FOR DELETE
TO authenticated
USING (true);

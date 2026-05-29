-- Remove a política restritiva antiga
DROP POLICY IF EXISTS "Admin manages all restaurants" ON public.restaurants;

-- Cria uma política para permitir que o dono gerencie seu restaurante
CREATE POLICY "Owners can manage their own restaurants" 
ON public.restaurants 
FOR ALL 
USING (auth.uid() = owner_id OR auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3'::uuid);

-- Garante que autenticados possam ver os restaurantes (necessário para a listagem inicial)
CREATE POLICY "Authenticated users can view restaurants"
ON public.restaurants
FOR SELECT
USING (true);

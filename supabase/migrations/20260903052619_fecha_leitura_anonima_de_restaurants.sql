-- Fecha a leitura anônima da tabela de lojas.
--
-- O QUE ESTAVA ACONTECENDO
--
-- A tabela `restaurants` guarda, em duas colunas, os segredos que ligam o
-- cardápio ao painel: `flycontrol_api_key` e `menu_sync_token`.
--
-- Existiam três regras de leitura liberadas para o papel `public`, que inclui
-- o VISITANTE NÃO LOGADO:
--
--   "Public read access for restaurants"      -> liberava tudo (qual = true)
--   "Authenticated users can view restaurants"-> liberava tudo (qual = true)
--   "Public can view published restaurants"   -> liberava as publicadas
--
-- Como o papel anônimo também tem permissão de SELECT na tabela, qualquer
-- pessoa na internet conseguia pedir a lista e receber as chaves de todas as
-- lojas. Verificado na prática antes desta migração: 20 chaves e 21 tokens
-- vieram numa única chamada, sem nenhum login.
--
-- É a chave reserva do restaurante deixada embaixo do tapete da entrada:
-- ninguém precisa arrombar nada, basta saber levantar o tapete. E o endereço
-- do tapete estava escrito no próprio site.
--
-- POR QUE FECHAR NÃO DERRUBA O CARDÁPIO
--
-- O cardápio que o cliente final abre NÃO lê esta tabela. Ele lê a vitrine
-- `pizzerias_public`, que é uma view montada pelo dono do banco e que já
-- escolhe a dedo o que sai para a rua — as chaves nunca estiveram nela.
--
-- A vitrine continua funcionando exatamente como antes: ela é servida com os
-- privilégios de quem a montou, e não com os de quem está olhando.
--
-- O QUE MUDA PARA QUEM ESTÁ LOGADO
--
-- Nada. Quem entra no painel interno continua enxergando as mesmas lojas de
-- sempre. A regra nova é a mesma de antes, só que restrita a quem tem conta.

-- 1) Fora as três portas que estavam destrancadas para a rua.
DROP POLICY IF EXISTS "Public read access for restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Authenticated users can view restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Public can view published restaurants" ON public.restaurants;

-- 2) Uma porta só, e só para quem tem conta.
--
-- Mantém de propósito o mesmo alcance de antes (todas as lojas) para não
-- quebrar o painel interno: hoje 16 das 21 lojas não têm dono registrado,
-- porque foram criadas automaticamente pelo painel. Restringir por dono agora
-- faria essas 16 sumirem da tela de quem administra.
CREATE POLICY "restaurants_select_autenticado"
  ON public.restaurants
  FOR SELECT
  TO authenticated
  USING (true);

-- 3) O visitante não logado não tem mais o que fazer nesta tabela.
--
-- Ele nunca precisou escrever aqui; a permissão estava concedida por herança
-- e só não virava estrago porque a proteção por linha barrava. Tirar a
-- permissão é trancar a porta ALÉM de deixar o cão solto no quintal — se um
-- dia alguém afrouxar a proteção por linha sem perceber, a porta continua
-- trancada.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.restaurants FROM anon;
REVOKE SELECT ON public.restaurants FROM anon;

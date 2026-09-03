-- Correção da migração anterior: fechar a tabela inteira foi longe demais.
--
-- O QUE DEU ERRADO NA TENTATIVA ANTERIOR
--
-- Tirar do visitante a leitura de `restaurants` inteira parecia seguro,
-- porque o cardápio lê pela vitrine `pizzerias_public`. Só que várias regras
-- de OUTRAS tabelas do cardápio fazem uma pergunta a esta aqui antes de
-- liberar a linha — do tipo "essa loja está publicada?".
--
-- Quando o visitante perdeu o direito de olhar a tabela, ele também perdeu o
-- direito de fazer essa pergunta. Combos e catálogo de bebidas pararam de
-- carregar no cardápio.
--
-- É como trancar o arquivo do escritório para proteger a pasta de senhas e,
-- sem querer, impedir a recepcionista de conferir se o cliente tem reserva:
-- o que ela precisava não era a pasta de senhas, era o caderno de reservas
-- que estava no mesmo armário.
--
-- A CORREÇÃO
--
-- O visitante volta a poder abrir o armário e consultar o caderno — mas as
-- duas gavetas de segredo ficam trancadas individualmente.
--
-- Na prática: em vez de negar a TABELA, negamos as duas COLUNAS que guardam
-- segredo (`flycontrol_api_key` e `menu_sync_token`). Todo o resto volta a
-- funcionar exatamente como antes, e as chaves ficam inalcançáveis.
--
-- ATENÇÃO PARA O FUTURO
--
-- A permissão passou a ser coluna por coluna. Se um dia for criada uma coluna
-- nova nesta tabela, o visitante NÃO vai poder lê-la até alguém liberar. Isso
-- é de propósito: o padrão seguro é a porta nascer fechada. Se a coluna nova
-- guardar mais um segredo, basta não liberar.

-- 1) Devolve ao visitante o direito de enxergar as lojas PUBLICADAS.
CREATE POLICY "restaurants_select_publicadas_anon"
  ON public.restaurants
  FOR SELECT
  TO anon
  USING (published = true);

-- 2) E nega o acesso APENAS às duas colunas que guardam segredo.
REVOKE SELECT ON public.restaurants FROM anon;
DO $$
DECLARE colunas text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO colunas
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'restaurants'
    AND column_name NOT IN ('flycontrol_api_key', 'menu_sync_token');
  EXECUTE format('GRANT SELECT (%s) ON public.restaurants TO anon', colunas);
END $$;

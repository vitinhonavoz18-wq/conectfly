-- Fecha as sessões de mesa para quem não está logado.
--
-- O QUE ESTAVA ABERTO
--
-- A tabela `dining_sessions` guarda, para cada mesa aberta, dois códigos:
-- `table_token` e `customer_token`. São eles que identificam "esta mesa" e
-- "este cliente sentado nela" na hora de lançar item na comanda ou pedir a
-- conta.
--
-- A regra chamava-se "readable by anyone with the id" — legível por quem tem
-- o id. Mas o que estava escrito era `true`, ou seja: legível por QUALQUER
-- UM, e a lista inteira de uma vez.
--
-- É a diferença entre o cliente mostrar a comanda dele na entrada e o garçom
-- deixar o bloco de comandas de todas as mesas no balcão da rua. Com esses
-- códigos na mão, alguém de fora poderia lançar item na comanda de uma mesa
-- que não é dele.
--
-- POR QUE FECHAR NÃO ATRAPALHA O CLIENTE
--
-- O cliente sentado à mesa nunca conversou direto com esta tabela. Tudo o que
-- ele faz — abrir a mesa pelo QR Code, pedir, chamar a conta — passa antes
-- pelo servidor do cardápio, que atende com credencial própria e continua
-- enxergando tudo. Conferido: os cinco caminhos públicos de mesa
-- (`src/routes/api/public/`) usam o acesso de servidor, nenhum usa o acesso
-- do navegador.

DROP POLICY IF EXISTS "dining_sessions readable by anyone with the id" ON public.dining_sessions;

CREATE POLICY "dining_sessions_select_autenticado"
  ON public.dining_sessions
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.dining_sessions FROM anon;

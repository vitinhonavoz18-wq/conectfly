-- SEGURANÇA: o código do QR Code de cada mesa sai da vitrine.
--
-- O PROBLEMA
--
-- A tabela das mesas tinha leitura liberada para todo mundo — e dentro dela
-- fica o `public_token`, que é exatamente o código do QR Code colado na mesa.
-- É esse código que o FlyControl aceita como prova de que o pedido veio
-- daquela mesa.
--
-- Ou seja: qualquer pessoa, sem conta nenhuma, listava o QR Code de TODAS as
-- mesas de TODOS os restaurantes. É como se os adesivos de QR Code de todas as
-- mesas estivessem impressos num cartaz na calçada — não precisa nem entrar no
-- salão para lançar pedido na mesa dos outros.
--
-- POR QUE FECHAR NÃO ATRAPALHA O CLIENTE
--
-- O cliente que escaneia o QR Code nunca lê esta tabela pelo navegador. Ele
-- manda o código para o servidor do cardápio, e é o servidor — com credencial
-- própria, que não passa por estas regras — quem confere. Conferido: todos os
-- usos desta tabela no código estão em `src/routes/api/public/`, todos pelo
-- acesso de servidor.
--
-- O dono do restaurante, logado, continua administrando as mesas dele.
drop policy if exists "Public read tables" on public.restaurant_tables;
drop policy if exists "Public can view active restaurant tables" on public.restaurant_tables;

revoke select, insert, update, delete on public.restaurant_tables from anon;

-- SEGURANÇA: as comandas de mesa também saem da vitrine.
--
-- A regra chamava-se "o uuid já é a credencial" — a ideia era que só quem
-- tivesse o identificador da comanda a enxergaria. Só que o que estava escrito
-- era "pode tudo": dava para listar as comandas de todos os restaurantes de
-- uma vez, sem conhecer identificador nenhum.
--
-- É a diferença entre o cliente mostrar a comanda dele e o garçom deixar o
-- bloco de comandas de todas as mesas no balcão da rua.
--
-- Aqui também quem conversa com esta tabela é sempre o servidor do cardápio.
drop policy if exists "Anon can view any table session (uuid is capability)" on public.table_sessions;

create policy "comandas: só o dono do restaurante"
  on public.table_sessions for select to authenticated
  using (
    exists (select 1 from public.restaurants r
            where r.id = table_sessions.restaurant_id and r.owner_id = auth.uid())
  );

revoke select, insert, update, delete on public.table_sessions from anon;

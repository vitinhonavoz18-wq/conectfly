-- Endereço curto para as lojas que ainda não têm um.
--
-- O site já abre a loja tanto pelo endereço longo (slug, ex.: /teste-001-5srj)
-- quanto pelo nome curto (custom_subdomain, ex.: /acaielove). Esta migração só
-- PREENCHE o nome curto das lojas que estão sem ele, usando o nome da loja sem
-- acento, espaço ou símbolo. Não mexe em nenhum nome curto já existente e não
-- toca no slug — então todo link antigo continua funcionando.
--
-- Se o nome curto ficaria vazio, igual a uma página interna do sistema, ou já
-- é usado por outra loja (como nome curto OU como slug), a loja é pulada e
-- segue com o endereço longo — em vez de arriscar duas lojas disputando o mesmo
-- endereço.
DO $$
DECLARE
  r record;
  candidato text;
  reservados text[] := ARRAY[
    'admin','dashboard','settings','create','restaurants','pizzerias',
    'templates','configuracoes','login','api','edit','export','debug-host',
    'paulo-ferraro'
  ];
BEGIN
  FOR r IN
    SELECT id, name
    FROM public.restaurants
    WHERE custom_subdomain IS NULL OR btrim(custom_subdomain) = ''
    ORDER BY created_at, id
  LOOP
    candidato := left(
      regexp_replace(
        translate(
          lower(coalesce(r.name, '')),
          'áàâãäéèêëíìîïóòôõöúùûüçñ',
          'aaaaaeeeeiiiiooooouuuucn'
        ),
        '[^a-z0-9]', '', 'g'
      ),
      40
    );

    CONTINUE WHEN candidato = '' OR candidato = ANY (reservados);

    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.restaurants o
      WHERE o.id <> r.id
        AND (o.custom_subdomain = candidato OR o.slug = candidato)
    );

    UPDATE public.restaurants SET custom_subdomain = candidato WHERE id = r.id;
  END LOOP;
END $$;

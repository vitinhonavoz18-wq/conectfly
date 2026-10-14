-- Endereço escolhido pela própria loja (conectfly.com.br/<endereço>).
--
-- O QUE ESTA MIGRAÇÃO FAZ
--
-- 1. Cria o "caderno de endereços" (store_addresses): uma linha por endereço
--    que alguma loja já usou — o longo (slug), o curto atual (custom_subdomain)
--    e os curtos antigos. A chave da tabela é o próprio endereço, então o
--    mesmo endereço NUNCA tem dois donos. É o caderno de reservas que só
--    aceita um nome por mesa: se tentar escrever dois, a caneta trava.
--
-- 2. Um gatilho em restaurants: toda vez que uma loja nasce ou troca de slug
--    ou de nome curto, o novo endereço é anotado no caderno na mesma operação.
--    Se outra loja já tem aquele endereço (inclusive como nome ANTIGO), a
--    gravação inteira é recusada com o erro padrão de duplicado (23505). Quem
--    salvar primeiro fica com o nome; o segundo recebe "já está em uso".
--
-- 3. Os endereços antigos NÃO são apagados do caderno quando a loja troca de
--    nome. Eles continuam dela: o QR Code impresso e o link divulgado seguem
--    abrindo a loja (o site redireciona para o nome novo), e nenhuma outra
--    loja consegue pegar aquele nome logo em seguida.
--
-- 4. resolve_store_address(): o site público pergunta "esse endereço antigo é
--    de quem, e qual o endereço atual?". Só responde para loja publicada e só
--    devolve o endereço atual — nenhum outro dado da loja.
--
-- O QUE NÃO MUDA
--
-- Nenhum slug nem nome curto existente é alterado. Cardápio, pedidos, mesas e
-- a sincronização com o FlyControl (que usam o slug e o id) seguem iguais.
-- Conferido antes (14/10/2026): nenhum endereço é usado por duas lojas hoje,
-- então o preenchimento inicial não tem conflito.

CREATE TABLE IF NOT EXISTS public.store_addresses (
  address text PRIMARY KEY
    CHECK (address <> '' AND address = lower(btrim(address))),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_addresses_restaurant
  ON public.store_addresses (restaurant_id);

-- Só o servidor (chave de serviço) e as funções abaixo mexem no caderno.
ALTER TABLE public.store_addresses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_addresses FROM anon, authenticated;

-- Preenchimento inicial: todos os endereços que as lojas usam hoje. Em caso
-- de conflito (não há nenhum hoje), fica com a loja mais antiga.
INSERT INTO public.store_addresses (address, restaurant_id, created_at)
SELECT address, id, created_at
FROM (
  SELECT lower(btrim(slug)) AS address, id, created_at FROM public.restaurants
  WHERE slug IS NOT NULL AND btrim(slug) <> ''
  UNION ALL
  SELECT lower(btrim(custom_subdomain)), id, created_at FROM public.restaurants
  WHERE custom_subdomain IS NOT NULL AND btrim(custom_subdomain) <> ''
) AS todos
ORDER BY created_at, id
ON CONFLICT (address) DO NOTHING;

CREATE OR REPLACE FUNCTION public.reserve_store_addresses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a text;
  dono uuid;
BEGIN
  FOREACH a IN ARRAY ARRAY[NEW.slug, NEW.custom_subdomain] LOOP
    a := lower(btrim(coalesce(a, '')));
    CONTINUE WHEN a = '';

    -- Valor que não mudou nesta gravação: nada a conferir. (O editor do
    -- SiteCreatorFly regrava slug e nome curto a cada "salvar".)
    IF TG_OP = 'UPDATE' AND (
      a = lower(btrim(coalesce(OLD.slug, '')))
      OR a = lower(btrim(coalesce(OLD.custom_subdomain, '')))
    ) THEN
      CONTINUE;
    END IF;

    -- Se outra gravação simultânea estiver anotando o mesmo endereço, esta
    -- espera ela terminar; depois, quem chegou primeiro é o dono.
    INSERT INTO public.store_addresses (address, restaurant_id)
    VALUES (a, NEW.id)
    ON CONFLICT (address) DO NOTHING;

    SELECT restaurant_id INTO dono FROM public.store_addresses WHERE address = a;
    IF dono IS DISTINCT FROM NEW.id THEN
      RAISE EXCEPTION 'store_address_taken: %', a
        USING ERRCODE = '23505', CONSTRAINT = 'store_addresses_pkey';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_store_addresses() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS restaurants_reserve_addresses ON public.restaurants;
CREATE TRIGGER restaurants_reserve_addresses
  AFTER INSERT OR UPDATE OF slug, custom_subdomain ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.reserve_store_addresses();

CREATE OR REPLACE FUNCTION public.resolve_store_address(p_address text)
RETURNS TABLE (current_address text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(nullif(btrim(r.custom_subdomain), ''), r.slug)
  FROM public.store_addresses a
  JOIN public.restaurants r ON r.id = a.restaurant_id
  WHERE a.address = lower(btrim(p_address))
    AND r.published = true
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_store_address(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_store_address(text) TO anon, authenticated;

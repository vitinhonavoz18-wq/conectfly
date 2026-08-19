import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { searchAddress } from "@/lib/zecarreto/services/geocode.service";

/**
 * Transforma endereço escrito em ponto no mapa.
 *
 * A busca passa pelo NOSSO servidor de propósito: assim, quando um dia
 * houver uma chave paga de mapas, ela fica aqui e nunca chega ao celular
 * do cliente — como a chave do cofre ficar com o gerente, não na mão de
 * quem faz o depósito.
 */
export const Route = createFileRoute("/api/zecarreto/geocode")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        public: true,
        handler: async ({ query }) =>
          searchAddress({
            q: query.get("q") ?? "",
            limit: Number(query.get("limit") ?? 5),
          }),
      }),
    },
  },
});

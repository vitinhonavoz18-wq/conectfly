import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { getSetting } from "@/lib/zecarreto/services/settings.service";

/**
 * O que a tela de entrada precisa saber antes de qualquer login:
 * quais botões de login social mostrar e onde estão os termos.
 *
 * Os provedores só aparecem se estiverem ligados AQUI e também no painel
 * do Supabase — a lista sozinha não liga nada, ela só revela o botão.
 */
export const Route = createFileRoute("/api/zecarreto/auth/config")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        public: true,
        handler: async () => ({
          social_providers: await getSetting<string[]>("auth.social_providers", []),
          terms_url: await getSetting<string>("terms.url", ""),
          client_terms_version: await getSetting<string>("terms.client_version", "1"),
          driver_terms_version: await getSetting<string>("terms.driver_version", "1"),
        }),
      }),
    },
  },
});

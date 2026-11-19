import { createMiddleware, createStart } from "@tanstack/react-start";

import { menuDomainRedirect } from "./lib/site/publicDomain";

/**
 * Leva quem abre um cardápio pelo endereço antigo (conectfly.com.br/<loja>)
 * para o endereço oficial (cardapio.flydelivery.app/<loja>) — ver
 * src/lib/site/publicDomain.ts.
 *
 * Interruptor: MENU_LEGACY_REDIRECT (wrangler.jsonc → "vars").
 *   "true"  → redireciona;
 *   qualquer outro valor → o endereço antigo volta a mostrar o cardápio direto,
 *   como antes. É o botão de "voltar atrás" sem mexer em código.
 */
const menuDomainMiddleware = createMiddleware().server(async ({ next, request }) => {
  const enabled = String(process.env.MENU_LEGACY_REDIRECT ?? "").trim() === "true";
  const destino = menuDomainRedirect(request.url, enabled);
  if (destino) {
    return new Response(null, {
      status: destino.status,
      headers: {
        location: destino.location,
        // 301 fica guardado no navegador; um dia de validade limita o estrago
        // se algum dia for preciso desfazer.
        "cache-control": destino.status === 301 ? "public, max-age=86400" : "no-store",
      },
    });
  }
  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [menuDomainMiddleware],
}));

/**
 * ONDE MORAM OS CARDÁPIOS — o único lugar que define os endereços.
 *
 * Endereço oficial (novembro de 2026): https://cardapio.flydelivery.app/<loja>
 *
 * Antes os cardápios abriam em https://conectfly.com.br/<loja>. Esse endereço
 * CONTINUA funcionando: quem chega por ele (link antigo, QR Code já impresso
 * na mesa, cartaz na vitrine) é levado para o mesmo cardápio no endereço novo,
 * com tudo o que veio junto no link (?mode=table&table_token=..., ?mesa=...).
 * É a placa "mudamos para a loja ao lado" — o cliente entra do mesmo jeito.
 *
 * O que NÃO muda de endereço (de propósito):
 *  - as rotas /api/* — o painel FlyDelivery e as integrações conversam com o
 *    site por elas, servidor com servidor. Continuam em conectfly.com.br e
 *    também respondem no endereço novo (é o mesmo programa nos dois).
 *  - o editor interno do SiteCreatorFly (/, /login, /edit/...) — ferramenta da
 *    equipe Connectfly, não do cliente final.
 *
 * Por que um subdomínio e não flydelivery.app/<loja>: em flydelivery.app moram
 * a página de vendas e o painel do restaurante (/login, /dashboard, /plans...).
 * Uma loja chamada "login" ou "plans" brigaria com o painel pelo mesmo
 * endereço. Com "cardapio." na frente, cada um tem sua porta.
 */

/** Endereço oficial dos cardápios. */
export const MENU_HOST = "cardapio.flydelivery.app";
export const MENU_ORIGIN = `https://${MENU_HOST}`;

/** Página de vendas / painel do FlyDelivery. */
export const PRODUCT_ORIGIN = "https://flydelivery.app";

/** Endereços antigos dos cardápios — continuam abrindo (com redirecionamento). */
export const LEGACY_MENU_HOSTS = ["conectfly.com.br", "www.conectfly.com.br"] as const;

/**
 * Onde o painel e as integrações chamam a API (servidor com servidor).
 * Fica no endereço antigo até o painel aceitar o novo nos dois lados — ver
 * docs/MIGRACAO-CARDAPIOS-FLYDELIVERY.md, "Fase 2".
 */
export const API_ORIGIN = "https://conectfly.com.br";

/** Origens (sites) que podem conversar com a API pelo navegador. */
export const MENU_ORIGINS: readonly string[] = [
  MENU_ORIGIN,
  PRODUCT_ORIGIN,
  "https://www.flydelivery.app",
  ...LEGACY_MENU_HOSTS.map((h) => `https://${h}`),
];

/** Este endereço serve cardápios? (novo, antigos ou o computador de quem programa) */
export function isMenuHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return true;
  return h === MENU_HOST || (LEGACY_MENU_HOSTS as readonly string[]).includes(h);
}

export function isMenuOrigin(origin: string | null | undefined): boolean {
  return !!origin && MENU_ORIGINS.includes(origin);
}

/**
 * Nomes que nunca são loja — páginas do próprio sistema. Mantido aqui (e não
 * importado de format.ts) para este arquivo não carregar nada no servidor
 * além do necessário. O teste garante que as duas listas não se separam.
 */
const NOT_A_STORE = new Set([
  "admin", "dashboard", "settings", "create", "restaurants", "pizzerias",
  "templates", "configuracoes", "login", "api", "edit", "export",
  "debug-host", "paulo-ferraro", "assets", "static", "public", "www", "app",
  "auth", "logout", "signup", "cadastro", "checkout", "carrinho", "pedido",
  "pedidos", "cardapio", "menu", "mesa", "table", "pagamento", "billing",
  "planos", "plans", "privacidade", "privacy", "termos", "terms", "suporte",
  "ajuda", "contato", "flycontrol", "sitecreatorfly", "flydelivery",
  "favicon", "robots", "sitemap", "index", "null", "undefined",
]);

export function isReservedPath(segment: string): boolean {
  return NOT_A_STORE.has(segment.toLowerCase());
}

/**
 * Para onde mandar quem chegou, ou null se a página é aqui mesmo.
 *
 * - conectfly.com.br/<loja>?...  → 301 para cardapio.flydelivery.app/<loja>?...
 * - cardapio.flydelivery.app/    → 302 para flydelivery.app (não há "loja" na raiz)
 *
 * Só o primeiro nível (/<loja>) é redirecionado: é a única forma de endereço
 * de cardápio que existe. Arquivos (com ponto no nome), /api/*, o editor e as
 * páginas reservadas ficam onde estão.
 */
export function menuDomainRedirect(
  rawUrl: string,
  legacyRedirectEnabled: boolean,
): { location: string; status: 301 | 302 } | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === MENU_HOST) {
    if (segments.length === 0) return { location: `${PRODUCT_ORIGIN}/`, status: 302 };
    return null;
  }

  if (!legacyRedirectEnabled) return null;
  if (!(LEGACY_MENU_HOSTS as readonly string[]).includes(host)) return null;
  if (segments.length !== 1) return null;

  const segment = segments[0];
  if (segment.includes(".")) return null; // arquivo (favicon.ico, robots.txt...)
  if (isReservedPath(segment)) return null;

  return { location: `${MENU_ORIGIN}/${segment}${url.search}${url.hash}`, status: 301 };
}

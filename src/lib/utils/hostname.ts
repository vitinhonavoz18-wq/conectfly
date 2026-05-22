/**
 * Utilitário para detecção de subdomínios e slug do ConectFly
 */

export const BASE_DOMAIN = "conectfly.com.br";
export const ALTERNATIVE_DOMAIN = "conectfly.lovable.app";

/**
 * Retorna o subdomínio se houver um, caso contrário retorna null.
 * ATUALIZAÇÃO: Agora retorna null por padrão para ignorar subdomínios como identificadores de pizzaria.
 */
export function getSubdomain(): string | null {
  if (typeof window === "undefined") return null;

  const hostname = window.location.hostname;
  
  // Se estiver em localhost ou ip, não há subdomínio relevante
  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  // Se o hostname for diferente do domínio base, pode ser um subdomínio
  // Mas conforme nova regra, não usaremos mais para identificar pizzarias
  // Retornamos apenas para fins de log ou redirecionamento se necessário
  const parts = hostname.split(".");
  if (parts.length > 3 && hostname.endsWith(BASE_DOMAIN)) {
    const sub = parts[0];
    if (sub !== "www") return sub;
  }
  
  return null;
}

/**
 * Resolve o identificador da pizzaria (SEMPRE via path/slug agora)
 */
export function getPizzeriaIdentifier(routeSlug?: string): string {
  // Se o routeSlug foi passado (via parâmetro de rota /$slug), usamos ele
  if (routeSlug) {
    console.log("DEBUG IDENTIFIER - ROUTE SLUG:", routeSlug);
    return routeSlug;
  }

  // Fallback para extração manual do pathname se não houver routeSlug
  if (typeof window !== "undefined") {
    const pathname = window.location.pathname;
    const parts = pathname.split('/').filter(Boolean);
    
    // O primeiro segmento do path é o slug da pizzaria
    // Ex: /cheirosaa-pizzaria -> cheirosaa-pizzaria
    const cleanSlug = parts[0] || "";
    
    console.log("DEBUG IDENTIFIER - CLEAN SLUG FROM PATH:", cleanSlug);
    return cleanSlug;
  }

  return "";
}

/**
 * Verifica se deve redirecionar de um subdomínio para o domínio principal
 */
export function checkSubdomainRedirect(): void {
  if (typeof window === "undefined") return;

  const hostname = window.location.hostname;
  const subdomain = getSubdomain();

  // Se estivermos em um subdomínio (que não seja www) e no domínio oficial
  if (subdomain && hostname.endsWith(BASE_DOMAIN) && !hostname.startsWith("www.")) {
    // Redireciona para conectfly.com.br/subdominio
    const newUrl = `https://${BASE_DOMAIN}/${subdomain}${window.location.pathname}${window.location.search}`;
    console.log("REDIRECTING FROM SUBDOMAIN TO PATH:", newUrl);
    window.location.href = newUrl;
  }
}

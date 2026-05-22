/**
 * Utilitário para detecção de subdomínios e slug do ConectFly
 */

export const BASE_DOMAIN = "conectfly.com.br";
export const ALTERNATIVE_DOMAIN = "conectfly.lovable.app";

/**
 * Retorna o subdomínio se houver um, caso contrário retorna null.
 * Ignora "www", "localhost" e os domínios base.
 */
export function getSubdomain(): string | null {
  if (typeof window === "undefined") return null;

  const hostname = window.location.hostname;
  
  // Se estiver em localhost ou ip, não há subdomínio relevante
  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  // Verifica se o hostname termina com os domínios base
  const isBaseDomain = hostname === BASE_DOMAIN || hostname === ALTERNATIVE_DOMAIN;
  if (isBaseDomain) return null;

  // Extrai o subdomínio
  const parts = hostname.split(".");
  let subdomain: string | null = null;
  
  // Ex: cheirosaa.conectfly.com.br -> ["cheirosaa", "conectfly", "com", "br"] -> sub seria "cheirosaa"
  // Ex: cheirosaa.conectfly.lovable.app -> sub seria "cheirosaa"
  
  if (hostname.endsWith(BASE_DOMAIN)) {
     // Para conectfly.com.br, o domínio tem 3 partes (conectfly, com, br)
     if (parts.length > 3) {
       const sub = parts[0];
       if (sub !== "www") subdomain = sub;
     }
  } else if (hostname.endsWith(ALTERNATIVE_DOMAIN)) {
    // Para conectfly.lovable.app, o domínio tem 3 partes
    if (parts.length > 3) {
      const sub = parts[0];
      if (sub !== "www") subdomain = sub;
    }
  } else {
    // Suporte genérico para outros domínios se houver mais de 2 partes
    // Ex: pizzaria.outrodominio.com -> sub seria "pizzaria"
    if (parts.length > 2) {
      const sub = parts[0];
      if (sub !== "www") subdomain = sub;
    }
  }

  // LOGS SEMPRE ATIVOS PARA DEPURAÇÃO (Conforme solicitado)
  console.log("HOST:", hostname);
  console.log("SUBDOMAIN:", subdomain);

  return subdomain;
}

/**
 * Resolve o identificador da pizzaria (seja via subdomínio ou via path/slug)
 */
export function getPizzeriaIdentifier(routeSlug?: string): string {
  const subdomain = getSubdomain();
  
  // LOGS ADICIONAIS PARA DEPURAÇÃO
  console.log("DEBUG IDENTIFIER - SUBDOMAIN:", subdomain);
  console.log("DEBUG IDENTIFIER - ROUTE SLUG:", routeSlug);

  if (subdomain) return subdomain;

  if (routeSlug) return routeSlug;

  // Fallback para extração manual do pathname se não houver routeSlug
  if (typeof window !== "undefined") {
    const pathname = window.location.pathname;
    const cleanSlug = pathname
      .split('?')[0]
      .replace(/^\/+|\/+$/g, '')
      .trim();
    
    console.log("DEBUG IDENTIFIER - CLEAN SLUG FROM PATH:", cleanSlug);
    return cleanSlug;
  }

  return "";
}

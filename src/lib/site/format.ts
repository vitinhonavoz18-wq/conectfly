const PUBLIC_SITE_DOMAIN = "conectfly.com.br";
const PUBLIC_SITE_URL = `https://${PUBLIC_SITE_DOMAIN}`;

export function getPizzeriaPublicUrl(slug: string, subdomain?: string | null): string {
  if (subdomain) {
    return `https://${subdomain}.${PUBLIC_SITE_DOMAIN}`;
  }
  
  if (!slug) return PUBLIC_SITE_URL;
  // Remove trailing slash from base if present, then add /slug
  const base = PUBLIC_SITE_URL.replace(/\/$/, "");
  return `${base}/${slug}`;
}

export function formatDateTime(date?: string | Date): string {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export const formatCurrency = formatBRL;

export function formatPhoneMask(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}
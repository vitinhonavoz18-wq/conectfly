/**
 * Endereço e chave pública do Supabase entregues em tempo de execução.
 *
 * POR QUE ISTO EXISTE
 *
 * As variáveis `VITE_*` são lidas no momento em que o site é *compilado*,
 * não quando alguém abre a página. Se a máquina que compila não tiver esses
 * valores, eles não somem com um aviso: entram vazios no pacote publicado, e
 * o site sobe quebrado.
 *
 * Foi o que aconteceu: o endereço estava preenchido, a chave não. O pacote
 * publicado ficou com um `throw` no lugar da chave, e todo site de
 * restaurante abria em "Something went wrong".
 *
 * É como imprimir o cardápio com o telefone da loja em branco: o erro não
 * aparece na gráfica, aparece quando o primeiro cliente tenta ligar.
 *
 * Agora o valor é perguntado ao servidor na hora, onde ele já existe e é o
 * mesmo usado por todo o resto do sistema. Uma recompilação sem essas
 * variáveis não derruba mais o site.
 *
 * NÃO HÁ SEGREDO AQUI. A chave publicável é feita para ficar visível no
 * navegador — é ela que já ia dentro do pacote antes. Quem protege os dados
 * é o RLS (as regras de acesso do banco), não o sigilo dessa chave. A chave
 * de serviço, essa sim secreta, nunca passa por este caminho.
 */

import { createServerFn } from "@tanstack/react-start";

export type PublicSupabaseConfig = { url: string; key: string } | null;

let injected: PublicSupabaseConfig = null;

/**
 * Guarda o que o servidor mandou. Chamado uma vez, no componente raiz, antes
 * de qualquer tela renderizar — o cliente do Supabase só é montado no
 * primeiro uso, que acontece depois disso.
 */
export function setPublicSupabaseConfig(config: PublicSupabaseConfig): void {
  if (config) injected = config;
}

export function publicSupabaseConfig(): PublicSupabaseConfig {
  return injected;
}

function clean(raw: string | undefined | null): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

/**
 * Lê do ambiente do servidor. Aceita os dois nomes: `VITE_SUPABASE_URL` (o
 * que a compilação usa) e `SUPABASE_URL` (o que o servidor já usa hoje).
 */
export const getPublicSupabaseConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicSupabaseConfig> => {
    const url = clean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
    const key = clean(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY,
    );
    return url && key ? { url, key } : null;
  },
);

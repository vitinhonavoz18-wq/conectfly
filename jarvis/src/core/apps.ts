/**
 * Catálogo de apps conhecidos (nome falado → pacote Android).
 * Serve só para traduzir nomes; antes de abrir, o app confere se o pacote está
 * realmente instalado. Apps fora do catálogo são encontrados pelo nome que
 * aparece no lançador do aparelho.
 */
export const KNOWN_APPS: Record<string, string> = {
  youtube: 'com.google.android.youtube',
  'youtube music': 'com.google.android.apps.youtube.music',
  whatsapp: 'com.whatsapp',
  'whatsapp business': 'com.whatsapp.w4b',
  instagram: 'com.instagram.android',
  facebook: 'com.facebook.katana',
  messenger: 'com.facebook.orca',
  telegram: 'org.telegram.messenger',
  spotify: 'com.spotify.music',
  netflix: 'com.netflix.mediaclient',
  chrome: 'com.android.chrome',
  gmail: 'com.google.android.gm',
  maps: 'com.google.android.apps.maps',
  'google maps': 'com.google.android.apps.maps',
  waze: 'com.waze',
  uber: 'com.ubercab',
  '99': 'com.taxis99',
  ifood: 'br.com.brainweb.ifood',
  'mercado livre': 'com.mercadolibre',
  tiktok: 'com.zhiliaoapp.musically',
  x: 'com.twitter.android',
  twitter: 'com.twitter.android',
  linkedin: 'com.linkedin.android',
  'google drive': 'com.google.android.apps.docs',
  drive: 'com.google.android.apps.docs',
  fotos: 'com.google.android.apps.photos',
  'google fotos': 'com.google.android.apps.photos',
  agenda: 'com.google.android.calendar',
  calendario: 'com.google.android.calendar',
  calculadora: 'com.google.android.calculator',
  relogio: 'com.google.android.deskclock',
  camera: 'com.android.camera',
};

export type LaunchableApp = { packageName: string; label: string };

export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve o nome dito pelo usuário para um pacote instalado.
 * Ordem: pacote literal → rótulo exato no aparelho → catálogo → rótulo parcial.
 */
export function resolveApp(spoken: string, installed: LaunchableApp[]): LaunchableApp | null {
  const raw = spoken.trim();
  const byPkg = installed.find((a) => a.packageName === raw);
  if (byPkg) return byPkg;
  const name = normalizeName(raw);
  if (!name) return null;
  const exact = installed.find((a) => normalizeName(a.label) === name);
  if (exact) return exact;
  const known = KNOWN_APPS[name];
  if (known) {
    const hit = installed.find((a) => a.packageName === known);
    if (hit) return hit;
  }
  const partial = installed.filter((a) => {
    const l = normalizeName(a.label);
    return l.startsWith(name) || name.startsWith(l) || l.split(' ').includes(name);
  });
  if (partial.length === 1) return partial[0];
  return null;
}

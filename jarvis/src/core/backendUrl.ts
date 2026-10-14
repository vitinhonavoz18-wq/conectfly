export type UrlCheck = { ok: true; url: string; note?: string } | { ok: false; error: string };

function isPrivateIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([m[1], m[2], m[3], m[4]].some((x) => Number(x) > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/**
 * Confere o endereço do backend digitado pelo usuário.
 * - "localhost"/127.0.0.1 no celular é o PRÓPRIO celular, não o computador.
 * - http (sem criptografia) só é aceito para endereços da rede local.
 * - Fora da rede local, exige https.
 */
export function checkBackendUrl(input: string): UrlCheck {
  let raw = input.trim().replace(/\/+$/, '');
  if (!raw) return { ok: false, error: 'Informe o endereço do gateway.' };
  if (!/^https?:\/\//i.test(raw)) raw = `http://${raw}`;
  const m = /^(https?):\/\/([^/:?#]+)(:\d{1,5})?(\/[^?#]*)?$/i.exec(raw);
  if (!m) return { ok: false, error: 'Endereço inválido. Exemplo: http://192.168.0.10:8787' };
  const scheme = m[1].toLowerCase();
  const host = m[2].toLowerCase();
  const url = `${scheme}://${host}${m[3] ?? ''}${m[4] ?? ''}`;
  if (host === 'localhost' || host.startsWith('127.') || host === '0.0.0.0') {
    return {
      ok: false,
      error: '"localhost" no celular aponta para o próprio celular. Use o IP do computador na rede Wi-Fi (ex.: 192.168.0.10).',
    };
  }
  if (scheme === 'http') {
    if (isPrivateIPv4(host) || host.endsWith('.local')) {
      return { ok: true, url, note: 'Conexão sem criptografia: use apenas na sua rede Wi-Fi de confiança.' };
    }
    return { ok: false, error: 'Fora da rede local é obrigatório usar https://.' };
  }
  return { ok: true, url };
}

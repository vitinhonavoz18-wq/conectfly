/**
 * Verificação de assinatura dos webhooks recebidos do FlyControl.
 *
 * Esquema (espelhado em `src/lib/webhookSignature.ts` do flycontrol-dash):
 *   header  `x-fl-signature: t=<unix_seconds>,v1=<hex hmac-sha256>`
 *   payload assinado: `${t}.${rawBody}` — o corpo EXATO recebido, sem reparse
 *   segredo: `FL_WEBHOOK_SECRET`, o mesmo valor nos dois projetos
 *
 * O timestamp entra na assinatura para impedir replay: uma requisição
 * capturada só é aceita dentro de TOLERANCE_SECONDS.
 *
 * TODO(fase 2): extrair para um pacote compartilhado entre FL e SF, junto
 * com os tipos de payload da integração.
 */

export const SIGNATURE_HEADER = "x-fl-signature";

/** Janela de aceitação do timestamp, em segundos, para cada lado do relógio. */
const TOLERANCE_SECONDS = 300;

export type VerifyFailureReason =
  | "no_secret_configured"
  | "missing_signature"
  | "malformed_signature"
  | "timestamp_out_of_tolerance"
  | "signature_mismatch";

export type VerifyResult = { ok: true } | { ok: false; reason: VerifyFailureReason };

/**
 * Enquanto `FL_WEBHOOK_REQUIRE_SIGNATURE` não for ligado, requisições sem
 * assinatura (ou com assinatura inválida) continuam sendo processadas e o
 * resultado da verificação vai apenas para o log. Isso permite implantar o
 * FlyControl assinando antes de passar a exigir, sem derrubar o fechamento
 * de comanda no meio da migração.
 */
export function isSignatureRequired(): boolean {
  const raw = (process.env.FL_WEBHOOK_REQUIRE_SIGNATURE || "").trim().toLowerCase();
  return raw === "true" || raw === "1";
}

function parseSignatureHeader(value: string): { timestamp: number; signature: string } | null {
  let timestamp: number | null = null;
  let signature: string | null = null;

  for (const part of value.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key === "t") {
      const parsed = Number(val);
      if (Number.isFinite(parsed)) timestamp = parsed;
    } else if (key === "v1") {
      signature = val.toLowerCase();
    }
  }

  if (timestamp === null || !signature) return null;
  if (!/^[0-9a-f]+$/.test(signature)) return null;
  return { timestamp, signature };
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buffer = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparação em tempo constante. O comprimento é público (hex de tamanho fixo). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Valida a assinatura de `rawBody`. `rawBody` precisa ser exatamente o texto
 * lido da requisição — reserializar o JSON muda os bytes e invalida o HMAC.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  headerValue: string | null,
): Promise<VerifyResult> {
  const secret = (process.env.FL_WEBHOOK_SECRET || "").trim();
  if (!secret) return { ok: false, reason: "no_secret_configured" };
  if (!headerValue) return { ok: false, reason: "missing_signature" };

  const parsed = parseSignatureHeader(headerValue);
  if (!parsed) return { ok: false, reason: "malformed_signature" };

  const skew = Math.abs(Math.floor(Date.now() / 1000) - parsed.timestamp);
  if (skew > TOLERANCE_SECONDS) return { ok: false, reason: "timestamp_out_of_tolerance" };

  const expected = await hmacHex(secret, `${parsed.timestamp}.${rawBody}`);
  if (!timingSafeEqual(expected, parsed.signature)) return { ok: false, reason: "signature_mismatch" };

  return { ok: true };
}

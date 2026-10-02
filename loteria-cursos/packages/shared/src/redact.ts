/**
 * Remoção de segredos antes de qualquer log ou persistência.
 *
 * Regra do projeto: token, senha, chave de API e service role NUNCA aparecem
 * em log, em tabela de erro ou em resposta HTTP. Esta função é a "peneira"
 * usada por todo o código antes de gravar algo.
 */

const SENSITIVE_KEY =
  /(pass(word)?|secret|token|api[-_]?key|authorization|service[-_]?role|credential|cookie|private[-_]?key|access[-_]?key|signature)/i;

// Padrões de valores que parecem segredo mesmo quando a chave não denuncia.
const SENSITIVE_VALUE_PATTERNS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g, "Bearer [REDACTED]"],
  [/\b(access_token|token|api_key|apikey|key|client_secret)=([^&\s"']+)/gi, "$1=[REDACTED]"],
  [/\bsk-[A-Za-z0-9_-]{16,}/g, "[REDACTED_OPENAI_KEY]"],
  [/\bsb_secret_[A-Za-z0-9_-]{8,}/g, "[REDACTED_SUPABASE_KEY]"],
  [/\bEAA[A-Za-z0-9]{20,}/g, "[REDACTED_META_TOKEN]"],
  [/\bIG[A-Za-z0-9]{40,}/g, "[REDACTED_META_TOKEN]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]"],
  [/(postgres(?:ql)?:\/\/[^:\s]+:)([^@\s]+)(@)/gi, "$1[REDACTED]$3"],
];

export const REDACTED = "[REDACTED]";

export function redactString(value: string): string {
  let out = value;
  for (const [pattern, replacement] of SENSITIVE_VALUE_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

/**
 * Copia profunda com segredos mascarados. Limita profundidade e tamanho de
 * strings para não gravar payloads gigantes no banco.
 */
export function redact<T>(input: T, options: { maxDepth?: number; maxString?: number } = {}): T {
  const maxDepth = options.maxDepth ?? 8;
  const maxString = options.maxString ?? 4000;
  const seen = new WeakSet<object>();

  const walk = (value: unknown, depth: number): unknown => {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") {
      const cleaned = redactString(value);
      return cleaned.length > maxString ? `${cleaned.slice(0, maxString)}…[truncated]` : cleaned;
    }
    if (typeof value !== "object") return value;
    if (seen.has(value as object)) return "[Circular]";
    if (depth >= maxDepth) return "[MaxDepth]";
    seen.add(value as object);
    if (Array.isArray(value)) return value.map((v) => walk(v, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? REDACTED : walk(v, depth + 1);
    }
    return out;
  };

  return walk(input, 0) as T;
}

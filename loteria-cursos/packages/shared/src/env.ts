/** Leitura de variáveis de ambiente com valores padrão explícitos. */
export function envString(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    if (fallback === undefined)
      throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
    return fallback;
  }
  return value;
}

export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error(`Variável ${name} deve ser inteiro (recebido: ${raw})`);
  return n;
}

export function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return parseBool(raw, fallback);
}

export function parseBool(raw: unknown, fallback = false): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw !== "string") return fallback;
  const v = raw.trim().toLowerCase();
  if (["true", "1", "yes", "sim", "on"].includes(v)) return true;
  if (["false", "0", "no", "nao", "não", "off"].includes(v)) return false;
  return fallback;
}

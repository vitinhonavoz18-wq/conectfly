/**
 * Regras editoriais (compliance). O texto não pode prometer ganho.
 * Comparação sem acentos e sem diferenciar maiúsculas.
 */
export const FORBIDDEN_PHRASES = [
  "numeros garantidos",
  "numero garantido",
  "dezenas garantidas",
  "palpite certeiro",
  "palpites certeiros",
  "vai ganhar",
  "voce ganha",
  "chance garantida",
  "chances garantidas",
  "metodo infalivel",
  "infalivel",
  "resultado garantido",
  "acerto garantido",
  "ganho garantido",
  "premio garantido",
  "lucro garantido",
  "garantia de ganho",
  "garantia de premio",
  "garantia de acerto",
  "ganho certo",
  "premio certo",
  "certeza de ganhar",
  "aumenta suas chances",
  "aumentar suas chances",
  "aumente suas chances",
  "aumenta as chances",
  "100% de acerto",
  "fique rico",
  "enriquecer",
];

export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const NEGATION_BEFORE = /(?:\bsem|\bnao ha|\bnenhuma|\bnenhum|\bnunca)\s+$/;

export interface ComplianceIssue {
  code: string;
  message: string;
  field: string;
}

export function checkCompliance(fields: Record<string, string | string[]>): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  for (const [field, raw] of Object.entries(fields)) {
    const text = normalizeText(Array.isArray(raw) ? raw.join(" ") : raw);
    for (const phrase of FORBIDDEN_PHRASES) {
      let from = 0;
      let idx: number;
      while ((idx = text.indexOf(phrase, from)) !== -1) {
        from = idx + phrase.length;
        // Negação explícita ("sem garantia de acerto", "não há prêmio garantido") é permitida.
        if (NEGATION_BEFORE.test(text.slice(Math.max(0, idx - 12), idx))) continue;
        issues.push({
          code: "FORBIDDEN_PHRASE",
          message: `expressão proibida: "${phrase}"`,
          field,
        });
        break;
      }
    }
  }
  return issues;
}

/**
 * Integridade dos dados oficiais: o texto da IA não pode listar dezenas,
 * valores em R$ nem citar outro número de concurso. Os dados oficiais são
 * inseridos por nós, de forma determinística, fora do texto da IA.
 */
export function checkDataIntegrity(text: string, contest: number): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const normalized = normalizeText(text);
  // 3+ números em sequência separados por espaço, vírgula, hífen, ponto, barra ou "e".
  if (/\b\d{1,3}\b(?:\s*(?:[,;\-–—./|•]|\se\s)\s*\b\d{1,3}\b){2,}/.test(normalized)) {
    issues.push({
      code: "NUMBER_LIST",
      message: "texto da IA lista dezenas (proibido)",
      field: "caption",
    });
  }
  if (/r\$\s*\d/.test(normalized)) {
    issues.push({
      code: "MONEY_VALUE",
      message: "texto da IA cita valores em R$ (proibido)",
      field: "caption",
    });
  }
  const contestMentions = [...normalized.matchAll(/concurso\s*(?:n[ºo°.]?\s*)?(\d+)/g)].map((m) =>
    Number(m[1]),
  );
  if (contestMentions.some((c) => c !== contest)) {
    issues.push({
      code: "CONTEST_MISMATCH",
      message: "texto da IA cita concurso diferente do oficial",
      field: "caption",
    });
  }
  return issues;
}

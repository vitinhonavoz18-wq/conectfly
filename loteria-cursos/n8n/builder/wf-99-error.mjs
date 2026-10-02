import { WorkflowBuilder, WF, n, js } from "./lib.mjs";

/** Código do node de saneamento (exportado para os testes unitários executarem). */
export const SANITIZE_CODE = String.raw`
// Normaliza dois formatos: Error Trigger (falha inesperada) e relato explícito (falha tratada).
// Remove segredos antes de gravar: nunca registrar token, chave ou senha.
const j = $input.item.json;
const SECRET = [/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g, /(access_token|token|api_key|apikey|key|client_secret)=([^&\s"']+)/gi,
  /\bsk-[A-Za-z0-9_-]{16,}/g, /\bsb_secret_[A-Za-z0-9_-]{8,}/g, /\bEAA[A-Za-z0-9]{20,}/g, /\bIG[A-Za-z0-9]{40,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, /(postgres(?:ql)?:\/\/[^:\s]+:)([^@\s]+)(@)/gi];
const clean = (v, max = 4000) => { if (v === null || v === undefined) return null; let s = typeof v === 'string' ? v : JSON.stringify(v);
  for (const re of SECRET) s = s.replace(re, '[REDACTED]'); return s.slice(0, max); };
const SENSITIVE = /(pass(word)?|secret|token|api[-_]?key|authorization|service[-_]?role|credential|cookie)/i;
const scrub = (o, d = 0) => { if (o === null || typeof o !== 'object') return typeof o === 'string' ? clean(o, 2000) : o;
  if (d > 5) return '[MaxDepth]'; if (Array.isArray(o)) return o.slice(0, 50).map((x) => scrub(x, d + 1));
  const r = {}; for (const [k, v] of Object.entries(o)) r[k] = SENSITIVE.test(k) ? '[REDACTED]' : scrub(v, d + 1); return r; };
const fromTrigger = Boolean(j.execution || j.trigger);
const err = fromTrigger ? (j.execution?.error ?? j.trigger?.error ?? {}) : j;
const message = clean(err.message ?? j.message ?? 'erro sem mensagem');
const code = j.error_code ?? (/^([A-Z][A-Z0-9_]{3,})\b/.exec(message ?? '')?.[1] ?? null);
return { json: {
  workflow_id: j.workflow?.id ?? j.workflow_id ?? null,
  workflow_name: j.workflow?.name ?? j.workflow_name ?? null,
  execution_id: j.execution?.id ?? j.execution_id ?? null,
  execution_url: j.execution?.url ?? null,
  node: j.execution?.lastNodeExecuted ?? j.trigger?.error?.node?.name ?? j.node ?? null,
  error_code: code,
  message,
  stack: clean(err.stack ?? null, 8000),
  mode: j.execution?.mode ?? j.trigger?.mode ?? 'reported',
  payload: scrub(fromTrigger ? { retryOf: j.execution?.retryOf ?? null } : (j.payload ?? {})),
  occurred_at: new Date().toISOString(),
} };
`;

export function buildErrorHandler() {
  const b = new WorkflowBuilder({
    id: WF.error,
    name: "WF-99-Global-Error-Handler",
    description:
      "Registra erros (inesperados e tratados) em workflow_errors, sem segredos, e opcionalmente avisa por webhook.",
    tags: ["loteria-cursos", "errors"],
    errorWorkflow: null,
  });
  b.sticky(
    "## WF-99 — Tratador global de erros\n\n" +
      "Dois jeitos de chegar aqui:\n" +
      "1. **Error Trigger** — qualquer workflow que falhar (configurado como Error Workflow nas Settings).\n" +
      "2. **Execute Sub-workflow** — falhas *tratadas* (ex.: arte não gerada, publicação recusada) relatadas pelos outros workflows.\n\n" +
      "Tudo é gravado em `workflow_errors` **sem segredos**. Alerta externo é opcional: preencha `alert_webhook_url` em `system_settings` (ou ALERT_WEBHOOK_URL no .env).",
  );
  const errorTrigger = n.errorTrigger(b, "Trigger — Workflow Error");
  const reportTrigger = n.executeWorkflowTrigger(
    b,
    "Trigger — Report Error",
    "Usado pelos workflows para relatar falhas tratadas.",
  );
  const sanitize = n.code(b, "Sanitize — Error Payload", SANITIZE_CODE);
  const insert = n.pg(
    b,
    "DB — Insert Workflow Error",
    "SELECT lc_log_workflow_error($1::jsonb) AS result, COALESCE(lc_settings()->>'alert_webhook_url', '') AS alert_url",
    ["JSON.stringify($json)"],
    {
      onError: "continueRegularOutput",
      notes: "Se o banco estiver fora, o erro segue no histórico de execuções do n8n.",
    },
  );
  const alertOn = n.ifTrue(
    b,
    "Alert — Configured?",
    "String($json.alert_url ?? '').startsWith('http')",
  );
  const alert = n.http(b, "Alert — Send Webhook", {
    method: "POST",
    url: "={{ $json.alert_url }}",
    body: js(
      `{ source: 'loteria-cursos', text: '[Loteria Cursos] ' + ($('Sanitize — Error Payload').item.json.error_code ?? 'ERRO') + ' em ' + ($('Sanitize — Error Payload').item.json.workflow_name ?? '?') + ': ' + $('Sanitize — Error Payload').item.json.message, error: $('Sanitize — Error Payload').item.json }`,
    ),
    timeout: 10000,
    notes: "Opcional. Falha no alerta nunca derruba o tratador.",
  });
  const done = n.set(b, "Return — Error Logged", {
    ok: true,
    logged: ["={{ $('DB — Insert Workflow Error').item.json.result?.ok === true }}", "boolean"],
  });
  b.connect(errorTrigger, sanitize)
    .connect(reportTrigger, sanitize)
    .chain(sanitize, insert, alertOn);
  b.connect(alertOn, alert, { output: 0 })
    .connect(alert, done)
    .connect(alertOn, done, { output: 1 });
  return b.toJSON();
}

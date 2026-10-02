#!/usr/bin/env node
// Valida os workflows de n8n/workflows/ ANTES de importar.
// Pega os erros que fazem um workflow "importar mas quebrar em silêncio":
//  ligação para node inexistente, $('Node') apontando para nome errado, expressão com
//  erro de sintaxe, segredo dentro do JSON, credencial com dados, webhook sem autenticação…
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll } from "../n8n/builder/build.mjs";
import { CRED, WF } from "../n8n/builder/lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "n8n", "workflows");

/** Tipos e versões conferidos no n8n 2.41.5 (ver docs/N8N_SETUP.md). */
const ALLOWED = {
  "n8n-nodes-base.executeWorkflowTrigger": [1.1],
  "n8n-nodes-base.scheduleTrigger": [1.2],
  "n8n-nodes-base.manualTrigger": [1],
  "n8n-nodes-base.errorTrigger": [1],
  "n8n-nodes-base.webhook": [2],
  "n8n-nodes-base.respondToWebhook": [1.1],
  "n8n-nodes-base.postgres": [2.6],
  "n8n-nodes-base.httpRequest": [4.2],
  "n8n-nodes-base.code": [2],
  "n8n-nodes-base.if": [2.2],
  "n8n-nodes-base.switch": [3.2],
  "n8n-nodes-base.wait": [1.1],
  "n8n-nodes-base.executeWorkflow": [1.2],
  "n8n-nodes-base.set": [3.4],
  "n8n-nodes-base.splitInBatches": [3],
  "n8n-nodes-base.stopAndError": [1],
  "n8n-nodes-base.noOp": [1],
  "n8n-nodes-base.stickyNote": [1],
};
const TRIGGERS = new Set([
  "n8n-nodes-base.executeWorkflowTrigger",
  "n8n-nodes-base.scheduleTrigger",
  "n8n-nodes-base.manualTrigger",
  "n8n-nodes-base.errorTrigger",
  "n8n-nodes-base.webhook",
]);
const REQUIRED = [
  "WF-00-System-Health",
  "WF-01-Sync-Lottery-Results",
  "WF-02-Generate-Predictions",
  "WF-03-Render-Social-Post",
  "WF-04-Publish-Instagram",
  "WF-05-Check-Prediction-Results",
  "WF-06-Instagram-Analytics",
  "WF-07-Content-Orchestrator",
  "WF-99-Global-Error-Handler",
];
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bEAA[A-Za-z0-9]{20,}/,
  /\bsb_secret_/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
  /access_token=/i,
  /"password"\s*:\s*"[^"]+"/i,
];
const KNOWN_CRED_IDS = new Set(
  Object.values(CRED).flatMap((c) => Object.values(c).map((x) => x.id)),
);
const KNOWN_WF_IDS = new Set(Object.values(WF));

/** Extrai o conteúdo JS de cada {{ … }} de uma string de expressão n8n. */
export function expressionsIn(value) {
  if (typeof value !== "string" || !value.startsWith("=")) return [];
  const out = [];
  const re = /\{\{([\s\S]*?)\}\}/g;
  let m;
  while ((m = re.exec(value))) out.push(m[1]);
  return out;
}

function walk(value, visit, path = "") {
  if (typeof value === "string") visit(value, path);
  else if (Array.isArray(value)) value.forEach((v, i) => walk(v, visit, `${path}[${i}]`));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) walk(v, visit, path ? `${path}.${k}` : k);
}

export function validateWorkflow(wf, { allIds = KNOWN_WF_IDS } = {}) {
  const errors = [];
  const err = (msg) => errors.push(`${wf.name}: ${msg}`);
  const names = new Set();
  const ids = new Set();
  for (const node of wf.nodes ?? []) {
    if (names.has(node.name)) err(`nome de node duplicado: ${node.name}`);
    names.add(node.name);
    if (ids.has(node.id)) err(`id de node duplicado: ${node.id}`);
    ids.add(node.id);
    const allowed = ALLOWED[node.type];
    if (!allowed) err(`tipo de node não permitido/não verificado: ${node.type} (${node.name})`);
    else if (!allowed.includes(node.typeVersion))
      err(`versão ${node.typeVersion} não verificada para ${node.type} (${node.name})`);
    if (/^(HTTP Request|IF|Code|Switch|Set|Postgres)\d*$/i.test(node.name))
      err(`nome genérico de node: ${node.name}`);
  }
  // Ligações
  const incoming = new Map();
  for (const [from, conn] of Object.entries(wf.connections ?? {})) {
    if (!names.has(from)) err(`ligação saindo de node inexistente: ${from}`);
    for (const branch of conn.main ?? []) {
      for (const c of branch ?? []) {
        if (!names.has(c.node)) err(`ligação para node inexistente: ${from} → ${c.node}`);
        incoming.set(c.node, (incoming.get(c.node) ?? 0) + 1);
      }
    }
  }
  for (const node of wf.nodes ?? []) {
    if (node.type === "n8n-nodes-base.stickyNote" || TRIGGERS.has(node.type)) continue;
    if (!incoming.get(node.name)) err(`node sem entrada (nunca executa): ${node.name}`);
  }
  // Configurações
  const s = wf.settings ?? {};
  if (s.executionOrder !== "v1") err("settings.executionOrder deve ser v1");
  if (s.timezone !== "America/Bahia") err("settings.timezone deve ser America/Bahia");
  if (wf.id !== WF.error && s.errorWorkflow !== WF.error)
    err("settings.errorWorkflow deve apontar para o WF-99");
  if (wf.active)
    err("workflow não deve ser importado ativo (publique depois de configurar credenciais)");
  // Nodes específicos
  for (const node of wf.nodes ?? []) {
    const p = node.parameters ?? {};
    for (const [type, ref] of Object.entries(node.credentials ?? {})) {
      if (!ref?.id || !ref?.name) err(`credencial sem id/nome em ${node.name}`);
      if (!KNOWN_CRED_IDS.has(ref.id))
        err(`credencial desconhecida em ${node.name}: ${type}/${ref.id}`);
      if (Object.keys(ref).some((k) => !["id", "name"].includes(k)))
        err(`credencial com dados embutidos em ${node.name}`);
    }
    if (node.type === "n8n-nodes-base.webhook" && p.authentication !== "headerAuth")
      err(`webhook sem autenticação: ${node.name}`);
    if (node.type === "n8n-nodes-base.wait" && !node.webhookId)
      err(`Wait sem webhookId: ${node.name}`);
    if (node.type === "n8n-nodes-base.executeWorkflow") {
      const target = p.workflowId?.value;
      if (!allIds.has(target))
        err(`Execute Sub-workflow aponta para workflow desconhecido: ${target} (${node.name})`);
    }
    if (node.type === "n8n-nodes-base.postgres") {
      if (/\{\{/.test(p.query ?? "")) err(`SQL com expressão embutida (use $1, $2…): ${node.name}`);
      const placeholders = new Set(
        [...(p.query ?? "").matchAll(/\$(\d+)/g)].map((m) => Number(m[1])),
      );
      const given = p.options?.queryReplacement
        ? expressionsIn(p.options.queryReplacement).length
        : 0;
      if (placeholders.size && !given) err(`SQL usa $n mas não tem parâmetros: ${node.name}`);
    }
    if (node.type === "n8n-nodes-base.httpRequest") {
      const url = String(p.url ?? "");
      if (/graph\.|meta_graph_host/.test(url) && !node.credentials?.httpHeaderAuth)
        err(`chamada à Meta sem credencial: ${node.name}`);
      if (/access_token/i.test(JSON.stringify(p)))
        err(`access_token em URL/parâmetros: ${node.name}`);
      if (!p.options?.timeout) err(`HTTP sem timeout: ${node.name}`);
    }
    if (node.type === "n8n-nodes-base.code") {
      const code = p.jsCode ?? "";
      const lines = code.split("\n").length;
      if (lines > 45)
        err(
          `Code node grande demais (${lines} linhas) — mova a lógica para packages/lottery-core: ${node.name}`,
        );
      try {
        new Function(
          "$input",
          "$",
          "$json",
          "$execution",
          "items",
          `return (async () => {\n${code}\n})`,
        );
      } catch (e) {
        err(`erro de sintaxe no Code node ${node.name}: ${e.message}`);
      }
    }
    // Expressões: sintaxe JS + $('Nome') existente
    walk(p, (value, path) => {
      for (const expr of expressionsIn(value)) {
        try {
          new Function("$json", "$", "$execution", "$input", `return (${expr});`);
        } catch (e) {
          err(
            `expressão inválida em ${node.name}.${path}: ${e.message} :: ${expr.trim().slice(0, 120)}`,
          );
        }
      }
      for (const m of value.matchAll(/\$\('([^']+)'\)/g)) {
        if (!names.has(m[1]))
          err(`referência a node inexistente $('${m[1]}') em ${node.name}.${path}`);
      }
    });
  }
  // Segredos
  const text = JSON.stringify(wf);
  for (const re of SECRET_PATTERNS) if (re.test(text)) err(`possível segredo no JSON (${re})`);
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const parsed = [];
  for (const f of files) {
    try {
      parsed.push(JSON.parse(readFileSync(join(dir, f), "utf8")));
    } catch (e) {
      errors.push(`${f}: JSON inválido (${e.message})`);
    }
  }
  for (const name of REQUIRED)
    if (!parsed.some((w) => w.name === name)) errors.push(`workflow obrigatório ausente: ${name}`);
  const fresh = new Map(buildAll().map((w) => [w.name, JSON.stringify(w)]));
  for (const wf of parsed) {
    errors.push(...validateWorkflow(wf));
    if (fresh.get(wf.name) !== JSON.stringify(wf))
      errors.push(
        `${wf.name}: JSON diferente do gerado pelo builder (rode npm run workflows:build)`,
      );
  }
  if (errors.length) {
    console.error(errors.map((e) => `✗ ${e}`).join("\n"));
    console.error(`\n${errors.length} problema(s) em ${files.length} workflow(s).`);
    process.exit(1);
  }
  const nodes = parsed.reduce((s, w) => s + w.nodes.length, 0);
  console.log(
    `✓ ${files.length} workflows válidos (${nodes} nodes) — prontos para importar no n8n 2.41.x`,
  );
}

// Construtor de workflows n8n (versão alvo: n8n 2.41.x).
//
// Por que gerar os JSON por código em vez de editar à mão?
//  • nomes de nodes, IDs, credenciais e versões ficam padronizados;
//  • ligações são conferidas na hora (ligar num node que não existe = erro);
//  • o validador (scripts/validate-workflows.mjs) garante que o JSON versionado
//    é idêntico ao gerado — ninguém edita um e esquece o outro.
// O resultado são arquivos JSON normais, importáveis no n8n.
import { createHash } from "node:crypto";

export const N8N_TARGET_VERSION = "2.41.5";
export const TIMEZONE = "America/Bahia";

/** IDs fixos dos workflows: chamadas entre workflows funcionam logo após a importação. */
export const WF = {
  health: "LcWf00Health0000",
  sync: "LcWf01SyncRes000",
  predict: "LcWf02Predict000",
  render: "LcWf03Render0000",
  publish: "LcWf04Publish000",
  check: "LcWf05Check00000",
  insights: "LcWf06Insights00",
  orchestrator: "LcWf07Orchestr00",
  error: "LcWf99ErrorHdl00",
};

/**
 * Credenciais referenciadas por ID + nome (NUNCA com segredo).
 * scripts/create-n8n-credentials.mjs cria credenciais com estes IDs a partir do .env;
 * quem preferir criar à mão na interface só precisa reassociar (ver docs/N8N_SETUP.md).
 */
export const CRED = {
  postgres: { postgres: { id: "LcPostgresCred01", name: "Postgres — Loteria Cursos" } },
  openai: { openAiApi: { id: "LcOpenAiCred0001", name: "OpenAI — Loteria Cursos" } },
  meta: { httpHeaderAuth: { id: "LcMetaCred000001", name: "Meta — Loteria Cursos" } },
  webhook: { httpHeaderAuth: { id: "LcWebhookCred001", name: "Webhook — Loteria Cursos" } },
};

export function stableUuid(...parts) {
  const h = createHash("sha256").update(parts.join("|")).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export class WorkflowBuilder {
  constructor({
    id,
    name,
    description,
    tags = [],
    errorWorkflow = WF.error,
    callerPolicy = "workflowsFromSameOwner",
  }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.tags = tags;
    this.errorWorkflow = errorWorkflow;
    this.callerPolicy = callerPolicy;
    this.nodes = [];
    this.connections = {};
    this.stickies = [];
  }

  add(name, type, typeVersion, parameters, extra = {}) {
    if (this.nodes.some((n) => n.name === name))
      throw new Error(`[${this.name}] node duplicado: ${name}`);
    const node = {
      parameters,
      id: stableUuid(this.id, name),
      name,
      type,
      typeVersion,
      position: extra.position ?? [0, 0],
    };
    for (const key of [
      "credentials",
      "notes",
      "retryOnFail",
      "maxTries",
      "waitBetweenTries",
      "onError",
      "alwaysOutputData",
      "executeOnce",
      "webhookId",
      "notesInFlow",
    ]) {
      if (extra[key] !== undefined) node[key] = extra[key];
    }
    if (extra.notes && extra.notesInFlow === undefined) node.notesInFlow = false;
    this.nodes.push(node);
    return name;
  }

  connect(from, to, { output = 0, input = 0 } = {}) {
    for (const n of [from, to])
      if (!this.nodes.some((x) => x.name === n))
        throw new Error(`[${this.name}] ligação com node inexistente: ${n}`);
    const outs = (this.connections[from] ??= { main: [] }).main;
    while (outs.length <= output) outs.push([]);
    outs[output].push({ node: to, type: "main", index: input });
    return this;
  }

  /** Liga em sequência: chain(a, b, c) = a→b→c. */
  chain(...names) {
    for (let i = 1; i < names.length; i++) this.connect(names[i - 1], names[i]);
    return this;
  }

  sticky(content, { width = 420, height = 240, color = 7 } = {}) {
    this.stickies.push({ content, width, height, color });
  }

  layout() {
    // Layout simples em colunas por "profundidade" a partir dos gatilhos (só estética).
    const triggers = this.nodes.filter((n) => /trigger|webhook/i.test(n.type));
    const depth = new Map();
    const queue = triggers.map((t) => [t.name, 0]);
    triggers.forEach((t) => depth.set(t.name, 0));
    while (queue.length) {
      const [name, d] = queue.shift();
      for (const branch of this.connections[name]?.main ?? []) {
        for (const c of branch) {
          if (!depth.has(c.node)) {
            depth.set(c.node, d + 1);
            queue.push([c.node, d + 1]);
          }
        }
      }
    }
    const perColumn = new Map();
    for (const n of this.nodes) {
      const d = depth.get(n.name) ?? 0;
      const row = perColumn.get(d) ?? 0;
      perColumn.set(d, row + 1);
      n.position = [240 + d * 280, 300 + row * 200];
    }
  }

  toJSON() {
    this.layout();
    const stickyNodes = this.stickies.map((s, i) => ({
      parameters: { content: s.content, height: s.height, width: s.width, color: s.color },
      id: stableUuid(this.id, `sticky-${i}`),
      name: `Nota ${i + 1}`,
      type: "n8n-nodes-base.stickyNote",
      typeVersion: 1,
      position: [240 + i * 460, -40],
    }));
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      active: false,
      isArchived: false,
      nodes: [...stickyNodes, ...this.nodes],
      connections: this.connections,
      settings: {
        executionOrder: "v1",
        timezone: TIMEZONE,
        saveDataErrorExecution: "all",
        saveDataSuccessExecution: "all",
        saveManualExecutions: true,
        saveExecutionProgress: true,
        callerPolicy: this.callerPolicy,
        ...(this.errorWorkflow ? { errorWorkflow: this.errorWorkflow } : {}),
      },
      staticData: null,
      pinData: {},
      meta: {
        templateCredsSetupCompleted: false,
        loteriaCursos: { generatedBy: "n8n/builder", n8nTargetVersion: N8N_TARGET_VERSION },
      },
      // Tags ficam de fora: o "n8n import:workflow" cria a mesma tag em paralelo para cada
      // workflow e viola a UNIQUE(tag_entity.name) (visto no n8n 2.41.5). Organize por pasta/projeto.
      tags: [],
    };
  }
}

// --------------------------------------------------------------------------
// Fábricas de nodes (parâmetros conferidos no código-fonte do n8n 2.41.5)
// --------------------------------------------------------------------------

export const n = {
  executeWorkflowTrigger: (b, name, notes) =>
    b.add(
      name,
      "n8n-nodes-base.executeWorkflowTrigger",
      1.1,
      { inputSource: "passthrough" },
      { notes },
    ),

  scheduleCron: (b, name, cron, notes) =>
    b.add(
      name,
      "n8n-nodes-base.scheduleTrigger",
      1.2,
      { rule: { interval: [{ field: "cronExpression", expression: cron }] } },
      { notes },
    ),

  manualTrigger: (b, name) => b.add(name, "n8n-nodes-base.manualTrigger", 1, {}),

  errorTrigger: (b, name) => b.add(name, "n8n-nodes-base.errorTrigger", 1, {}),

  webhook: (b, name, { path, method = "POST", notes }) =>
    b.add(
      name,
      "n8n-nodes-base.webhook",
      2,
      {
        httpMethod: method,
        path,
        authentication: "headerAuth",
        responseMode: "responseNode",
        options: {},
      },
      { credentials: CRED.webhook, webhookId: stableUuid(b.id, name, "webhook"), notes },
    ),

  respond: (b, name, { body = "={{ JSON.stringify($json) }}", code = 200 } = {}) =>
    b.add(name, "n8n-nodes-base.respondToWebhook", 1.1, {
      respondWith: "json",
      responseBody: body,
      options: { responseCode: code },
    }),

  /** Postgres (executeQuery) com parâmetros $1..$n — nunca concatenação de SQL. */
  pg: (b, name, query, params = [], extra = {}) =>
    b.add(
      name,
      "n8n-nodes-base.postgres",
      2.6,
      {
        operation: "executeQuery",
        query,
        options: params.length ? { queryReplacement: `={{ [ ${params.join(", ")} ] }}` } : {},
      },
      {
        credentials: CRED.postgres,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 2000,
        ...extra,
      },
    ),

  /** HTTP Request que NUNCA lança por status (o status é analisado depois). */
  http: (
    b,
    name,
    {
      method = "GET",
      url,
      body,
      query,
      credential,
      timeout = 30000,
      notes,
      retryOnFail,
      maxTries,
      waitBetweenTries,
    } = {},
  ) => {
    const parameters = {
      method,
      url,
      options: { timeout, response: { response: { fullResponse: true, neverError: true } } },
    };
    if (credential === "openai")
      Object.assign(parameters, {
        authentication: "predefinedCredentialType",
        nodeCredentialType: "openAiApi",
      });
    if (credential === "meta")
      Object.assign(parameters, {
        authentication: "genericCredentialType",
        genericAuthType: "httpHeaderAuth",
      });
    if (query)
      Object.assign(parameters, {
        sendQuery: true,
        queryParameters: {
          parameters: Object.entries(query).map(([k, v]) => ({ name: k, value: v })),
        },
      });
    if (body !== undefined)
      Object.assign(parameters, {
        sendBody: true,
        contentType: "json",
        specifyBody: "json",
        jsonBody: body,
      });
    return b.add(name, "n8n-nodes-base.httpRequest", 4.2, parameters, {
      credentials: credential ? CRED[credential] : undefined,
      onError: "continueRegularOutput",
      notes,
      retryOnFail,
      maxTries,
      waitBetweenTries,
    });
  },

  code: (b, name, jsCode, { mode = "runOnceForEachItem", notes } = {}) =>
    b.add(
      name,
      "n8n-nodes-base.code",
      2,
      { mode, language: "javaScript", jsCode: jsCode.trim() + "\n" },
      { notes },
    ),

  /** IF com uma condição booleana (expressão que resulta true/false). */
  ifTrue: (b, name, expression, notes) =>
    b.add(
      name,
      "n8n-nodes-base.if",
      2.2,
      {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
          conditions: [
            {
              id: stableUuid(b.id, name, "c"),
              leftValue: `={{ ${expression} }}`,
              rightValue: "",
              operator: { type: "boolean", operation: "true", singleValue: true },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
      { notes },
    ),

  /** Switch por igualdade de texto: saídas na ordem das chaves + "outros" no fim. */
  switchOn: (b, name, expression, keys, { fallback = true, notes } = {}) =>
    b.add(
      name,
      "n8n-nodes-base.switch",
      3.2,
      {
        rules: {
          values: keys.map((key) => ({
            conditions: {
              options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
              conditions: [
                {
                  id: stableUuid(b.id, name, key),
                  leftValue: `={{ ${expression} }}`,
                  rightValue: key,
                  operator: { type: "string", operation: "equals" },
                },
              ],
              combinator: "and",
            },
            renameOutput: true,
            outputKey: key,
          })),
        },
        options: fallback ? { fallbackOutput: "extra", renameFallbackOutput: "outros" } : {},
      },
      { notes },
    ),

  wait: (b, name, secondsExpression, notes) =>
    b.add(
      name,
      "n8n-nodes-base.wait",
      1.1,
      { amount: `={{ ${secondsExpression} }}`, unit: "seconds" },
      { webhookId: stableUuid(b.id, name, "wait"), notes },
    ),

  execute: (b, name, workflowId, { wait = true, notes, continueOnFail = true } = {}) =>
    b.add(
      name,
      "n8n-nodes-base.executeWorkflow",
      1.2,
      {
        source: "database",
        workflowId: { __rl: true, value: workflowId, mode: "id" },
        workflowInputs: {
          mappingMode: "defineBelow",
          value: {},
          matchingColumns: [],
          schema: [],
          attemptToConvertTypes: false,
          convertFieldsToString: true,
        },
        mode: "once",
        options: { waitForSubWorkflow: wait },
      },
      { notes, ...(continueOnFail ? { onError: "continueRegularOutput" } : {}) },
    ),

  set: (b, name, fields, { keepOthers = false, notes } = {}) =>
    b.add(
      name,
      "n8n-nodes-base.set",
      3.4,
      {
        mode: "manual",
        assignments: {
          // Valor: literal, expressão "={{ … }}" (texto) ou [expressão, tipo] para number/boolean/object/array.
          assignments: Object.entries(fields).map(([key, raw]) => {
            const [value, type] = Array.isArray(raw) ? raw : [raw, undefined];
            return {
              id: stableUuid(b.id, name, key),
              name: key,
              value: typeof value === "string" && value.startsWith("=") ? value : value,
              type:
                type ??
                (typeof value === "number"
                  ? "number"
                  : typeof value === "boolean"
                    ? "boolean"
                    : "string"),
            };
          }),
        },
        includeOtherFields: keepOthers,
        options: {},
      },
      { notes },
    ),

  loop: (b, name) => b.add(name, "n8n-nodes-base.splitInBatches", 3, { options: {} }),

  stop: (b, name, messageExpression) =>
    b.add(name, "n8n-nodes-base.stopAndError", 1, { errorMessage: `={{ ${messageExpression} }}` }),

  noop: (b, name) => b.add(name, "n8n-nodes-base.noOp", 1, {}),
};

/** Expressão segura para JSON no corpo das requisições. */
export const js = (expr) => `={{ JSON.stringify(${expr}) }}`;

/**
 * Relata uma falha TRATADA ao WF-99 (que grava em workflow_errors e avisa).
 * Retorna [primeiro, último] node do trecho para ligar no fluxo.
 */
export function reportError(b, prefix, { code, message, payload = "{}", workflowName }) {
  const set = n.set(b, `${prefix} — Error Payload`, {
    error_code: code,
    message,
    workflow_name: workflowName,
    workflow_id: b.id,
    execution_id: "={{ $execution.id }}",
    payload: [`={{ ${payload} }}`, "object"],
  });
  const exec = n.execute(b, `${prefix} — Report Error`, WF.error, {
    wait: true,
    notes: "Grava em workflow_errors via WF-99 (falha tratada, não derruba o fluxo).",
  });
  b.connect(set, exec);
  return [set, exec];
}

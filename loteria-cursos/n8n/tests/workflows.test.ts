import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS sem tipos
import { buildAll } from "../builder/build.mjs";
// @ts-expect-error módulo JS sem tipos
import { validateWorkflow } from "../../scripts/validate-workflows.mjs";
// @ts-expect-error módulo JS sem tipos
import { SANITIZE_CODE } from "../builder/wf-99-error.mjs";
// @ts-expect-error módulo JS sem tipos
import { HEALTH_AGGREGATE_CODE } from "../builder/wf-00-06-ops.mjs";

const dir = join(import.meta.dirname, "..", "workflows");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const workflows = files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));

/** Executa o código de um Code node do n8n com $input/$ simulados. */
function runCode(code: string, ctx: { item?: unknown; nodes?: Record<string, unknown> }) {
  const $ = (name: string) => ({ first: () => ({ json: ctx.nodes?.[name] ?? {} }) });
  const script = new vm.Script(`(function(){ ${code} })()`);
  return script.runInNewContext({
    $input: { item: { json: ctx.item ?? {} } },
    $,
    $execution: { id: "123" },
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
  });
}

describe("workflows n8n", () => {
  it("existem os 9 workflows obrigatórios", () => {
    expect(workflows.map((w) => w.name).sort()).toEqual([
      "WF-00-System-Health",
      "WF-01-Sync-Lottery-Results",
      "WF-02-Generate-Predictions",
      "WF-03-Render-Social-Post",
      "WF-04-Publish-Instagram",
      "WF-05-Check-Prediction-Results",
      "WF-06-Instagram-Analytics",
      "WF-07-Content-Orchestrator",
      "WF-99-Global-Error-Handler",
    ]);
  });

  it("JSON versionado é idêntico ao gerado pelo builder", () => {
    const fresh = new Map(buildAll().map((w: { name: string }) => [w.name, JSON.stringify(w)]));
    for (const wf of workflows) expect(JSON.stringify(wf)).toBe(fresh.get(wf.name));
  });

  it.each(workflows.map((w) => [w.name, w]))("%s passa no validador", (_name, wf) => {
    expect(validateWorkflow(wf)).toEqual([]);
  });

  it("validador detecta referência quebrada, expressão inválida e credencial com segredo", () => {
    const wf = structuredClone(workflows.find((w) => w.name === "WF-04-Publish-Instagram"));
    const http = wf.nodes.find((n: { type: string }) => n.type === "n8n-nodes-base.httpRequest");
    http.parameters.url = "={{ $('Node Renomeado').first().json.url + }}";
    http.credentials = {
      httpHeaderAuth: {
        id: "LcMetaCred000001",
        name: "x",
        data: { value: "Bearer EAAxxxxxxxxxxxxxxxxxxxxxxxx" },
      },
    };
    const errors = validateWorkflow(wf).join("\n");
    expect(errors).toMatch(/referência a node inexistente/);
    expect(errors).toMatch(/expressão inválida/);
    expect(errors).toMatch(/credencial com dados embutidos/);
    expect(errors).toMatch(/possível segredo/);
  });

  it("nenhum workflow contém segredo e todos os webhooks exigem autenticação", () => {
    const text = JSON.stringify(workflows);
    expect(text).not.toMatch(
      /\bsk-[A-Za-z0-9_-]{16,}|\bEAA[A-Za-z0-9]{20,}|\bsb_secret_[A-Za-z0-9]{8,}/,
    );
    const hooks = workflows
      .flatMap((w) => w.nodes)
      .filter((n: { type: string }) => n.type === "n8n-nodes-base.webhook");
    expect(hooks.length).toBeGreaterThan(0);
    for (const h of hooks) expect(h.parameters.authentication).toBe("headerAuth");
  });
});

describe("Code node — WF-99 Sanitize", () => {
  it("normaliza o formato do Error Trigger e remove segredos", () => {
    const [out] = [
      runCode(SANITIZE_CODE, {
        item: {
          execution: {
            id: "231",
            url: "https://n8n/execution/231",
            error: {
              message: "Request failed: Bearer EAAabcdefghijklmnopqrstuvwxyz123 rejected",
              stack: "at x (postgres://u:senha@db/x)",
            },
            lastNodeExecuted: "Meta — Publish Media",
            mode: "trigger",
          },
          workflow: { id: "w1", name: "WF-04-Publish-Instagram" },
        },
      }),
    ];
    const j = (out as { json: Record<string, unknown> }).json;
    expect(j).toMatchObject({
      workflow_name: "WF-04-Publish-Instagram",
      execution_id: "231",
      node: "Meta — Publish Media",
      mode: "trigger",
    });
    expect(String(j.message)).not.toContain("EAAabcdefghijklmnopqrstuvwxyz123");
    expect(String(j.stack)).not.toContain("senha");
  });
  it("aceita relato de falha tratada e mascara chaves sensíveis no payload", () => {
    const out = runCode(SANITIZE_CODE, {
      item: {
        error_code: "RENDER_FAILED",
        message: "RENDER_FAILED post 1",
        workflow_name: "WF-03",
        payload: { post_id: "1", access_token: "abc", nested: { apiKey: "k" } },
      },
    }) as { json: Record<string, any> };
    expect(out.json.error_code).toBe("RENDER_FAILED");
    expect(out.json.mode).toBe("reported");
    expect(out.json.payload).toEqual({
      post_id: "1",
      access_token: "[REDACTED]",
      nested: { apiKey: "[REDACTED]" },
    });
  });
  it("extrai o código do erro da mensagem quando não vem explícito", () => {
    const out = runCode(SANITIZE_CODE, {
      item: {
        execution: { error: { message: "INVALID_PUBLISH_INPUT: post_id ausente" } },
        workflow: {},
      },
    }) as { json: Record<string, unknown> };
    expect(out.json.error_code).toBe("INVALID_PUBLISH_INPUT");
  });
});

describe("Code node — WF-00 Health Aggregate", () => {
  const run = (nodes: Record<string, unknown>) =>
    (runCode(HEALTH_AGGREGATE_CODE, { nodes }) as Array<{ json: any }>)[0]!.json;
  const healthy = {
    "DB — Health Context": {
      settings: { openai_model: "m", meta_ig_user_id: "1", enable_real_instagram_publish: false },
      db_time: "now",
    },
    "Engine — Deep Health": {
      statusCode: 200,
      body: { services: { engine: "ok", lottery_source: "ok", renderer: "ok", storage: "ok" } },
    },
    "OpenAI — Check Model": { statusCode: 200 },
    "Meta — Check Account": { statusCode: 200 },
    "n8n — Self Health": { statusCode: 200 },
  };
  it("tudo ok", () => {
    expect(run(healthy)).toMatchObject({ status: "ok", publish_mode: "DRY_RUN" });
  });
  it("Meta fora → degraded; banco fora → down; sem modelo → not_configured", () => {
    expect(run({ ...healthy, "Meta — Check Account": { statusCode: 400 } }).services.meta).toBe(
      "down",
    );
    expect(run({ ...healthy, "Meta — Check Account": { statusCode: 400 } }).status).toBe(
      "degraded",
    );
    expect(run({ ...healthy, "DB — Health Context": {} }).status).toBe("down");
    expect(
      run({
        ...healthy,
        "DB — Health Context": { settings: { meta_ig_user_id: "1" }, db_time: "x" },
      }).services.openai,
    ).toBe("not_configured");
  });
});

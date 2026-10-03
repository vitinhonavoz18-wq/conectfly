// Converte um workflow JSON (n8n/workflows/*.json) em código do n8n Workflow SDK,
// para criar o workflow numa instância remota pelo MCP do n8n (create_workflow_from_code).
// Uso: node scripts/to-n8n-sdk.mjs n8n/workflows/WF-03-Render-Social-Post.json [mapa-de-ids.json]
// O mapa troca os IDs fixos (LcWf…) pelos IDs que a instância deu a cada workflow.
import fs from "node:fs";
const [, , file, mapFile] = process.argv;
const wf = JSON.parse(fs.readFileSync(file, "utf8"));
const idMap = mapFile && fs.existsSync(mapFile) ? JSON.parse(fs.readFileSync(mapFile, "utf8")) : {};

const lit = (v) => {
  if (typeof v === "string") {
    if (v.startsWith("=")) return `expr(${JSON.stringify(v.slice(1))})`;
    if (v === wf.id) return 'expr("{{ $workflow.id }}")';
    if (idMap[v]) return JSON.stringify(idMap[v]);
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return `[${v.map(lit).join(", ")}]`;
  if (v && typeof v === "object") {
    // workflowId resource locator
    if (v.__rl && typeof v.value === "string" && idMap[v.value])
      v = { ...v, value: idMap[v.value], cachedResultName: undefined };
    return `{${Object.entries(v)
      .filter(([, x]) => x !== undefined)
      .map(([k, x]) => `${JSON.stringify(k)}: ${lit(x)}`)
      .join(", ")}}`;
  }
  return JSON.stringify(v);
};

const TRIGGERS = new Set([
  "n8n-nodes-base.scheduleTrigger",
  "n8n-nodes-base.webhook",
  "n8n-nodes-base.executeWorkflowTrigger",
  "n8n-nodes-base.errorTrigger",
  "n8n-nodes-base.manualTrigger",
]);
const SETTINGS = [
  "notes",
  "notesInFlow",
  "retryOnFail",
  "maxTries",
  "waitBetweenTries",
  "onError",
  "alwaysOutputData",
  "executeOnce",
  "disabled",
  "webhookId",
];
const vars = new Map();
const out = [];
out.push(
  "import { workflow, node, trigger, sticky, newCredential, expr } from '@n8n/workflow-sdk';",
  "",
);
wf.nodes.forEach((n, i) => {
  const v = `n${i}`;
  vars.set(n.name, v);
  if (n.type === "n8n-nodes-base.stickyNote") {
    const p = n.parameters;
    out.push(
      `const ${v} = sticky(${JSON.stringify(p.content)}, [], ${lit({ name: n.name, color: p.color, width: p.width, height: p.height, position: n.position })});`,
    );
    return;
  }
  const cfg = { name: n.name, parameters: n.parameters, position: n.position };
  for (const k of SETTINGS)
    if (n[k] !== undefined && !(k === "notesInFlow" && n[k] === false)) cfg[k] = n[k];
  let cfgCode = lit(cfg);
  if (n.credentials) {
    const creds = Object.entries(n.credentials)
      .map(([k, c]) => `${JSON.stringify(k)}: newCredential(${JSON.stringify(c.name)})`)
      .join(", ");
    cfgCode = cfgCode.slice(0, -1) + `, "credentials": {${creds}}}`;
  }
  const fn = TRIGGERS.has(n.type) ? "trigger" : "node";
  out.push(
    `const ${v} = ${fn}({type: ${JSON.stringify(n.type)}, version: ${n.typeVersion}, config: ${cfgCode}, output: [{}]});`,
  );
});
out.push("", `export default workflow(${JSON.stringify(wf.id)}, ${JSON.stringify(wf.name)})`);
for (const n of wf.nodes) out.push(`  .add(${vars.get(n.name)})`);
for (const [src, c] of Object.entries(wf.connections)) {
  (c.main || []).forEach((arr, oi) =>
    (arr || []).forEach((t) => {
      out.push(`  .add(${vars.get(src)}.output(${oi}).to(${vars.get(t.node)}.input(${t.index})))`);
    }),
  );
}
out[out.length - 1] += ";";
process.stdout.write(out.join("\n") + "\n");

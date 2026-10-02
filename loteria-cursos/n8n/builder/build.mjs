#!/usr/bin/env node
// Gera n8n/workflows/*.json a partir das definições deste diretório.
// Uso: node n8n/builder/build.mjs [--check]   (--check só compara, não grava)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHealth, buildInsights } from "./wf-00-06-ops.mjs";
import { buildSync } from "./wf-01-sync.mjs";
import { buildPredictions, buildCheck } from "./wf-02-05-predictions.mjs";
import { buildRenderer } from "./wf-03-render.mjs";
import { buildPublisher } from "./wf-04-publish.mjs";
import { buildOrchestrator } from "./wf-07-orchestrator.mjs";
import { buildErrorHandler } from "./wf-99-error.mjs";

export const BUILDERS = [
  buildHealth,
  buildSync,
  buildPredictions,
  buildRenderer,
  buildPublisher,
  buildCheck,
  buildInsights,
  buildOrchestrator,
  buildErrorHandler,
];

export function buildAll() {
  return BUILDERS.map((fn) => fn());
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "workflows");

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes("--check");
  mkdirSync(outDir, { recursive: true });
  let drift = 0;
  for (const wf of buildAll()) {
    const file = join(outDir, `${wf.name}.json`);
    const content = JSON.stringify(wf, null, 2) + "\n";
    if (check) {
      const current = existsSync(file) ? readFileSync(file, "utf8") : "";
      if (current !== content) {
        drift++;
        console.error(`DESATUALIZADO: ${file} (rode: npm run workflows:build)`);
      }
    } else {
      writeFileSync(file, content);
      console.log(`gerado ${file} (${wf.nodes.length} nodes)`);
    }
  }
  if (drift) process.exit(1);
}

#!/usr/bin/env node
// Empacota engine, renderer e mock-server em arquivos únicos (dist/*.mjs) com esbuild.
// Pacotes do workspace (@lc/*) entram no pacote; dependências do npm ficam externas
// (sharp e resvg têm binários nativos e vêm do node_modules da imagem).
import { build } from "esbuild";
import { mkdirSync } from "node:fs";

const keepWorkspace = {
  name: "externals-except-workspace",
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, (args) =>
      args.path.startsWith("@lc/") ? undefined : { path: args.path, external: true },
    );
  },
};

mkdirSync("dist", { recursive: true });
const apps = {
  engine: "apps/engine/src/server.ts",
  renderer: "apps/renderer/src/server.ts",
  "mock-server": "apps/mock-server/src/server.ts",
};
for (const [name, entry] of Object.entries(apps)) {
  await build({
    entryPoints: [entry],
    outfile: `dist/${name}.mjs`,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    sourcemap: true,
    plugins: [keepWorkspace],
    banner: {
      js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
    },
    logLevel: "warning",
  });
  console.log(`dist/${name}.mjs`);
}

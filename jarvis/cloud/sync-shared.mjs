// Copia as regras compartilhadas (contrato, validação, ferramentas) para dentro
// da função da nuvem. O Supabase (Deno) exige imports com extensão ".ts".
// Rode depois de alterar src/core/contract.ts, src/core/validate.ts ou gateway/src/tools.ts:
//   node cloud/sync-shared.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'cloud/jarvis-brain/_shared');
const files = [
  ['src/core/contract.ts', 'contract.ts'],
  ['src/core/validate.ts', 'validate.ts'],
  ['gateway/src/tools.ts', 'tools.ts'],
];
for (const [src, dst] of files) {
  let code = readFileSync(join(root, src), 'utf8');
  code = code
    .replace(/from '\.\/contract'/g, "from './contract.ts'")
    .replace(/from '\.\.\/\.\.\/src\/core\/contract'/g, "from './contract.ts'");
  writeFileSync(join(out, dst), `// GERADO por cloud/sync-shared.mjs a partir de ${src} — não edite aqui.\n${code}`);
  console.log(`ok ${src} -> cloud/jarvis-brain/_shared/${dst}`);
}

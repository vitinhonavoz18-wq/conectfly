// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { UserConfig } from "vite";

export default defineConfig({
  vite: {
    // loteria-cursos/ é um projeto separado, com testes e dependências próprias
    // (roda com `npm test` dentro da pasta dele). Só afeta o vitest; o build ignora "test".
    test: {
      exclude: ["**/node_modules/**", "**/dist/**", "**/.output/**", "loteria-cursos/**"],
    },
  } as UserConfig,
});

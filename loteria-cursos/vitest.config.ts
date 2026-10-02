import { defineConfig } from "vitest/config";

// Três "projetos" de teste:
//  - unit:        rápidos, sem rede e sem banco (rodam em qualquer máquina).
//  - integration: precisam de PostgreSQL (TEST_DATABASE_URL) e sobem engine/renderer/mock em memória.
//  - real:        tocam APIs reais; só rodam com RUN_REAL_INTEGRATION_TESTS=true E
//                 ENABLE_REAL_INSTAGRAM_PUBLISH=true (as duas, de propósito).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: [
            "packages/*/tests/**/*.test.ts",
            "apps/*/tests/**/*.test.ts",
            "n8n/tests/**/*.test.ts",
          ],
          environment: "node",
          testTimeout: 20000,
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          testTimeout: 60000,
          hookTimeout: 60000,
          fileParallelism: false,
        },
      },
      {
        test: {
          name: "e2e",
          include: ["tests/e2e/**/*.test.ts"],
          environment: "node",
          testTimeout: 300000,
          hookTimeout: 300000,
          fileParallelism: false,
        },
      },
      {
        test: {
          name: "real",
          include: ["tests/real/**/*.test.ts"],
          environment: "node",
          testTimeout: 180000,
        },
      },
    ],
  },
});

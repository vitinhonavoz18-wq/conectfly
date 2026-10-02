import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import pg from "pg";
import { createLogger } from "@lc/shared";
import { CaixaSourceAdapter } from "@lc/lottery-core";
import { buildEngine } from "../../apps/engine/src/app.ts";
import { buildRenderer } from "../../apps/renderer/src/app.ts";
import { SupabaseStorage } from "../../apps/renderer/src/storage.ts";
import { buildMockServer } from "../../apps/mock-server/src/app.ts";
// @ts-expect-error módulo JS sem tipos
import { migrate } from "../../database/migrate.mjs";

export const DB_URL = process.env.TEST_DATABASE_URL ?? "";
if (!DB_URL) throw new Error("TEST_DATABASE_URL não definido — rode: npm run test:integration");

export const FIXTURES = join(import.meta.dirname, "..", "..", "fixtures");
export const fixture = (rel: string) => JSON.parse(readFileSync(join(FIXTURES, rel), "utf8"));
const silent = createLogger({ service: "int", sink: () => {} });

export const pool = new pg.Pool({ connectionString: DB_URL, max: 20 });
export async function q<T = Record<string, any>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await pool.query(sql, params)).rows as T[];
}
export async function one<T = Record<string, any>>(
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  return (await q<T>(sql, params))[0] as T;
}

let migrated = false;
export async function ensureMigrated() {
  if (migrated) return;
  await migrate({
    databaseUrl: DB_URL,
    env: { ENABLE_REAL_INSTAGRAM_PUBLISH: "false" },
    log: () => {},
  });
  migrated = true;
}

export async function resetDb() {
  await q(`TRUNCATE lottery_draws, predictions, social_posts, publish_attempts, instagram_insights, workflow_errors,
           data_conflicts, result_poll_runs, health_checks RESTART IDENTITY CASCADE`);
  await q(
    "UPDATE circuit_breakers SET circuit_status='CLOSED', failure_count=0, opened_at=NULL, half_open_probe_at=NULL, last_error=NULL",
  );
  await q("UPDATE system_settings SET value='false' WHERE key='enable_real_instagram_publish'");
}

export interface Services {
  mockUrl: string;
  engineUrl: string;
  rendererUrl: string;
  close(): Promise<void>;
}

/** Sobe simuladores, engine e renderer em portas livres, conversando por HTTP real. */
export async function startServices(): Promise<Services> {
  const mock = buildMockServer({ fixturesDir: FIXTURES });
  await mock.listen({ port: 0, host: "127.0.0.1" });
  const mockUrl = `http://127.0.0.1:${(mock.server.address() as AddressInfo).port}`;
  const engine = buildEngine({
    logger: silent,
    source: new CaixaSourceAdapter({
      baseUrl: `${mockUrl}/portaldeloterias/api`,
      maxAttempts: 2,
      sleepImpl: async () => {},
      now: () => new Date("2026-10-02T12:00:00Z"),
    }),
  });
  await engine.listen({ port: 0, host: "127.0.0.1" });
  const renderer = buildRenderer({
    logger: silent,
    outputDir: mkdtempSync(join(tmpdir(), "lc-int-")),
    storage: new SupabaseStorage(mockUrl, "mock-service-role-key", "social-media"),
  });
  await renderer.listen({ port: 0, host: "127.0.0.1" });
  return {
    mockUrl,
    engineUrl: `http://127.0.0.1:${(engine.server.address() as AddressInfo).port}`,
    rendererUrl: `http://127.0.0.1:${(renderer.server.address() as AddressInfo).port}`,
    close: async () => {
      await Promise.all([mock.close(), engine.close(), renderer.close()]);
    },
  };
}

export async function http(
  url: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  try {
    const res = await fetch(url, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    const text = await res.text();
    let body: any = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* corpo não-JSON */
    }
    return { statusCode: res.status, body, headers: Object.fromEntries(res.headers.entries()) };
  } catch (error) {
    return { statusCode: 0, body: null, headers: {}, error: (error as Error).message };
  }
}

import pg from "pg";

export const N8N = process.env.E2E_N8N_URL ?? "http://127.0.0.1:55678";
export const MOCK = process.env.E2E_MOCK_URL ?? "http://127.0.0.1:54010";
export const TOKEN = process.env.E2E_WEBHOOK_TOKEN ?? "e2e-test-webhook-token";
export const DB_URL =
  process.env.E2E_DATABASE_URL ??
  "postgres://loteria:e2e-test-only-password@127.0.0.1:55433/loteria";

export const db = new pg.Pool({ connectionString: DB_URL, max: 3 });

export async function q<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await db.query(sql, params)).rows as T[];
}

/** Dispara o webhook de teste manual do WF-07 (o mesmo que o operador usa). */
export async function run(body: Record<string, unknown>, timeoutMs = 240_000) {
  const res = await fetch(`${N8N}/webhook/loteria-cursos/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-LC-Token": TOKEN },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

export async function mockScenario(patch: Record<string, unknown>) {
  await fetch(`${MOCK}/__admin/scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function mockCalls(
  service?: string,
): Promise<Array<{ service: string; operation: string; status: number }>> {
  const res = await fetch(`${MOCK}/__admin/calls${service ? `?service=${service}` : ""}`);
  return (
    (await res.json()) as { calls: Array<{ service: string; operation: string; status: number }> }
  ).calls;
}

export const count = (calls: Array<{ operation: string }>, op: string) =>
  calls.filter((c) => c.operation === op).length;

export async function setSetting(key: string, value: unknown) {
  await q("UPDATE system_settings SET value = $2::jsonb WHERE key = $1", [
    key,
    JSON.stringify(value),
  ]);
}

/** Estado limpo entre cenários: banco da aplicação, disjuntores, configurações e simuladores. */
export async function resetAll() {
  await q(`TRUNCATE lottery_draws, predictions, social_posts, publish_attempts, instagram_insights, workflow_errors,
           data_conflicts, result_poll_runs, health_checks RESTART IDENTITY CASCADE`);
  await q(
    "UPDATE circuit_breakers SET circuit_status = 'CLOSED', failure_count = 0, opened_at = NULL, half_open_probe_at = NULL, last_error = NULL",
  );
  await setSetting("enable_real_instagram_publish", false);
  await setSetting("openai_max_attempts", 3);
  await setSetting("meta_container_max_polls", 10);
  await setSetting("meta_max_attempts", 4);
  await setSetting("min_seconds_between_publishes", 0);
  await fetch(`${MOCK}/__admin/reset`, { method: "POST" });
}

export async function posts(game?: string) {
  return q<Record<string, any>>(
    `SELECT sp.*, g.slug AS game FROM social_posts sp JOIN lottery_games g ON g.id = sp.game_id ${game ? "WHERE g.slug = $1" : ""} ORDER BY sp.created_at`,
    game ? [game] : [],
  );
}

export async function waitFor<T>(
  fn: () => Promise<T | null | undefined | false>,
  timeoutMs = 30_000,
  stepMs = 1000,
): Promise<T> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  throw new Error("condição não atingida no tempo limite");
}

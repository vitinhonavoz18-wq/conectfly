#!/usr/bin/env node
// Aplica migrations, seeds e sincroniza configurações NÃO secretas do .env para system_settings.
//
// Uso:  DATABASE_URL=postgres://... node database/migrate.mjs [--no-seed] [--no-sync-settings]
//
// Segurança:
//  • cada migration roda em transação e fica registrada com checksum; se alguém editar
//    uma migration já aplicada, o processo PARA (evita banco divergente do código);
//  • lock consultivo impede duas migrações ao mesmo tempo;
//  • nenhum segredo é gravado: valores com cara de token/chave são recusados.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));

/** Variáveis do .env que viram configuração (todas não secretas). */
export const ENV_SETTINGS = [
  ["ENABLE_REAL_INSTAGRAM_PUBLISH", "enable_real_instagram_publish", "bool"],
  ["BRAND_NAME", "brand_name", "string"],
  ["DEFAULT_CTA", "default_cta", "string"],
  ["ENGINE_URL", "engine_url", "string"],
  ["RENDERER_URL", "renderer_url", "string"],
  ["OPENAI_BASE_URL", "openai_base_url", "string"],
  ["OPENAI_MODEL", "openai_model", "string"],
  ["META_GRAPH_HOST", "meta_graph_host", "string"],
  ["META_GRAPH_API_VERSION", "meta_graph_api_version", "string"],
  ["META_IG_USER_ID", "meta_ig_user_id", "string"],
  ["LOTTERY_RESULT_POLL_INTERVAL_SECONDS", "lottery_result_poll_interval_seconds", "int"],
  ["LOTTERY_RESULT_MAX_ATTEMPTS", "lottery_result_max_attempts", "int"],
  ["MIN_SECONDS_BETWEEN_PUBLISHES", "min_seconds_between_publishes", "int"],
  ["ALERT_WEBHOOK_URL", "alert_webhook_url", "string"],
];

const SECRET_LIKE = [
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bEAA[A-Za-z0-9]{20,}/,
  /\bIG[A-Za-z0-9]{40,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\./,
  /sb_secret_/,
  /access_token=/i,
];

export function coerceSetting(name, raw, type) {
  if (SECRET_LIKE.some((re) => re.test(raw))) {
    throw new Error(
      `${name} parece conter um segredo. Segredos vão nas Credentials do n8n, não em system_settings.`,
    );
  }
  if (type === "bool") {
    const v = raw.trim().toLowerCase();
    if (["true", "1", "yes", "sim"].includes(v)) return true;
    if (["false", "0", "no", "nao", "não", ""].includes(v)) return false;
    throw new Error(`${name} deve ser true ou false (recebido: ${raw})`);
  }
  if (type === "int") {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0)
      throw new Error(`${name} deve ser inteiro >= 0 (recebido: ${raw})`);
    return n;
  }
  return raw;
}

const checksum = (sql) => createHash("sha256").update(sql).digest("hex");

export async function migrate({
  databaseUrl,
  seed = true,
  syncSettings = true,
  env = process.env,
  log = console.log,
} = {}) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('loteria_cursos_migrations'))");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const applied = new Map(
      (await client.query("SELECT version, checksum FROM schema_migrations")).rows.map((r) => [
        r.version,
        r.checksum,
      ]),
    );
    const dir = join(here, "migrations");
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const sql = readFileSync(join(dir, file), "utf8");
      const sum = checksum(sql);
      if (applied.has(file)) {
        if (applied.get(file) !== sum) {
          throw new Error(
            `Migration ${file} foi alterada depois de aplicada. Crie uma NOVA migration em vez de editar a antiga.`,
          );
        }
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", [
          file,
          sum,
        ]);
        await client.query("COMMIT");
        log(JSON.stringify({ event: "migration_applied", version: file }));
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Falha na migration ${file}: ${error.message}`);
      }
    }
    if (seed) {
      const seedDir = join(here, "seeds");
      for (const file of readdirSync(seedDir)
        .filter((f) => f.endsWith(".sql"))
        .sort()) {
        await client.query(readFileSync(join(seedDir, file), "utf8"));
        log(JSON.stringify({ event: "seed_applied", file }));
      }
    }
    if (syncSettings) {
      const synced = [];
      for (const [name, key, type] of ENV_SETTINGS) {
        const raw = env[name];
        if (raw === undefined || (raw === "" && type !== "bool")) continue;
        const value = coerceSetting(name, raw, type);
        await client.query(
          `INSERT INTO system_settings (key, value, source) VALUES ($1, $2::jsonb, 'env')
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, source = 'env'`,
          [key, JSON.stringify(value)],
        );
        synced.push(key);
      }
      log(JSON.stringify({ event: "settings_synced", keys: synced }));
    }
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('loteria_cursos_migrations'))")
      .catch(() => {});
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL não definido.");
    process.exit(1);
  }
  migrate({
    databaseUrl,
    seed: !args.has("--no-seed"),
    syncSettings: !args.has("--no-sync-settings"),
  })
    .then(() => console.log(JSON.stringify({ event: "migrate_done" })))
    .catch((error) => {
      console.error(JSON.stringify({ event: "migrate_failed", message: error.message }));
      process.exit(1);
    });
}

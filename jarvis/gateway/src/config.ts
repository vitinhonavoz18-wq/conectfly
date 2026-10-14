import { existsSync } from 'node:fs';

export type GatewayConfig = {
  openJarvisUrl: string;
  openJarvisApiKey: string;
  openJarvisModel: string;
  host: string;
  port: number;
  dataDir: string;
  rateLimitPerMin: number;
  tlsCertFile?: string;
  tlsKeyFile?: string;
  requestTimeoutMs: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  if (env === process.env && existsSync('.env')) {
    // Lê o .env local (Node 20.12+). Variáveis já definidas no sistema têm prioridade.
    process.loadEnvFile('.env');
  }
  const port = Number(env.GATEWAY_PORT ?? 8787);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('GATEWAY_PORT inválida');
  return {
    openJarvisUrl: (env.OPENJARVIS_URL || 'http://127.0.0.1:8000').replace(/\/+$/, ''),
    openJarvisApiKey: env.OPENJARVIS_API_KEY ?? '',
    openJarvisModel: env.OPENJARVIS_MODEL ?? '',
    host: env.GATEWAY_HOST || '0.0.0.0',
    port,
    dataDir: env.GATEWAY_DATA_DIR || './data',
    rateLimitPerMin: Number(env.GATEWAY_RATE_LIMIT_PER_MIN ?? 30) || 30,
    tlsCertFile: env.TLS_CERT_FILE || undefined,
    tlsKeyFile: env.TLS_KEY_FILE || undefined,
    requestTimeoutMs: Number(env.OPENJARVIS_TIMEOUT_MS ?? 120_000) || 120_000,
  };
}

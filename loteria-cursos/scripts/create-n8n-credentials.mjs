#!/usr/bin/env node
// Monta o JSON das 4 credenciais do n8n a partir das variáveis de ambiente e escreve
// na SAÍDA PADRÃO (nunca em arquivo no disco). O import-workflows.sh envia isso direto
// para "n8n import:credentials" dentro do container, que criptografa com N8N_ENCRYPTION_KEY.
//
// IDs fixos = os workflows importados já apontam para estas credenciais.
const env = process.env;
const need = (name) => {
  const v = env[name];
  if (!v) throw new Error(`variável ${name} vazia`);
  return v;
};
const placeholder = (v) => (v && v.trim() ? v.trim() : "NOT_CONFIGURED");

const credentials = [
  {
    id: "LcPostgresCred01",
    name: "Postgres — Loteria Cursos",
    type: "postgres",
    data: {
      host: env.APP_DB_HOST || "postgres",
      database: env.APP_DB_NAME || env.POSTGRES_DB || "loteria",
      user: env.APP_DB_USER || env.POSTGRES_USER || "loteria",
      password: env.APP_DB_PASSWORD || need("POSTGRES_PASSWORD"),
      port: Number(env.APP_DB_PORT || 5432),
      ssl: env.APP_DB_SSL || "disable",
      allowUnauthorizedCerts: false,
      maxConnections: 10,
    },
  },
  {
    id: "LcOpenAiCred0001",
    name: "OpenAI — Loteria Cursos",
    type: "openAiApi",
    data: {
      apiKey: placeholder(env.OPENAI_API_KEY),
      url: env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      header: false,
    },
  },
  {
    id: "LcMetaCred000001",
    name: "Meta — Loteria Cursos",
    type: "httpHeaderAuth",
    data: { name: "Authorization", value: `Bearer ${placeholder(env.META_ACCESS_TOKEN)}` },
  },
  {
    id: "LcWebhookCred001",
    name: "Webhook — Loteria Cursos",
    type: "httpHeaderAuth",
    data: { name: "X-LC-Token", value: need("N8N_WEBHOOK_TOKEN") },
  },
];

process.stdout.write(JSON.stringify(credentials));

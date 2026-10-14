import { readFileSync } from 'node:fs';
import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { networkInterfaces } from 'node:os';
import { createHandler, VERSION } from './app';
import { loadConfig } from './config';
import { OpenJarvisClient } from './openjarvis';
import { DeviceStore } from './store';

const cfg = loadConfig();
const store = new DeviceStore(cfg.dataDir);
const client = new OpenJarvisClient(cfg);
const handler = createHandler(cfg, store, client);

const tls = cfg.tlsCertFile && cfg.tlsKeyFile;
const server = tls
  ? createHttps({ cert: readFileSync(cfg.tlsCertFile!), key: readFileSync(cfg.tlsKeyFile!) }, handler)
  : createHttp(handler);

server.requestTimeout = cfg.requestTimeoutMs + 10_000;

server.listen(cfg.port, cfg.host, async () => {
  const scheme = tls ? 'https' : 'http';
  console.log(`Jarvis Gateway ${VERSION} ouvindo em ${scheme}://${cfg.host}:${cfg.port}`);
  if (cfg.host === '0.0.0.0') {
    const ips = Object.values(networkInterfaces())
      .flat()
      .filter((i) => i && i.family === 'IPv4' && !i.internal)
      .map((i) => i!.address);
    for (const ip of ips) console.log(`  No celular (mesmo Wi-Fi), use: ${scheme}://${ip}:${cfg.port}`);
  }
  if (!cfg.openJarvisApiKey) {
    console.log('  Aviso: OPENJARVIS_API_KEY vazio. Funciona só se o OpenJarvis estiver sem chave e em 127.0.0.1.');
  }
  const h = await client.health();
  console.log(h.ok ? `  OpenJarvis OK em ${cfg.openJarvisUrl}` : `  OpenJarvis indisponível: ${h.detail}`);
  console.log('  Para parear um celular: npm run pair');
});

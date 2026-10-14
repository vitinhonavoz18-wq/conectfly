/**
 * Config plugin do Jarvis.
 *
 * Reaplica, a cada `expo prebuild` (local ou no EAS), as configurações nativas
 * que não cabem no app.config.ts. Assim nada se perde se a pasta android/ for
 * regenerada. O serviço de acessibilidade e os módulos Kotlin ficam em
 * modules/jarvis-device e entram automaticamente pelo autolinking.
 */
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const PERMISSIONS = [
  // Microfone para o reconhecimento de fala (pedido em tempo de uso).
  { name: 'android.permission.RECORD_AUDIO' },
  // Android 12+: listar dispositivos pareados (pedido em tempo de uso).
  { name: 'android.permission.BLUETOOTH_CONNECT' },
  // Android 11 ou anterior: permissão legada, limitada a essas versões.
  { name: 'android.permission.BLUETOOTH', maxSdkVersion: '30' },
];

/**
 * Visibilidade de pacotes (Android 11+): declaramos só os TIPOS de intent que o
 * Jarvis usa, em vez de pedir QUERY_ALL_PACKAGES.
 */
const QUERY_INTENTS = [
  { action: 'android.intent.action.MAIN', category: 'android.intent.category.LAUNCHER' },
  { action: 'android.speech.RecognitionService' },
  { action: 'android.intent.action.TTS_SERVICE' },
  { action: 'android.intent.action.VIEW', data: { 'android:scheme': 'https' } },
  { action: 'android.intent.action.VIEW', data: { 'android:scheme': 'http' } },
  { action: 'android.intent.action.VIEW', data: { 'android:scheme': 'geo' } },
  { action: 'android.intent.action.DIAL', data: { 'android:scheme': 'tel' } },
  { action: 'android.intent.action.SEND', data: { 'android:mimeType': 'text/plain' } },
];

function addPermissions(manifest) {
  manifest['uses-permission'] = manifest['uses-permission'] || [];
  for (const p of PERMISSIONS) {
    const exists = manifest['uses-permission'].some((u) => u.$['android:name'] === p.name);
    if (exists) continue;
    const attrs = { 'android:name': p.name };
    if (p.maxSdkVersion) attrs['android:maxSdkVersion'] = p.maxSdkVersion;
    manifest['uses-permission'].push({ $: attrs });
  }
}

function addQueries(manifest) {
  manifest.queries = manifest.queries || [{}];
  const q = manifest.queries[0];
  q.intent = q.intent || [];
  const key = (i) => JSON.stringify(i);
  const existing = new Set(
    q.intent.map((i) =>
      key({
        action: i.action?.[0]?.$['android:name'],
        category: i.category?.[0]?.$['android:name'],
        data: i.data?.[0]?.$,
      }),
    ),
  );
  for (const it of QUERY_INTENTS) {
    if (existing.has(key({ action: it.action, category: it.category, data: it.data }))) continue;
    const node = { action: [{ $: { 'android:name': it.action } }] };
    if (it.category) node.category = [{ $: { 'android:name': it.category } }];
    if (it.data) node.data = [{ $: it.data }];
    q.intent.push(node);
  }
}

const withJarvisAndroid = (config, { allowCleartextLan = true } = {}) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    addPermissions(manifest);
    addQueries(manifest);
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    // HTTP sem criptografia só é usado para o gateway na rede Wi-Fi local; o app
    // recusa http para endereços públicos (ver src/services/backend.ts).
    if (allowCleartextLan) app.$['android:usesCleartextTraffic'] = 'true';
    return cfg;
  });

module.exports = withJarvisAndroid;
module.exports.PERMISSIONS = PERMISSIONS;
module.exports.QUERY_INTENTS = QUERY_INTENTS;

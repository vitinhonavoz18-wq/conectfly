import { loadConfig } from './config';
import { DeviceStore } from './store';

const cfg = loadConfig();
const store = new DeviceStore(cfg.dataDir);
const [cmd, arg] = process.argv.slice(2);

switch (cmd) {
  case 'pair': {
    const { code, expiresAt } = store.createPairingCode();
    console.log(`Código de pareamento: ${code}`);
    console.log(`Válido até ${new Date(expiresAt).toLocaleTimeString('pt-BR')} (10 minutos), uso único.`);
    console.log('Digite-o no app Jarvis em Configurações → Conectar ao backend.');
    break;
  }
  case 'devices': {
    const list = store.list();
    if (list.length === 0) console.log('Nenhum celular pareado.');
    for (const d of list) {
      const st = d.revokedAt ? `REVOGADO em ${d.revokedAt}` : `ativo (último acesso: ${d.lastSeenAt ?? 'nunca'})`;
      console.log(`${d.id}  ${d.name}  — ${st}`);
    }
    break;
  }
  case 'revoke': {
    if (!arg) {
      console.error('Uso: npm run revoke -- <id do dispositivo>');
      process.exit(1);
    }
    console.log(store.revoke(arg) ? 'Acesso revogado. O celular precisará parear de novo.' : 'Dispositivo não encontrado, ambíguo ou já revogado.');
    break;
  }
  default:
    console.log('Comandos: pair | devices | revoke <id>');
}

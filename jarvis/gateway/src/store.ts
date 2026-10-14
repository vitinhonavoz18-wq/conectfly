import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Cadastro de celulares pareados.
 *
 * O token de cada celular NUNCA é guardado em texto: só o hash SHA-256.
 * É como o restaurante guardar a "impressão digital" da senha da comanda,
 * não a senha — quem rouba o arquivo não consegue usar.
 */

export type Device = {
  id: string;
  name: string;
  tokenHash: string;
  createdAt: string;
  lastSeenAt?: string;
  revokedAt?: string;
};

type Pairing = { codeHash: string; expiresAt: number; attempts: number };

type State = { devices: Device[]; pairing?: Pairing };

const PAIRING_TTL_MS = 10 * 60 * 1000;
const PAIRING_MAX_ATTEMPTS = 5;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I

export function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

export class DeviceStore {
  private file: string;
  private state: State = { devices: [] };

  constructor(dataDir: string, private now: () => number = Date.now) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.file = join(dataDir, 'devices.json');
    this.reload();
  }

  reload() {
    if (existsSync(this.file)) {
      this.state = JSON.parse(readFileSync(this.file, 'utf8')) as State;
    }
  }

  private save() {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    renameSync(tmp, this.file);
    try {
      chmodSync(this.file, 0o600);
    } catch {
      // Windows: permissões POSIX não se aplicam
    }
  }

  /** Gera um código de pareamento de uso único, válido por 10 minutos. */
  createPairingCode(): { code: string; expiresAt: number } {
    const bytes = randomBytes(8);
    let code = '';
    for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
    const expiresAt = this.now() + PAIRING_TTL_MS;
    this.state.pairing = { codeHash: sha256(code), expiresAt, attempts: 0 };
    this.save();
    return { code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt };
  }

  /** Troca o código por um token de dispositivo. Código errado conta tentativa. */
  pair(code: string, deviceName: string): { ok: true; device: Device; token: string } | { ok: false; reason: string } {
    this.reload();
    const p = this.state.pairing;
    if (!p) return { ok: false, reason: 'Nenhum código de pareamento ativo. Gere um com "npm run pair".' };
    if (this.now() > p.expiresAt) {
      delete this.state.pairing;
      this.save();
      return { ok: false, reason: 'Código expirado. Gere outro.' };
    }
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!sameHash(sha256(normalized), p.codeHash)) {
      p.attempts += 1;
      if (p.attempts >= PAIRING_MAX_ATTEMPTS) delete this.state.pairing;
      this.save();
      return { ok: false, reason: 'Código incorreto.' };
    }
    delete this.state.pairing; // uso único
    const token = `jdv_${randomBytes(32).toString('base64url')}`;
    const device: Device = {
      id: randomUUID(),
      name: deviceName.slice(0, 60) || 'Celular',
      tokenHash: sha256(token),
      createdAt: new Date(this.now()).toISOString(),
    };
    this.state.devices.push(device);
    this.save();
    return { ok: true, device, token };
  }

  authenticate(token: string): Device | null {
    if (!token.startsWith('jdv_')) return null;
    this.reload(); // revogações feitas pela linha de comando valem na hora
    const h = sha256(token);
    const d = this.state.devices.find((x) => sameHash(x.tokenHash, h));
    if (!d || d.revokedAt) return null;
    d.lastSeenAt = new Date(this.now()).toISOString();
    this.save();
    return d;
  }

  revoke(id: string): boolean {
    this.reload();
    // Aceita o id completo ou um prefixo, desde que identifique um único aparelho.
    const matches = this.state.devices.filter((x) => x.id === id || (id.length >= 4 && x.id.startsWith(id)));
    const d = matches.length === 1 ? matches[0] : undefined;
    if (!d || d.revokedAt) return false;
    d.revokedAt = new Date(this.now()).toISOString();
    this.save();
    return true;
  }

  list(): Omit<Device, 'tokenHash'>[] {
    this.reload();
    return this.state.devices.map(({ tokenHash: _h, ...rest }) => rest);
  }
}

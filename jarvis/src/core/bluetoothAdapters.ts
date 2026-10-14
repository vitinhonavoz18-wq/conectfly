import type { ActionResult } from './contract';

/**
 * Interface para integrações futuras com equipamentos Bluetooth específicos.
 *
 * Estar pareado NÃO significa poder controlar: cada equipamento exige um perfil
 * (classic) ou serviço/característica GATT (BLE) e um protocolo conhecido.
 * Um adaptador só deve ser registrado quando esse protocolo estiver documentado
 * e testado com o aparelho real. Nenhum adaptador simulado é registrado.
 */
export type BluetoothTransport = 'classic' | 'ble';

export type BluetoothDeviceRef = { name: string; address: string; type: 'classic' | 'ble' | 'dual' | 'unknown' };

export interface BluetoothDeviceAdapter {
  id: string;
  /** Nome amigável, ex.: "Balança XYZ (BLE, serviço 0x181D)". */
  label: string;
  transport: BluetoothTransport;
  /** Para BLE: UUIDs de serviço exigidos. Para classic: perfil (ex.: SPP). */
  requirements: string[];
  matches(device: BluetoothDeviceRef): boolean;
  /** Comandos suportados, cada um com efeito verificável. */
  commands: { name: string; description: string }[];
  execute(device: BluetoothDeviceRef, command: string, args: Record<string, unknown>): Promise<ActionResult>;
}

const registry: BluetoothDeviceAdapter[] = [];

export function registerAdapter(a: BluetoothDeviceAdapter) {
  if (registry.some((x) => x.id === a.id)) throw new Error(`adaptador duplicado: ${a.id}`);
  registry.push(a);
}

export function adaptersFor(device: BluetoothDeviceRef): BluetoothDeviceAdapter[] {
  return registry.filter((a) => a.matches(device));
}

export function listAdapters(): readonly BluetoothDeviceAdapter[] {
  return registry;
}

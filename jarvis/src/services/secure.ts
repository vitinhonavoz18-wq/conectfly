import * as SecureStore from 'expo-secure-store';

/** O token do dispositivo fica no armazenamento seguro do Android (Keystore). */
const TOKEN_KEY = 'jarvis.deviceToken';
const DEVICE_ID_KEY = 'jarvis.deviceId';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setSession(token: string, deviceId: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
}

export async function getDeviceId(): Promise<string | null> {
  return SecureStore.getItemAsync(DEVICE_ID_KEY);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
}

/** Chave do Picovoice (detector de "Jarvis"). Fica só no armazenamento seguro. */
const PICOVOICE_KEY = 'jarvis.picovoiceAccessKey';

export async function getPicovoiceKey(): Promise<string | null> {
  return SecureStore.getItemAsync(PICOVOICE_KEY);
}

export async function setPicovoiceKey(key: string): Promise<void> {
  if (key.trim()) await SecureStore.setItemAsync(PICOVOICE_KEY, key.trim());
  else await SecureStore.deleteItemAsync(PICOVOICE_KEY);
}

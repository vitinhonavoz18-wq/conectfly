import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStore } from '../core/ledger';

/** Preferências e histórico (não secretos) ficam no AsyncStorage. */
export const asyncStore: KeyValueStore = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
  removeItem: (k) => AsyncStorage.removeItem(k),
};

export type Settings = {
  backendUrl: string;
  deviceName: string;
  speakReplies: boolean;
  /** Pacotes autorizados para navegação por acessibilidade. */
  allowedUiApps: string[];
  /** Envia nomes dos apps instalados ao backend para ajudar o modelo. */
  shareAppList: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  backendUrl: '',
  deviceName: 'Meu Android',
  speakReplies: true,
  allowedUiApps: [],
  shareAppList: false,
};

const SETTINGS_KEY = 'jarvis.settings.v1';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  at: number;
  /** Marca respostas geradas localmente (sem IA). */
  local?: boolean;
};

const CHAT_KEY = 'jarvis.chat.v1';

export async function loadChat(): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(CHAT_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export async function saveChat(list: ChatMessage[]): Promise<void> {
  await AsyncStorage.setItem(CHAT_KEY, JSON.stringify(list.slice(-200)));
}

export async function clearChat(): Promise<void> {
  await AsyncStorage.removeItem(CHAT_KEY);
}

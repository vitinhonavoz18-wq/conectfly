import * as Speech from 'expo-speech';
import { PermissionsAndroid, Platform } from 'react-native';
import { JarvisSpeech, type SpeechErrorCode } from '../../modules/jarvis-device';

/**
 * Voz do Jarvis:
 * - OUVIR (fala → texto): SpeechRecognizer nativo (módulo Kotlin JarvisSpeech).
 * - FALAR (texto → fala): expo-speech (TTS do Android).
 * São coisas diferentes: o TTS funciona offline com a voz instalada no aparelho;
 * o reconhecimento pode depender de internet conforme o serviço do aparelho.
 */

export const LOCALE = 'pt-BR';

export type MicPermission = 'granted' | 'denied' | 'blocked';

export async function requestMicPermission(): Promise<MicPermission> {
  if (Platform.OS !== 'android') return 'denied';
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Microfone para falar com o Jarvis',
    message: 'O Jarvis usa o microfone só enquanto você toca em "Falar com Jarvis".',
    buttonPositive: 'Permitir',
    buttonNegative: 'Agora não',
  });
  if (r === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  if (r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
  return 'denied';
}

export type ListenHandlers = {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (code: SpeechErrorCode, message: string) => void;
  onEnd: () => void;
  onVolume?: (rms: number) => void;
};

/** Começa a ouvir. Devolve uma função que remove os ouvintes (sempre chame). */
export async function startListening(h: ListenHandlers): Promise<() => void> {
  if (!JarvisSpeech) {
    h.onError('unavailable', 'Reconhecimento de voz disponível só no APK do Jarvis.');
    h.onEnd();
    return () => {};
  }
  const subs = [
    JarvisSpeech.addListener('onPartial', (e) => h.onPartial(e.text)),
    JarvisSpeech.addListener('onResult', (e) => h.onFinal(e.text)),
    JarvisSpeech.addListener('onError', (e) => h.onError(e.code, e.message)),
    JarvisSpeech.addListener('onEnd', () => h.onEnd()),
    JarvisSpeech.addListener('onVolume', (e) => h.onVolume?.(e.rms)),
  ];
  const cleanup = () => subs.forEach((s) => s.remove());
  try {
    const started = await JarvisSpeech.start(LOCALE);
    if (!started) {
      // O nativo já enviou onError/onEnd? Só se falhou antes de criar o reconhecedor.
      h.onEnd();
    }
  } catch (e) {
    h.onError('client', e instanceof Error ? e.message : 'Falha ao iniciar o microfone.');
    h.onEnd();
  }
  return cleanup;
}

export async function stopListening(): Promise<void> {
  await JarvisSpeech?.stop();
}

export async function cancelListening(): Promise<void> {
  await JarvisSpeech?.cancel();
}

export async function recognitionInfo(): Promise<{ available: boolean; onDevice: boolean }> {
  if (!JarvisSpeech) return { available: false, onDevice: false };
  const [available, onDevice] = await Promise.all([JarvisSpeech.isAvailable(), JarvisSpeech.isOnDeviceAvailable()]);
  return { available, onDevice };
}

/** Fala o texto. Resolve quando terminar, for interrompido ou falhar. */
export function speak(text: string): Promise<void> {
  const clean = text.replace(/[*_#`>]/g, '').slice(0, Speech.maxSpeechInputLength - 1);
  return new Promise((resolve) => {
    Speech.speak(clean, {
      language: LOCALE,
      rate: 1.0,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: () => resolve(),
    });
  });
}

export async function stopSpeaking(): Promise<void> {
  await Speech.stop();
}

import { NativeModule, requireOptionalNativeModule } from 'expo';

/**
 * Ponte TypeScript para os módulos Kotlin do Jarvis.
 * `requireOptionalNativeModule` devolve null fora do APK (ex.: Expo Go ou web):
 * nesse caso cada função informa "indisponível" em vez de quebrar o app.
 */

export type NativeResult = {
  status: 'completed' | 'refused' | 'unavailable' | 'failed' | 'cancelled';
  message: string;
  code?: string | null;
  data?: Record<string, unknown> | null;
};

export type LaunchableApp = { packageName: string; label: string };

export type PermissionStatus = {
  sdkInt: number;
  microphone: boolean;
  bluetoothConnect: boolean;
  accessibilityEnabled: boolean;
  accessibilityConnected: boolean;
  speechRecognitionAvailable: boolean;
  onDeviceRecognitionAvailable: boolean;
};

type DeviceModule = {
  listLaunchableApps(): Promise<LaunchableApp[]>;
  launchApp(pkg: string): Promise<NativeResult>;
  openUrl(url: string): Promise<NativeResult>;
  openSettings(panel: string): Promise<NativeResult>;
  openMap(address: string): Promise<NativeResult>;
  openDialer(phone: string): Promise<NativeResult>;
  shareText(text: string): Promise<NativeResult>;
  mediaControl(command: string): Promise<NativeResult>;
  getPermissionStatus(): Promise<PermissionStatus>;
};

export type SpeechEvents = {
  onReady: (e: Record<string, never>) => void;
  onBegin: (e: Record<string, never>) => void;
  onPartial: (e: { text: string }) => void;
  onResult: (e: { text: string; alternatives: string[] }) => void;
  onError: (e: { code: SpeechErrorCode; message: string }) => void;
  onEnd: (e: { reason: string }) => void;
  onVolume: (e: { rms: number }) => void;
};

export type SpeechErrorCode =
  | 'silence'
  | 'no_match'
  | 'permission'
  | 'network'
  | 'service'
  | 'busy'
  | 'language'
  | 'audio'
  | 'client'
  | 'unavailable';

declare class SpeechModuleType extends NativeModule<SpeechEvents> {
  isAvailable(): Promise<boolean>;
  isOnDeviceAvailable(): Promise<boolean>;
  start(locale: string): Promise<boolean>;
  stop(): Promise<void>;
  cancel(): Promise<void>;
}

export type BluetoothDeviceInfo = {
  name: string;
  address: string;
  type: 'classic' | 'ble' | 'dual' | 'unknown';
  category: string;
  bonded: boolean;
};

export type BluetoothStatus = {
  classicSupported: boolean;
  bleSupported: boolean;
  adapterPresent: boolean;
  enabled: boolean;
  connectPermission: boolean;
  needsRuntimePermission: boolean;
  sdkInt: number;
};

type BluetoothModule = {
  getStatus(): Promise<BluetoothStatus>;
  getBondedDevices(): Promise<NativeResult>;
  openBluetoothSettings(): Promise<NativeResult>;
  requestEnable(): Promise<NativeResult>;
};

export type AccessibilityStatus = {
  enabledInSettings: boolean;
  connected: boolean;
  allowedPackages: string[];
};

export type RawObservation = {
  available: boolean;
  allowed?: boolean;
  reason?: string;
  packageName?: string;
  screenTitle?: string | null;
  fingerprint?: string;
  truncated?: boolean;
  nodes?: {
    id: number;
    text?: string | null;
    contentDescription?: string | null;
    viewId?: string | null;
    className?: string | null;
    clickable: boolean;
    editable: boolean;
    scrollable: boolean;
    isPassword: boolean;
  }[];
};

type AccessibilityModule = {
  getStatus(): Promise<AccessibilityStatus>;
  openAccessibilitySettings(): Promise<NativeResult>;
  setAllowedPackages(packages: string[]): Promise<boolean>;
  getForegroundPackage(): Promise<string | null>;
  observe(): Promise<RawObservation>;
  performStep(expectedPackage: string, kind: string, selector: Record<string, string | undefined>, text: string | null): Promise<NativeResult>;
};

export type AmbientEvents = {
  onWake: (e: { at: number }) => void;
  onWakeState: (e: { state: 'listening' | 'off' }) => void;
  onWakeError: (e: { message: string }) => void;
  onScreenState: (e: { state: 'on' | 'off' }) => void;
  onScreenError: (e: { message: string }) => void;
};

export type AmbientStatus = {
  wakeRunning: boolean;
  wakePaused: boolean;
  screenRunning: boolean;
  notificationsAllowed: boolean;
};

declare class AmbientModuleType extends NativeModule<AmbientEvents> {
  getStatus(): Promise<AmbientStatus>;
  startWake(accessKey: string, sensitivity: number): Promise<NativeResult>;
  stopWake(): Promise<boolean>;
  pauseWake(): Promise<boolean>;
  resumeWake(): Promise<boolean>;
  startScreenWatch(): Promise<NativeResult>;
  stopScreenWatch(): Promise<boolean>;
  captureScreen(): Promise<string | null>;
}

export const JarvisDevice = requireOptionalNativeModule<DeviceModule>('JarvisDevice');
export const JarvisSpeech = requireOptionalNativeModule<SpeechModuleType>('JarvisSpeech');
export const JarvisBluetooth = requireOptionalNativeModule<BluetoothModule>('JarvisBluetooth');
export const JarvisAccessibility = requireOptionalNativeModule<AccessibilityModule>('JarvisAccessibility');

export const JarvisAmbient = requireOptionalNativeModule<AmbientModuleType>('JarvisAmbient');

export const nativeAvailable = JarvisDevice !== null;

export const NOT_IN_BUILD: NativeResult = {
  status: 'unavailable',
  message: 'Recurso nativo ausente nesta versão (use o APK do Jarvis, não o Expo Go).',
  code: 'not_supported',
};

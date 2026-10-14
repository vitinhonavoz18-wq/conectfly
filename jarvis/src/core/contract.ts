/**
 * Contrato de ações do Jarvis.
 *
 * Este arquivo é compartilhado entre o aplicativo e o gateway. Ele não importa
 * nada de React Native para poder ser testado em Node e reutilizado no backend.
 */

export const TOOL_NAMES = [
  'open_app',
  'open_url',
  'open_settings',
  'open_map',
  'open_dialer',
  'share_text',
  'media_control',
  'check_permissions',
  'ui_navigate',
  'ui_step',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export const SETTINGS_PANELS = [
  'general',
  'bluetooth',
  'wifi',
  'accessibility',
  'location',
  'sound',
  'display',
  'battery',
  'notifications',
  'app_details',
] as const;
export type SettingsPanel = (typeof SETTINGS_PANELS)[number];

export const MEDIA_COMMANDS = ['play_pause', 'play', 'pause', 'next', 'previous', 'stop'] as const;
export type MediaCommand = (typeof MEDIA_COMMANDS)[number];

export const UI_STEP_KINDS = ['click', 'scroll_forward', 'scroll_backward', 'set_text', 'back'] as const;
export type UiStepKind = (typeof UI_STEP_KINDS)[number];

/** Seletor semântico de um elemento acessível. Nunca usa coordenadas. */
export type UiSelector = {
  text?: string;
  contentDescription?: string;
  viewId?: string;
  className?: string;
};

export type ToolArgs = {
  open_app: { app: string };
  open_url: { url: string };
  open_settings: { panel: SettingsPanel };
  open_map: { address: string };
  open_dialer: { phone: string };
  share_text: { text: string };
  media_control: { command: MediaCommand };
  check_permissions: Record<string, never>;
  ui_navigate: { app: string; goal: string };
  ui_step: { kind: UiStepKind; selector?: UiSelector; text?: string };
};

export type ActionSource = 'local' | 'backend' | 'ui-agent';

export type ActionStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'running'
  | 'completed'
  | 'refused'
  | 'unavailable'
  | 'failed'
  | 'cancelled'
  | 'expired';

/** Estados finais: depois deles a mesma solicitação nunca roda de novo. */
export const TERMINAL_STATUSES: readonly ActionStatus[] = [
  'completed',
  'refused',
  'unavailable',
  'failed',
  'cancelled',
  'expired',
];

export type ActionErrorCode =
  | 'invalid_action'
  | 'expired'
  | 'duplicate'
  | 'policy_denied'
  | 'user_declined'
  | 'permission_missing'
  | 'app_not_installed'
  | 'app_not_allowed'
  | 'context_changed'
  | 'target_not_found'
  | 'not_supported'
  | 'backend_unavailable'
  | 'timeout'
  | 'cancelled'
  | 'native_error';

export type ActionError = { code: ActionErrorCode; message: string };

export type ActionRequest<T extends ToolName = ToolName> = {
  /** Identificador único. Ações repetidas com o mesmo id nunca são reexecutadas. */
  id: string;
  tool: T;
  args: ToolArgs[T];
  /** Pacote Android de destino quando a ação atua sobre outro aplicativo. */
  targetApp?: string;
  createdAt: number;
  /** Depois deste instante (ms) a ação é recusada como expirada. */
  expiresAt: number;
  source: ActionSource;
};

export type ActionResult = {
  status: ActionStatus;
  /** Texto curto em português para mostrar e falar ao usuário. */
  message: string;
  data?: Record<string, unknown>;
  error?: ActionError;
};

export type ActionRecord = {
  id: string;
  tool: ToolName;
  /** Resumo seguro para o histórico (sem senhas nem tokens). */
  summary: string;
  targetApp?: string;
  source: ActionSource;
  status: ActionStatus;
  message: string;
  errorCode?: ActionErrorCode;
  fingerprint?: string;
  createdAt: number;
  updatedAt: number;
};

/** Validade padrão de uma ação recebida do backend: 2 minutos. */
export const DEFAULT_ACTION_TTL_MS = 2 * 60 * 1000;

export function isToolName(value: unknown): value is ToolName {
  return typeof value === 'string' && (TOOL_NAMES as readonly string[]).includes(value);
}

export function isTerminal(status: ActionStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

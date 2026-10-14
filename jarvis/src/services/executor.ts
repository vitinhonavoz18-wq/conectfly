import { randomUUID } from 'expo-crypto';
import { Share } from 'react-native';
import { JarvisAccessibility, JarvisDevice, NOT_IN_BUILD, NativeResult, type LaunchableApp, type RawObservation } from '../../modules/jarvis-device';
import { resolveApp } from '../core/apps';
import type { ActionRequest, ActionResult, ToolArgs } from '../core/contract';
import { isBlockedPackage } from '../core/policy';
import type { CancelToken } from '../core/runner';
import { observationForModel, runUiTask, type UiHistoryItem, type UiObservation, type UiProposal } from '../core/uiAgent';

let appCache: { at: number; list: LaunchableApp[] } | null = null;

export async function listApps(force = false): Promise<LaunchableApp[]> {
  if (!JarvisDevice) return [];
  if (!force && appCache && Date.now() - appCache.at < 60_000) return appCache.list;
  const list = await JarvisDevice.listLaunchableApps();
  appCache = { at: Date.now(), list };
  return list;
}

function fromNative(r: NativeResult, okMessage?: string): ActionResult {
  return {
    status: r.status,
    message: r.status === 'completed' && okMessage ? okMessage : r.message,
    data: r.data ?? undefined,
    error: r.status === 'completed' ? undefined : { code: (r.code as never) ?? 'native_error', message: r.message },
  };
}

export function toObservation(raw: RawObservation): UiObservation | null {
  if (!raw.available || !raw.packageName) return null;
  return {
    packageName: raw.packageName,
    screenTitle: raw.screenTitle ?? undefined,
    fingerprint: raw.fingerprint ?? '',
    truncated: !!raw.truncated,
    nodes: (raw.nodes ?? []).map((n) => ({
      id: n.id,
      text: n.text ?? undefined,
      contentDescription: n.contentDescription ?? undefined,
      viewId: n.viewId ?? undefined,
      className: n.className ?? undefined,
      clickable: n.clickable,
      editable: n.editable,
      scrollable: n.scrollable,
      isPassword: n.isPassword,
    })),
  };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type UiNavigateHooks = {
  propose: (goal: string, observation: unknown, history: UiHistoryItem[]) => Promise<UiProposal>;
  /** Executa um passo pelo pipeline completo (política + confirmação + registro). */
  runStep: (action: ActionRequest, extras: { pendingTypedText?: string; screenTitle?: string }) => Promise<ActionResult>;
  onProgress: (msg: string) => void;
};

/**
 * Execução real de cada ferramenta. Chamado SOMENTE pelo runAction, depois da
 * validação, do registro anti-repetição, da política e da confirmação.
 */
export async function executeAction(action: ActionRequest, cancel: CancelToken, hooks?: UiNavigateHooks): Promise<ActionResult> {
  if (!JarvisDevice && action.tool !== 'share_text') return fromNative(NOT_IN_BUILD);
  const dev = JarvisDevice!;
  switch (action.tool) {
    case 'open_app': {
      const { app } = action.args as ToolArgs['open_app'];
      const hit = resolveApp(app, await listApps());
      if (!hit) {
        return { status: 'unavailable', message: `Não encontrei o app "${app}" instalado.`, error: { code: 'app_not_installed', message: app } };
      }
      return fromNative(await dev.launchApp(hit.packageName), `Abrindo ${hit.label}.`);
    }
    case 'open_url':
      return fromNative(await dev.openUrl((action.args as ToolArgs['open_url']).url), 'Link aberto.');
    case 'open_settings':
      return fromNative(await dev.openSettings((action.args as ToolArgs['open_settings']).panel), 'Configurações abertas.');
    case 'open_map':
      return fromNative(await dev.openMap((action.args as ToolArgs['open_map']).address), 'Mapa aberto com o endereço.');
    case 'open_dialer':
      return fromNative(await dev.openDialer((action.args as ToolArgs['open_dialer']).phone), 'Discador aberto com o número. Toque em ligar se quiser.');
    case 'share_text': {
      const { text } = action.args as ToolArgs['share_text'];
      if (JarvisDevice) return fromNative(await JarvisDevice.shareText(text), 'Seletor de compartilhamento aberto.');
      await Share.share({ message: text });
      return { status: 'completed', message: 'Seletor de compartilhamento aberto.' };
    }
    case 'media_control':
      return fromNative(await dev.mediaControl((action.args as ToolArgs['media_control']).command));
    case 'check_permissions': {
      const p = await dev.getPermissionStatus();
      const yes = (b: boolean) => (b ? 'sim' : 'não');
      const message = [
        `Microfone: ${yes(p.microphone)}`,
        `Dispositivos próximos (Bluetooth): ${yes(p.bluetoothConnect)}`,
        `Acessibilidade do Jarvis: ${p.accessibilityConnected ? 'ativa' : p.accessibilityEnabled ? 'ativada, aguardando conexão' : 'desligada'}`,
        `Reconhecimento de voz: ${p.speechRecognitionAvailable ? 'disponível' : 'indisponível'}`,
      ].join('. ');
      return { status: 'completed', message: `${message}.`, data: p as unknown as Record<string, unknown> };
    }
    case 'ui_navigate':
      return navigate(action, cancel, hooks);
    case 'ui_step': {
      if (!JarvisAccessibility) return fromNative(NOT_IN_BUILD);
      const a = action.args as ToolArgs['ui_step'];
      const sel: Record<string, string | undefined> = { ...(a.selector ?? {}) };
      return fromNative(await JarvisAccessibility.performStep(action.targetApp!, a.kind, sel, a.text ?? null));
    }
    default:
      return { status: 'refused', message: 'Ferramenta não suportada.', error: { code: 'not_supported', message: action.tool } };
  }
}

async function navigate(action: ActionRequest, cancel: CancelToken, hooks?: UiNavigateHooks): Promise<ActionResult> {
  if (!JarvisAccessibility || !JarvisDevice) return fromNative(NOT_IN_BUILD);
  if (!hooks) {
    return { status: 'unavailable', message: 'Navegação em apps precisa da conexão com a IA.', error: { code: 'backend_unavailable', message: '' } };
  }
  const { app, goal } = action.args as ToolArgs['ui_navigate'];
  // O pacote vem de targetApp (se a IA mandou o identificador) ou do nome instalado.
  const pkg = action.targetApp ?? resolveApp(app, await listApps())?.packageName;
  if (!pkg) return { status: 'unavailable', message: `App "${app}" não encontrado.`, error: { code: 'app_not_installed', message: app } };
  if (isBlockedPackage(pkg)) return { status: 'refused', message: 'Este app é protegido.', error: { code: 'policy_denied', message: pkg } };
  const status = await JarvisAccessibility.getStatus();
  if (!status.connected) {
    return {
      status: 'unavailable',
      message: 'Ative o serviço de acessibilidade do Jarvis em Configurações para navegar em apps.',
      error: { code: 'permission_missing', message: 'accessibility' },
    };
  }
  if (!status.allowedPackages.includes(pkg)) {
    return { status: 'refused', message: 'Este app não está autorizado para navegação.', error: { code: 'app_not_allowed', message: pkg } };
  }
  const launched = await JarvisDevice.launchApp(pkg);
  if (launched.status !== 'completed') return fromNative(launched);
  await sleep(1500);
  const result = await runUiTask(pkg, goal, {
    cancel,
    newId: () => randomUUID(),
    observe: async () => {
      const raw = await JarvisAccessibility!.observe();
      if (raw.available && raw.allowed === false) {
        return { packageName: raw.packageName ?? '', fingerprint: '', nodes: [], truncated: false };
      }
      return toObservation(raw);
    },
    propose: (g, obs, history) => hooks.propose(g, observationForModel(obs), history),
    runStep: hooks.runStep,
    onProgress: hooks.onProgress,
  });
  const summary = result.steps.map((s, i) => `${i + 1}. ${s.step.kind}: ${s.outcome}`).join('; ');
  return { ...result, data: { steps: summary } };
}

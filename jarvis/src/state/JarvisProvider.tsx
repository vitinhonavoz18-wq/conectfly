import { randomUUID } from 'expo-crypto';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { JarvisAccessibility, JarvisAmbient } from '../../modules/jarvis-device';
import type { ActionRecord, ActionRequest, ActionResult, ToolArgs, ToolName } from '../core/contract';
import { farewell, isEndPhrase, refersToScreen, shouldEndAfterTurn } from '../core/conversation';
import { parseLocalCommand, stripWakeWord } from '../core/intents';
import { ActionLedger } from '../core/ledger';
import { ConfirmRequest, runAction, RunnerDeps } from '../core/runner';
import { BackendError, chat, disconnect as backendDisconnect, getStatus, hasSession, proposeUiStep, type ApiMessage } from '../services/backend';
import { executeAction, listApps } from '../services/executor';
import { asyncStore, ChatMessage, clearChat, DEFAULT_SETTINGS, loadChat, loadSettings, saveChat, saveSettings, Settings } from '../services/storage';
import { collectScreenContext } from '../services/screen';
import { getPicovoiceKey, setPicovoiceKey } from '../services/secure';
import * as voice from '../services/voice';

export type Phase = 'ready' | 'listening' | 'processing' | 'speaking' | 'executing';

export type Connection =
  | { state: 'unconfigured' }
  | { state: 'checking' }
  | { state: 'online'; model: string | null; deviceName: string }
  | { state: 'degraded'; message: string }
  | { state: 'offline'; message: string };

type PendingConfirm = ConfirmRequest & { resolve: (ok: boolean) => void };

/** Resultado de uma rodada de conversa (usado para decidir se a conversa por voz continua). */
export type TurnOutcome = { completedActions: number; reply: string; cancelled: boolean };

export type WakeState = 'off' | 'starting' | 'listening' | 'paused';

type Ctx = {
  phase: Phase;
  draft: string;
  setDraft: (s: string) => void;
  partial: string;
  volume: number;
  messages: ChatMessage[];
  progress: string | null;
  notice: string | null;
  dismissNotice: () => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  connection: Connection;
  refreshConnection: () => Promise<void>;
  disconnectBackend: () => Promise<string>;
  records: ActionRecord[];
  clearHistory: () => Promise<void>;
  pendingConfirm: PendingConfirm | null;
  answerConfirm: (ok: boolean) => void;
  listen: () => Promise<void>;
  stopListen: () => Promise<void>;
  send: (text?: string) => Promise<TurnOutcome | void>;
  cancelAll: () => Promise<void>;
  /** Conversa por voz aberta depois de dizer "Jarvis". */
  conversation: boolean;
  wakeState: WakeState;
  hasPicovoiceKey: boolean;
  savePicovoiceKey: (key: string) => Promise<void>;
  setWakeEnabled: (on: boolean) => Promise<string>;
  screenWatch: boolean;
  setScreenWatch: (on: boolean) => Promise<string>;
  runQuick: <T extends ToolName>(tool: T, args: ToolArgs[T]) => Promise<ActionResult>;
};

const JarvisContext = createContext<Ctx | null>(null);

export const ledger = new ActionLedger(asyncStore);

const MAX_TOOL_ROUNDS = 3;
const CONFIRM_TIMEOUT_MS = 60_000;

export function JarvisProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [draft, setDraft] = useState('');
  const [partial, setPartial] = useState('');
  const [volume, setVolume] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [connection, setConnection] = useState<Connection>({ state: 'checking' });
  const [records, setRecords] = useState<ActionRecord[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [conversation, setConversation] = useState(false);
  const [wakeState, setWakeState] = useState<WakeState>('off');
  const [hasPicovoiceKey, setHasPicovoiceKey] = useState(false);
  const [screenWatch, setScreenWatchState] = useState(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const abortRef = useRef<AbortController | null>(null);
  const listenCleanup = useRef<(() => void) | null>(null);
  const apiHistory = useRef<ApiMessage[]>([]);
  const stepExtras = useRef<{ pendingTypedText?: string; screenTitle?: string }>({});
  const confirmRef = useRef<PendingConfirm | null>(null);
  const conversationRef = useRef(false);
  const wakeRunningRef = useRef(false);
  const screenWatchRef = useRef(false);
  /** Funções mais recentes, para os eventos nativos (registrados uma vez só). */
  const voiceRef = useRef<{ startConversation: () => void }>({ startConversation: () => {} });

  // ---------- carregamento inicial ----------
  useEffect(() => {
    void (async () => {
      const [s, chatList] = await Promise.all([loadSettings(), loadChat()]);
      setSettings(s);
      setMessages(chatList);
      // O serviço nativo confere a mesma lista; mantém os dois sincronizados.
      if (JarvisAccessibility) await JarvisAccessibility.setAllowedPackages(s.allowedUiApps);
      await ledger.load();
      setRecords(ledger.list());
      const key = await getPicovoiceKey();
      setHasPicovoiceKey(!!key);
      if (JarvisAmbient) {
        const st = await JarvisAmbient.getStatus();
        wakeRunningRef.current = st.wakeRunning;
        screenWatchRef.current = st.screenRunning;
        setScreenWatchState(st.screenRunning);
        if (st.wakeRunning) setWakeState(st.wakePaused ? 'paused' : 'listening');
        // Religa a escuta ao abrir o app (o Android só permite iniciá-la com o app na tela).
        else if (s.wakeEnabled && key) {
          setWakeState('starting');
          const r = await JarvisAmbient.startWake(key, s.wakeSensitivity);
          if (r.status !== 'completed') {
            setWakeState('off');
            setNotice(r.message);
          }
        }
      }
      await checkConnection(s);
    })();
    const unsub = ledger.subscribe(() => setRecords(ledger.list()));
    const subs = JarvisAmbient
      ? [
          JarvisAmbient.addListener('onWake', () => voiceRef.current.startConversation()),
          JarvisAmbient.addListener('onWakeState', (e) => {
            wakeRunningRef.current = e.state !== 'off';
            setWakeState(e.state === 'off' ? 'off' : 'listening');
          }),
          JarvisAmbient.addListener('onWakeError', (e) => setNotice(e.message)),
          JarvisAmbient.addListener('onScreenState', (e) => {
            screenWatchRef.current = e.state === 'on';
            setScreenWatchState(e.state === 'on');
          }),
          JarvisAmbient.addListener('onScreenError', (e) => setNotice(e.message)),
        ]
      : [];
    // App minimizado: sem escuta ativa, para a fala; com escuta, a conversa continua.
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' && !wakeRunningRef.current && !conversationRef.current) {
        void voice.stopSpeaking();
      }
    });
    return () => {
      unsub();
      subs.forEach((x) => x.remove());
      sub.remove();
    };
  }, []);

  useEffect(() => {
    void saveChat(messages);
  }, [messages]);

  const addMessage = useCallback((role: ChatMessage['role'], text: string, local = false) => {
    setMessages((m) => [...m, { id: randomUUID(), role, text, at: Date.now(), local }]);
  }, []);

  async function checkConnection(s: Settings = settingsRef.current) {
    if (!s.backendUrl || !(await hasSession())) {
      setConnection({ state: 'unconfigured' });
      return;
    }
    setConnection({ state: 'checking' });
    try {
      const st = await getStatus(s.backendUrl);
      if (st.openjarvis.reachable) setConnection({ state: 'online', model: st.openjarvis.model, deviceName: st.device.name });
      else setConnection({ state: 'degraded', message: `Servidor OK, mas a IA não respondeu: ${st.openjarvis.error ?? 'motivo desconhecido'}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof BackendError && e.kind === 'unauthorized') {
        setConnection({ state: 'offline', message: 'Acesso revogado ou expirado. Faça o pareamento novamente.' });
      } else {
        setConnection({ state: 'offline', message: msg });
      }
    }
  }

  const refreshConnection = useCallback(() => checkConnection(), []);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    setSettings(next);
    settingsRef.current = next;
    await saveSettings(next);
    if (patch.allowedUiApps && JarvisAccessibility) {
      await JarvisAccessibility.setAllowedPackages(next.allowedUiApps);
    }
  }, []);

  // ---------- confirmação ----------
  const confirm = useCallback((req: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        confirmRef.current = null;
        setPendingConfirm(null);
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), CONFIRM_TIMEOUT_MS);
      const pending = { ...req, resolve: finish };
      confirmRef.current = pending;
      setPendingConfirm(pending);
    });
  }, []);

  const answerConfirm = useCallback((ok: boolean) => confirmRef.current?.resolve(ok), []);

  // ---------- execução ----------
  const runnerDeps = useCallback((): RunnerDeps => {
    const deps: RunnerDeps = {
      ledger,
      cancel: cancelRef.current,
      confirm,
      policyContext: async (action) => ({
        allowedUiApps: new Set(settingsRef.current.allowedUiApps),
        foregroundApp: action.tool === 'ui_step' && JarvisAccessibility ? ((await JarvisAccessibility.getForegroundPackage()) ?? undefined) : undefined,
        pendingTypedText: stepExtras.current.pendingTypedText,
        screenTitle: stepExtras.current.screenTitle,
      }),
      execute: (action, cancel) =>
        executeAction(action, cancel, {
          onProgress: (m) => setProgress(m),
          propose: (goal, observation, history) => {
            const url = settingsRef.current.backendUrl;
            return proposeUiStep(url, goal, observation, history, abortRef.current?.signal);
          },
          runStep: async (step, extras) => {
            stepExtras.current = extras;
            try {
              return await runAction(step, deps);
            } finally {
              stepExtras.current = {};
            }
          },
        }),
    };
    return deps;
  }, [confirm]);

  const execute = useCallback(
    async (raw: unknown): Promise<ActionResult> => {
      setPhase('executing');
      try {
        return await runAction(raw, runnerDeps());
      } finally {
        setProgress(null);
      }
    },
    [runnerDeps],
  );

  const say = useCallback(
    async (text: string, local = false) => {
      addMessage('assistant', text, local);
      if (settingsRef.current.speakReplies && !cancelRef.current.cancelled && text) {
        setPhase('speaking');
        await voice.speak(text);
      }
    },
    [addMessage],
  );

  const runQuick = useCallback(
    async <T extends ToolName>(tool: T, args: ToolArgs[T]) => {
      cancelRef.current = { cancelled: false };
      const now = Date.now();
      const action: ActionRequest<T> = { id: randomUUID(), tool, args, createdAt: now, expiresAt: now + 60_000, source: 'local' };
      const r = await execute(action);
      setPhase('ready');
      return r;
    },
    [execute],
  );

  // ---------- conversa ----------
  const send = useCallback(
    async (input?: string): Promise<TurnOutcome | void> => {
      const text = (input ?? draft).trim();
      if (!text) return;
      const outcome: TurnOutcome = { completedActions: 0, reply: '', cancelled: false };
      setDraft('');
      setPartial('');
      cancelRef.current = { cancelled: false };
      const abort = new AbortController();
      abortRef.current = abort;
      addMessage('user', text);
      setPhase('processing');
      try {
        // 1) Comandos diretos são resolvidos no aparelho, mesmo sem backend.
        const local = parseLocalCommand(text);
        if (local?.kind === 'clarify') {
          outcome.reply = local.message;
          await say(local.message, true);
          return outcome;
        }
        if (local?.kind === 'action') {
          const now = Date.now();
          const r = await execute({ id: randomUUID(), tool: local.tool, args: local.args, createdAt: now, expiresAt: now + 60_000, source: 'local' });
          if (r.status === 'completed') outcome.completedActions++;
          outcome.reply = r.message;
          await say(r.message, true);
          return outcome;
        }

        // 2) O resto precisa da IA no backend.
        const s = settingsRef.current;
        if (!s.backendUrl || !(await hasSession())) {
          await say(
            'Sem conexão com a IA. Posso abrir apps, links, mapas, configurações, discador e controlar mídia por comando direto. Para conversar, conecte o cérebro em Ajustes.',
            true,
          );
          return outcome;
        }
        apiHistory.current.push({ role: 'user', content: text });
        apiHistory.current = apiHistory.current.slice(-30);
        const context: Record<string, unknown> = {
          allowedUiApps: s.allowedUiApps,
          accessibilityEnabled: JarvisAccessibility ? (await JarvisAccessibility.getStatus()).connected : false,
        };
        if (s.shareAppList) context.installedApps = (await listApps()).map((a) => a.label);
        if (conversationRef.current) context.conversationMode = true;
        // "Assistir junto": manda o que está na tela SÓ junto desta pergunta, quando
        // ela fala da tela ou quando você está com outro app aberto na frente.
        let screen: Awaited<ReturnType<typeof collectScreenContext>>['screen'];
        if (screenWatchRef.current && (refersToScreen(text) || AppState.currentState !== 'active')) {
          const sc = await collectScreenContext();
          if (sc.foregroundApp) context.foregroundApp = sc.foregroundApp;
          if (sc.blocked) addMessage('system', 'Tela de app protegido (banco/senha): não enviei a imagem.');
          screen = sc.screen;
          if (screen?.imageBase64) addMessage('system', 'Enviei a tela atual junto da pergunta.');
        }

        let lastReply = '';
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          if (cancelRef.current.cancelled) return { ...outcome, cancelled: true };
          setPhase('processing');
          const resp = await chat(s.backendUrl, apiHistory.current, context, abort.signal, round === 0 ? screen : undefined);
          apiHistory.current.push(resp.assistantMessage);
          if (resp.reply) {
            lastReply = resp.reply;
            addMessage('assistant', resp.reply);
          }
          if (resp.actions.length === 0 && resp.rejected.length === 0) break;
          if (round === MAX_TOOL_ROUNDS) break;
          for (const { callId, action } of resp.actions) {
            if (cancelRef.current.cancelled) return { ...outcome, cancelled: true };
            const r = await execute(action);
            if (r.status === 'completed') outcome.completedActions++;
            addMessage('system', r.message);
            apiHistory.current.push({ role: 'tool', tool_call_id: callId, content: JSON.stringify({ status: r.status, message: r.message }) });
          }
          for (const rej of resp.rejected) {
            addMessage('system', `Proposta recusada (${rej.name}): ${rej.reason}`);
            apiHistory.current.push({ role: 'tool', tool_call_id: rej.callId, content: JSON.stringify({ status: 'refused', message: rej.reason }) });
          }
        }
        if (lastReply && settingsRef.current.speakReplies && !cancelRef.current.cancelled) {
          setPhase('speaking');
          await voice.speak(lastReply);
        }
        outcome.reply = lastReply;
        if (connection.state !== 'online') void checkConnection();
        return outcome;
      } catch (e) {
        if (cancelRef.current.cancelled) return { ...outcome, cancelled: true };
        if (e instanceof BackendError) {
          const extra = e.kind === 'offline' || e.kind === 'timeout' ? ' Ações já executadas ficam registradas e não serão repetidas.' : '';
          await say(`${e.message}${extra}`, true);
          setConnection({ state: 'offline', message: e.message });
        } else {
          await say(`Algo deu errado: ${e instanceof Error ? e.message : String(e)}`, true);
        }
        return { ...outcome, cancelled: true };
      } finally {
        if (abortRef.current === abort) abortRef.current = null;
        setPhase('ready');
        setProgress(null);
      }
    },
    [draft, addMessage, say, execute, connection.state],
  );

  // ---------- voz ----------
  const pauseWake = async () => {
    if (wakeRunningRef.current && JarvisAmbient) {
      await JarvisAmbient.pauseWake();
      setWakeState('paused');
    }
  };

  const resumeWake = async () => {
    if (wakeRunningRef.current && JarvisAmbient) {
      await JarvisAmbient.resumeWake();
      setWakeState('listening');
    }
  };

  /** Encerra a conversa por voz e volta a esperar "Jarvis". */
  const endConversation = useCallback(async () => {
    conversationRef.current = false;
    setConversation(false);
    await resumeWake();
  }, []);

  /**
   * Ouve UMA fala. Na conversa por voz o texto vai direto (mãos livres);
   * no botão manual ele fica no campo para você conferir e editar.
   */
  const listenOnce = useCallback(
    async (mode: 'manual' | 'conversation') => {
      await voice.stopSpeaking();
      const perm = await voice.requestMicPermission();
      if (perm !== 'granted') {
        setNotice(
          perm === 'blocked'
            ? 'O microfone foi bloqueado. Libere em Configurações → Permissões do Jarvis. Você pode continuar digitando.'
            : 'Sem permissão de microfone. Você pode continuar digitando.',
        );
        if (mode === 'conversation') await endConversation();
        return;
      }
      await pauseWake(); // o detector de "Jarvis" solta o microfone
      setPartial('');
      setPhase('listening');
      listenCleanup.current?.();
      let heard: string | null = null;
      let failed = false;
      listenCleanup.current = await voice.startListening({
        onPartial: (t) => setPartial(t),
        onFinal: (t) => {
          setPartial('');
          heard = t;
          if (mode === 'manual') setDraft(t); // fica visível e editável antes de enviar
        },
        onError: (code, message) => {
          failed = true;
          // Silêncio no meio da conversa = fim da conversa, sem bronca.
          if (!(mode === 'conversation' && (code === 'silence' || code === 'no_match'))) setNotice(message);
        },
        onVolume: (rms) => setVolume(Math.max(0, Math.min(1, (rms + 2) / 12))),
        onEnd: () => {
          listenCleanup.current?.();
          listenCleanup.current = null;
          setVolume(0);
          setPhase((p) => (p === 'listening' ? 'ready' : p));
          if (mode === 'manual') {
            void resumeWake();
            return;
          }
          if (heard && !failed) void voiceTurnRef.current(heard);
          else void endConversation();
        },
      });
    },
    [endConversation],
  );

  /** Uma rodada da conversa por voz: despedida encerra; senão responde e decide se continua. */
  const voiceTurnRef = useRef<(t: string) => Promise<void>>(async () => {});
  voiceTurnRef.current = async (heardRaw: string) => {
    const heard = stripWakeWord(heardRaw) || heardRaw;
    if (isEndPhrase(heard)) {
      addMessage('user', heardRaw);
      await say(farewell(), true);
      setPhase('ready');
      await endConversation();
      return;
    }
    const outcome = await send(heard);
    if (!conversationRef.current) return;
    if (!outcome || outcome.cancelled || shouldEndAfterTurn(outcome)) {
      await endConversation();
      return;
    }
    // Continua a conversa: escuta a próxima fala (silêncio encerra).
    setTimeout(() => {
      if (conversationRef.current) void listenOnce('conversation');
    }, 250);
  };

  /** Chamado quando o detector ouve "Jarvis". */
  const startConversation = useCallback(() => {
    if (conversationRef.current || confirmRef.current) return;
    conversationRef.current = true;
    setConversation(true);
    void listenOnce('conversation');
  }, [listenOnce]);
  voiceRef.current.startConversation = startConversation;

  const listen = useCallback(async () => {
    await listenOnce('manual');
  }, [listenOnce]);

  const stopListen = useCallback(async () => {
    await voice.stopListening();
  }, []);

  const cancelAll = useCallback(async () => {
    cancelRef.current.cancelled = true;
    abortRef.current?.abort();
    confirmRef.current?.resolve(false);
    await Promise.all([voice.stopSpeaking(), voice.cancelListening()]);
    listenCleanup.current?.();
    listenCleanup.current = null;
    setPartial('');
    setProgress(null);
    setPhase('ready');
    await endConversation();
  }, [endConversation]);

  // ---------- recursos sempre ligados ----------
  const savePicovoiceKey = useCallback(async (key: string) => {
    await setPicovoiceKey(key);
    setHasPicovoiceKey(!!key.trim());
  }, []);

  const setWakeEnabled = useCallback(
    async (on: boolean): Promise<string> => {
      if (!JarvisAmbient) return 'Recurso disponível só no APK do Jarvis.';
      if (!on) {
        await JarvisAmbient.stopWake();
        wakeRunningRef.current = false;
        setWakeState('off');
        await updateSettings({ wakeEnabled: false });
        return 'Escuta de "Jarvis" desligada.';
      }
      const key = await getPicovoiceKey();
      if (!key) return 'Cole primeiro a chave do Picovoice (AccessKey).';
      if ((await voice.requestMicPermission()) !== 'granted') return 'Sem permissão de microfone não dá para ouvir "Jarvis".';
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        // Sem esta permissão o Android esconde o aviso fixo (a escuta funciona, mas fica invisível).
        await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never);
      }
      setWakeState('starting');
      const r = await JarvisAmbient.startWake(key, settingsRef.current.wakeSensitivity);
      if (r.status !== 'completed') {
        setWakeState('off');
        return r.message;
      }
      wakeRunningRef.current = true;
      await updateSettings({ wakeEnabled: true });
      return r.message;
    },
    [updateSettings],
  );

  const setScreenWatch = useCallback(async (on: boolean): Promise<string> => {
    if (!JarvisAmbient) return 'Recurso disponível só no APK do Jarvis.';
    if (!on) {
      await JarvisAmbient.stopScreenWatch();
      return 'Modo assistir junto desligado.';
    }
    const r = await JarvisAmbient.startScreenWatch();
    return r.message;
  }, []);

  const clearHistory = useCallback(async () => {
    await ledger.clear();
    await clearChat();
    setMessages([]);
    apiHistory.current = [];
  }, []);

  const disconnectBackend = useCallback(async () => {
    const r = await backendDisconnect(settingsRef.current.backendUrl);
    apiHistory.current = [];
    setConnection({ state: 'unconfigured' });
    return r.remoteRevoked
      ? 'Desconectado. O acesso deste celular foi revogado no servidor.'
      : 'Sessão apagada deste celular. Para bloquear também no servidor: no gateway do PC use "npm run revoke"; na nuvem, adicione o id do aparelho em JARVIS_REVOKED_DEVICES.';
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      phase,
      draft,
      setDraft,
      partial,
      volume,
      messages,
      progress,
      notice,
      dismissNotice: () => setNotice(null),
      settings,
      updateSettings,
      connection,
      refreshConnection,
      disconnectBackend,
      records,
      clearHistory,
      pendingConfirm,
      answerConfirm,
      listen,
      stopListen,
      send,
      cancelAll,
      runQuick,
      conversation,
      wakeState,
      hasPicovoiceKey,
      savePicovoiceKey,
      setWakeEnabled,
      screenWatch,
      setScreenWatch,
    }),
    [phase, draft, partial, volume, messages, progress, notice, settings, updateSettings, connection, refreshConnection, disconnectBackend, records, clearHistory, pendingConfirm, answerConfirm, listen, stopListen, send, cancelAll, runQuick, conversation, wakeState, hasPicovoiceKey, savePicovoiceKey, setWakeEnabled, screenWatch, setScreenWatch],
  );

  return <JarvisContext.Provider value={value}>{children}</JarvisContext.Provider>;
}

export function useJarvis(): Ctx {
  const c = useContext(JarvisContext);
  if (!c) throw new Error('useJarvis fora do JarvisProvider');
  return c;
}

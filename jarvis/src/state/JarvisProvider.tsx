import { randomUUID } from 'expo-crypto';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { JarvisAccessibility } from '../../modules/jarvis-device';
import type { ActionRecord, ActionRequest, ActionResult, ToolArgs, ToolName } from '../core/contract';
import { parseLocalCommand } from '../core/intents';
import { ActionLedger } from '../core/ledger';
import { ConfirmRequest, runAction, RunnerDeps } from '../core/runner';
import { BackendError, chat, disconnect as backendDisconnect, getStatus, hasSession, proposeUiStep, type ApiMessage } from '../services/backend';
import { executeAction, listApps } from '../services/executor';
import { asyncStore, ChatMessage, clearChat, DEFAULT_SETTINGS, loadChat, loadSettings, saveChat, saveSettings, Settings } from '../services/storage';
import * as voice from '../services/voice';

export type Phase = 'ready' | 'listening' | 'processing' | 'speaking' | 'executing';

export type Connection =
  | { state: 'unconfigured' }
  | { state: 'checking' }
  | { state: 'online'; model: string | null; deviceName: string }
  | { state: 'degraded'; message: string }
  | { state: 'offline'; message: string };

type PendingConfirm = ConfirmRequest & { resolve: (ok: boolean) => void };

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
  send: (text?: string) => Promise<void>;
  cancelAll: () => Promise<void>;
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

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const abortRef = useRef<AbortController | null>(null);
  const listenCleanup = useRef<(() => void) | null>(null);
  const apiHistory = useRef<ApiMessage[]>([]);
  const stepExtras = useRef<{ pendingTypedText?: string; screenTitle?: string }>({});
  const confirmRef = useRef<PendingConfirm | null>(null);

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
      await checkConnection(s);
    })();
    const unsub = ledger.subscribe(() => setRecords(ledger.list()));
    // Ao ir para segundo plano: libera microfone e para a fala.
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') {
        void voice.stopSpeaking();
      }
    });
    return () => {
      unsub();
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
      else setConnection({ state: 'degraded', message: `Gateway OK, mas o OpenJarvis não respondeu: ${st.openjarvis.error ?? 'motivo desconhecido'}` });
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
    async (input?: string) => {
      const text = (input ?? draft).trim();
      if (!text) return;
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
          await say(local.message, true);
          return;
        }
        if (local?.kind === 'action') {
          const now = Date.now();
          const r = await execute({ id: randomUUID(), tool: local.tool, args: local.args, createdAt: now, expiresAt: now + 60_000, source: 'local' });
          await say(r.message, true);
          return;
        }

        // 2) O resto precisa da IA no backend.
        const s = settingsRef.current;
        if (!s.backendUrl || !(await hasSession())) {
          await say(
            'Sem conexão com a IA. Posso abrir apps, links, mapas, configurações, discador e controlar mídia por comando direto. Para conversar, conecte o backend em Configurações.',
            true,
          );
          return;
        }
        apiHistory.current.push({ role: 'user', content: text });
        apiHistory.current = apiHistory.current.slice(-30);
        const context: Record<string, unknown> = {
          allowedUiApps: s.allowedUiApps,
          accessibilityEnabled: JarvisAccessibility ? (await JarvisAccessibility.getStatus()).connected : false,
        };
        if (s.shareAppList) context.installedApps = (await listApps()).map((a) => a.label);

        let lastReply = '';
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          if (cancelRef.current.cancelled) return;
          setPhase('processing');
          const resp = await chat(s.backendUrl, apiHistory.current, context, abort.signal);
          apiHistory.current.push(resp.assistantMessage);
          if (resp.reply) {
            lastReply = resp.reply;
            addMessage('assistant', resp.reply);
          }
          if (resp.actions.length === 0 && resp.rejected.length === 0) break;
          if (round === MAX_TOOL_ROUNDS) break;
          for (const { callId, action } of resp.actions) {
            if (cancelRef.current.cancelled) return;
            const r = await execute(action);
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
        if (connection.state !== 'online') void checkConnection();
      } catch (e) {
        if (cancelRef.current.cancelled) return;
        if (e instanceof BackendError) {
          const extra = e.kind === 'offline' || e.kind === 'timeout' ? ' Ações já executadas ficam registradas e não serão repetidas.' : '';
          await say(`${e.message}${extra}`, true);
          setConnection({ state: 'offline', message: e.message });
        } else {
          await say(`Algo deu errado: ${e instanceof Error ? e.message : String(e)}`, true);
        }
      } finally {
        if (abortRef.current === abort) abortRef.current = null;
        setPhase('ready');
        setProgress(null);
      }
    },
    [draft, addMessage, say, execute, connection.state],
  );

  // ---------- voz ----------
  const listen = useCallback(async () => {
    await voice.stopSpeaking();
    const perm = await voice.requestMicPermission();
    if (perm !== 'granted') {
      setNotice(
        perm === 'blocked'
          ? 'O microfone foi bloqueado. Libere em Configurações → Permissões do Jarvis. Você pode continuar digitando.'
          : 'Sem permissão de microfone. Você pode continuar digitando.',
      );
      return;
    }
    setPartial('');
    setPhase('listening');
    listenCleanup.current?.();
    listenCleanup.current = await voice.startListening({
      onPartial: (t) => setPartial(t),
      onFinal: (t) => {
        setPartial('');
        setDraft(t); // fica visível e editável antes de enviar
      },
      onError: (_code, message) => setNotice(message),
      onVolume: (rms) => setVolume(Math.max(0, Math.min(1, (rms + 2) / 12))),
      onEnd: () => {
        listenCleanup.current?.();
        listenCleanup.current = null;
        setVolume(0);
        setPhase((p) => (p === 'listening' ? 'ready' : p));
      },
    });
  }, []);

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
      ? 'Desconectado. O acesso deste celular foi revogado no gateway.'
      : 'Sessão apagada deste celular. O gateway não respondeu: revogue também pelo computador com "npm run revoke".';
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
    }),
    [phase, draft, partial, volume, messages, progress, notice, settings, updateSettings, connection, refreshConnection, disconnectBackend, records, clearHistory, pendingConfirm, answerConfirm, listen, stopListen, send, cancelAll, runQuick],
  );

  return <JarvisContext.Provider value={value}>{children}</JarvisContext.Provider>;
}

export function useJarvis(): Ctx {
  const c = useContext(JarvisContext);
  if (!c) throw new Error('useJarvis fora do JarvisProvider');
  return c;
}

import type { ActionStatus } from '../core/contract';
import type { Connection, Phase } from '../state/JarvisProvider';

export const PHASE_LABEL: Record<Phase, string> = {
  ready: 'Pronto',
  listening: 'Ouvindo…',
  processing: 'Processando…',
  speaking: 'Falando…',
  executing: 'Executando…',
};

export const STATUS_LABEL: Record<ActionStatus, string> = {
  pending: 'Recebida',
  awaiting_confirmation: 'Aguardando confirmação',
  running: 'Executando',
  completed: 'Concluída',
  refused: 'Recusada',
  unavailable: 'Indisponível',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};

export function statusTone(s: ActionStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (s === 'completed') return 'ok';
  if (s === 'failed') return 'danger';
  if (s === 'refused' || s === 'unavailable' || s === 'expired') return 'warn';
  return 'neutral';
}

export function connectionLabel(c: Connection): { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' } {
  switch (c.state) {
    case 'online':
      return { label: 'IA conectada', tone: 'ok' };
    case 'checking':
      return { label: 'Verificando conexão…', tone: 'neutral' };
    case 'degraded':
      return { label: 'Gateway sem IA', tone: 'warn' };
    case 'offline':
      return { label: 'IA offline · comandos locais', tone: 'danger' };
    default:
      return { label: 'Sem backend · comandos locais', tone: 'neutral' };
  }
}

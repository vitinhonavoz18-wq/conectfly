import { ActionRequest, ActionResult, isTerminal } from './contract';
import { ActionLedger, fingerprintAction } from './ledger';
import { PolicyContext, PolicyDecision, decide } from './policy';
import { validateAction } from './validate';

export type CancelToken = { readonly cancelled: boolean };

export type ConfirmRequest = Extract<PolicyDecision, { decision: 'confirm' }> & { action: ActionRequest };

export type RunnerDeps = {
  ledger: ActionLedger;
  /** Contexto atual do aparelho para a política (apps autorizados, app na tela...). */
  policyContext: (action: ActionRequest) => Promise<PolicyContext>;
  /** Mostra a confirmação ao usuário; resolve true somente se ele aprovar. */
  confirm: (req: ConfirmRequest) => Promise<boolean>;
  /** Execução nativa real. Deve devolver o resultado verdadeiro (nunca presumir sucesso). */
  execute: (action: ActionRequest, cancel: CancelToken) => Promise<ActionResult>;
  now?: () => number;
  cancel?: CancelToken;
};

/** Janela em que a mesma ação com efeito externo pede confirmação de novo. */
export const REPEAT_WINDOW_MS = 2 * 60 * 1000;

const EXTERNAL_EFFECT_TOOLS = new Set(['share_text', 'ui_step']);

function refused(message: string, code: NonNullable<ActionResult['error']>['code'], status: ActionResult['status'] = 'refused'): ActionResult {
  return { status, message, error: { code, message } };
}

/**
 * Pipeline único para QUALQUER ação (comando local, backend ou navegação):
 * validar → registrar → checar prazo → política → confirmar → executar → registrar resultado.
 */
export async function runAction(raw: unknown, deps: RunnerDeps): Promise<ActionResult> {
  const now = deps.now ?? Date.now;
  const v = validateAction(raw, now());
  if (!v.ok) return refused(`Ação recusada: ${v.error}.`, 'invalid_action');
  const action = v.action;

  const claim = await deps.ledger.claim(action);
  if (claim.kind === 'duplicate') {
    const prev = claim.record;
    return {
      status: isTerminal(prev.status) ? prev.status : 'refused',
      message: 'Esta ação já foi recebida antes. Não vou repeti-la.',
      error: { code: 'duplicate', message: 'ação repetida' },
    };
  }

  const finish = async (r: ActionResult): Promise<ActionResult> => {
    await deps.ledger.update(action.id, r.status, r.message, r.error?.code);
    return r;
  };

  if (now() > action.expiresAt) {
    return finish(refused('A ação expirou antes de ser executada.', 'expired', 'expired'));
  }
  if (deps.cancel?.cancelled) return finish(refused('Cancelado.', 'cancelled', 'cancelled'));

  const ctx = await deps.policyContext(action);
  let decision = decide(action, ctx);

  if (decision.decision === 'deny') {
    return finish(refused(`Não posso fazer isso: ${decision.reason}.`, 'policy_denied'));
  }

  // Mesma ação com efeito externo pouco tempo depois (ex.: reenvio após reconexão
  // com id novo): exige confirmação de novo, mesmo que normalmente não exigisse.
  if (EXTERNAL_EFFECT_TOOLS.has(action.tool)) {
    const fp = fingerprintAction(action);
    const recent = deps.ledger.findRecentEffect(fp, action.id, REPEAT_WINDOW_MS);
    if (recent) {
      const details = decision.decision === 'confirm' ? decision.details : [{ label: 'Ação', value: claim.record.summary }];
      decision = {
        decision: 'confirm',
        reason: 'ação idêntica foi executada há pouco',
        title: 'Repetir esta ação?',
        details: [...details, { label: 'Atenção', value: 'Uma ação igual foi concluída há menos de 2 minutos.' }],
      };
    }
  }

  if (decision.decision === 'confirm') {
    await deps.ledger.update(action.id, 'awaiting_confirmation', 'Aguardando sua confirmação');
    const ok = await deps.confirm({ ...decision, action });
    if (!ok) return finish(refused('Você não confirmou. Nada foi feito.', 'user_declined', 'cancelled'));
  }

  if (deps.cancel?.cancelled) return finish(refused('Cancelado.', 'cancelled', 'cancelled'));

  await deps.ledger.update(action.id, 'running', 'Executando');
  try {
    const result = await deps.execute(action, deps.cancel ?? { cancelled: false });
    return finish(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return finish(refused(`Falhou: ${msg}`, 'native_error', 'failed'));
  }
}

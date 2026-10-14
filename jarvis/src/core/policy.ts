import { ActionRequest, UiSelector } from './contract';
import { isPackageName } from './validate';

/**
 * Política local de autorização.
 *
 * Ela roda DENTRO do celular, depois da validação. O backend ou o modelo de IA
 * não conseguem desligá-la: a ação recebida não tem nenhum campo que altere
 * esta decisão (campos extras são recusados na validação).
 */

export type ConfirmationDetail = { label: string; value: string };

export type PolicyDecision =
  | { decision: 'allow'; reason: string }
  | { decision: 'confirm'; reason: string; title: string; details: ConfirmationDetail[] }
  | { decision: 'deny'; reason: string };

export type PolicyContext = {
  /** Pacotes que o usuário autorizou para navegação por acessibilidade. */
  allowedUiApps: ReadonlySet<string>;
  /** Aplicativo em primeiro plano, quando conhecido. */
  foregroundApp?: string;
  /** Texto digitado pelo Jarvis na sessão atual de navegação (para a confirmação). */
  pendingTypedText?: string;
  /** Título/cabeçalho atual da tela (para mostrar o destinatário). */
  screenTitle?: string;
  /** Rótulo do campo que receberá texto (set_text). */
  targetFieldLabel?: string;
  /** Verdadeiro quando o campo alvo é de senha (informado pelo serviço nativo). */
  targetFieldIsPassword?: boolean;
};

/**
 * Aplicativos financeiros e de autenticação: o Jarvis nunca automatiza.
 * A lista é conservadora; prefixos cobrem variações do mesmo banco.
 */
export const BLOCKED_PACKAGE_PREFIXES = [
  'com.nu.production',
  'com.itau',
  'br.com.itau',
  'com.bradesco',
  'br.com.bradesco',
  'br.com.bb.android',
  'br.com.gabba.Caixa',
  'br.gov.caixa',
  'com.santander',
  'br.com.santander',
  'br.com.intermedium',
  'com.c6bank',
  'com.picpay',
  'com.mercadopago',
  'br.com.original',
  'com.btg',
  'br.com.sicredi',
  'com.sicoob',
  'com.paypal',
  'com.google.android.apps.authenticator2',
  'com.azure.authenticator',
  'com.authy.authy',
  'com.google.android.apps.walletnfcrel',
  'com.android.settings', // evita que o Jarvis mexa nas próprias permissões
  'com.google.android.packageinstaller',
  'com.android.packageinstaller',
  'com.android.vending', // compras na loja
];

export function isBlockedPackage(pkg: string | undefined): boolean {
  if (!pkg) return false;
  // Prefixo conservador: "com.itau" também cobre "com.itau.pf", "com.itaucard" etc.
  return BLOCKED_PACKAGE_PREFIXES.some((p) => pkg.startsWith(p));
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Botões cujo clique tem efeito externo e exigem confirmação explícita. */
const SENSITIVE_CLICK_RE =
  /\b(enviar|envia|send|mandar|responder|reply|publicar|postar|post|tweet|compartilhar agora|comprar|compra|buy|pagar|pay|pagamento|checkout|finalizar pedido|confirmar pedido|fazer pedido|assinar|subscribe|transferir|excluir|apagar|deletar|delete|remove|remover|desinstalar|uninstall|ligar|call|aceitar|confirmar|confirm)\b/;

/** Campos que nunca recebem texto do Jarvis. */
const SECRET_FIELD_RE =
  /\b(senha|password|passcode|pin|cvv|cvc|codigo de seguranca|codigo de verificacao|codigo sms|otp|token|2fa|autenticacao|cartao|card number|numero do cartao|chave pix)\b/;

export function selectorLabel(sel?: UiSelector): string {
  if (!sel) return '';
  return sel.text || sel.contentDescription || sel.viewId || '';
}

export function isSensitiveClick(label: string): boolean {
  return SENSITIVE_CLICK_RE.test(normalize(label));
}

export function isSecretField(label: string): boolean {
  return SECRET_FIELD_RE.test(normalize(label));
}

export function decide(action: ActionRequest, ctx: PolicyContext): PolicyDecision {
  switch (action.tool) {
    case 'open_app':
    case 'open_url':
    case 'open_settings':
    case 'open_map':
    case 'media_control':
    case 'check_permissions':
      return { decision: 'allow', reason: 'ação simples, sem efeito externo' };
    case 'open_dialer':
      // Só abre o discador com o número preenchido: quem liga é o usuário.
      return { decision: 'allow', reason: 'o discador exige que o usuário toque em ligar' };
    case 'share_text':
      // O seletor nativo do Android já obriga o usuário a escolher o destino.
      return { decision: 'allow', reason: 'o seletor de compartilhamento exige escolha do usuário' };
    case 'ui_navigate': {
      const args = action.args as { app: string };
      const pkg = action.targetApp ?? args.app;
      if (isBlockedPackage(pkg)) {
        return { decision: 'deny', reason: 'aplicativos bancários, de senha e do sistema não podem ser automatizados' };
      }
      if (!isPackageName(pkg)) {
        // Nome falado ("YouTube"): o executor descobre o pacote instalado e só então
        // confere bloqueio e autorização (no JS e de novo no serviço nativo).
        return { decision: 'allow', reason: 'autorização conferida após identificar o app' };
      }
      if (!ctx.allowedUiApps.has(pkg)) {
        return { decision: 'deny', reason: 'este aplicativo não está na lista de apps autorizados' };
      }
      return { decision: 'allow', reason: 'aplicativo autorizado pelo usuário' };
    }
    case 'ui_step': {
      const args = action.args as { kind: string; selector?: UiSelector; text?: string };
      const pkg = action.targetApp;
      if (!pkg) return { decision: 'deny', reason: 'passo sem aplicativo de destino' };
      if (isBlockedPackage(pkg)) {
        return { decision: 'deny', reason: 'aplicativo protegido' };
      }
      if (!ctx.allowedUiApps.has(pkg)) {
        return { decision: 'deny', reason: 'aplicativo não autorizado' };
      }
      if (ctx.foregroundApp && ctx.foregroundApp !== pkg) {
        return { decision: 'deny', reason: 'o aplicativo na tela mudou' };
      }
      const label = selectorLabel(args.selector);
      if (args.kind === 'set_text') {
        if (ctx.targetFieldIsPassword || isSecretField(label) || isSecretField(ctx.targetFieldLabel ?? '')) {
          return { decision: 'deny', reason: 'o Jarvis não preenche senhas, códigos ou dados de pagamento' };
        }
        return { decision: 'allow', reason: 'preenchimento de campo comum' };
      }
      if (args.kind === 'click' && isSensitiveClick(label)) {
        const details: ConfirmationDetail[] = [
          { label: 'Aplicativo', value: pkg },
          { label: 'Botão', value: label },
        ];
        if (ctx.screenTitle) details.push({ label: 'Destinatário / tela', value: ctx.screenTitle });
        details.push({
          label: 'Conteúdo',
          value: ctx.pendingTypedText ? ctx.pendingTypedText : '(nenhum texto digitado pelo Jarvis)',
        });
        return {
          decision: 'confirm',
          reason: 'este toque pode enviar, comprar, publicar ou apagar algo',
          title: `Confirmar "${label}"?`,
          details,
        };
      }
      return { decision: 'allow', reason: 'navegação dentro de app autorizado' };
    }
    default:
      return { decision: 'deny', reason: 'ferramenta desconhecida' };
  }
}

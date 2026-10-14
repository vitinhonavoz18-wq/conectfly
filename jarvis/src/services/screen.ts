import { JarvisAccessibility, JarvisAmbient } from '../../modules/jarvis-device';
import { isBlockedPackage } from '../core/policy';
import type { ScreenContext } from './backend';

/**
 * Monta o que o Jarvis "vê" no instante da pergunta (modo assistir junto):
 * - o quadro atual da tela, se você ligou a captura;
 * - os textos visíveis, se o app da frente estiver autorizado na acessibilidade.
 * Apps bloqueados (bancos, senhas, sistema) nunca são enviados.
 */
export async function collectScreenContext(): Promise<{ screen?: ScreenContext; foregroundApp?: string; blocked?: boolean }> {
  let foregroundApp: string | undefined;
  let text: string | undefined;
  if (JarvisAccessibility) {
    try {
      const status = await JarvisAccessibility.getStatus();
      if (status.connected) {
        const obs = await JarvisAccessibility.observe();
        foregroundApp = obs.packageName ?? undefined;
        if (foregroundApp && isBlockedPackage(foregroundApp)) return { foregroundApp, blocked: true };
        if (obs.allowed && obs.nodes?.length) {
          const lines: string[] = [];
          if (obs.screenTitle) lines.push(`Título: ${obs.screenTitle}`);
          for (const n of obs.nodes) {
            const t = n.isPassword ? null : n.text || n.contentDescription;
            if (t && t.length > 1) lines.push(t);
            if (lines.length >= 40) break;
          }
          text = `App: ${foregroundApp}\n${lines.join('\n')}`;
        }
      }
    } catch {
      // sem acessibilidade: segue só com a imagem
    }
  }
  let imageBase64: string | undefined;
  if (JarvisAmbient) {
    try {
      imageBase64 = (await JarvisAmbient.captureScreen()) ?? undefined;
    } catch {
      imageBase64 = undefined;
    }
  }
  if (!imageBase64 && !text) return { foregroundApp };
  return { screen: { imageBase64, text }, foregroundApp };
}

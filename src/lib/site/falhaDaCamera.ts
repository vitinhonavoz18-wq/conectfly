/**
 * Por que a câmera não abriu — em palavras que o cliente entende.
 *
 * Antes, qualquer falha virava a mesma frase ("não foi possível acessar a
 * câmera"). Quem tinha negado a permissão, quem estava num computador sem
 * câmera e quem estava com a câmera presa em outro app recebiam o mesmo
 * recado, e nenhum sabia o que fazer. É o garçom dizer só "não dá" em vez de
 * "acabou o gás" ou "a cozinha fechou".
 */

export type FalhaDaCamera = "inseguro" | "permissao" | "sem-camera" | "ocupada" | "outra";

export function tipoDaFalha(erro: unknown, conexaoSegura = true): FalhaDaCamera {
  // Sem HTTPS o navegador nem oferece a câmera, seja qual for o erro.
  if (!conexaoSegura) return "inseguro";
  const e = erro as { name?: unknown; message?: unknown } | null | undefined;
  const texto = `${typeof e?.name === "string" ? e.name : ""} ${
    typeof e?.message === "string" ? e.message : String(erro ?? "")
  }`;
  if (/NotAllowed|Permission|denied|SecurityError/i.test(texto)) return "permissao";
  if (/NotFound|Overconstrained|device not found|no camera|not found/i.test(texto))
    return "sem-camera";
  if (/NotReadable|TrackStart|Could not start|in use/i.test(texto)) return "ocupada";
  return "outra";
}

export const MENSAGEM_DA_FALHA: Record<FalhaDaCamera, { titulo: string; dica: string }> = {
  inseguro: {
    titulo: "A câmera só funciona no endereço seguro",
    dica: "Abra o cardápio pelo link oficial da loja (com https) e tente de novo.",
  },
  permissao: {
    titulo: "Precisamos da sua permissão para usar a câmera",
    dica: "Toque no cadeado ao lado do endereço do site, libere a câmera e toque em “Tentar novamente”.",
  },
  "sem-camera": {
    titulo: "Não encontramos uma câmera neste aparelho",
    dica: "Você pode enviar uma foto do QR Code da mesa.",
  },
  ocupada: {
    titulo: "A câmera está sendo usada por outro aplicativo",
    dica: "Feche o outro app que usa a câmera e toque em “Tentar novamente”.",
  },
  outra: {
    titulo: "Não foi possível abrir a câmera",
    dica: "Tente novamente ou envie uma foto do QR Code da mesa.",
  },
};

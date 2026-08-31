import { useEffect, useMemo, useRef, useState } from "react";
import { agora } from "./relogio";
import {
  capaDoMomento,
  lerProgramacao,
  proximaTroca,
  type CapaFixa,
  type CapaResolvida,
} from "./heroSchedule";

/**
 * Descobre qual capa deve estar no ar agora — e troca sozinha na hora certa.
 *
 * SÓ A MÍDIA DO MOMENTO É BAIXADA
 *
 * A loja pode ter quatro vídeos programados. O cliente que abre o cardápio às
 * oito da manhã baixa UM: o da manhã. Este gancho devolve um endereço só, e
 * quem desenha a tela coloca um elemento só. Os outros três nem chegam a ser
 * pedidos — é a diferença entre o garçom trazer o prato pedido e trazer a
 * cozinha inteira para a mesa.
 *
 * UM DESPERTADOR, NÃO UMA PERGUNTA REPETIDA
 *
 * Em vez de checar "já mudou?" de minuto em minuto, ele calcula QUANDO será a
 * próxima virada e marca um único despertador para aquele instante. Se a
 * próxima troca é daqui a quatro horas, o cardápio não faz absolutamente nada
 * durante essas quatro horas.
 *
 * CELULAR QUE DORMIU NO BOLSO
 *
 * Quando a aba fica escondida, o navegador atrasa ou congela despertadores.
 * Por isso, ao voltar para a tela, a conta é refeita na hora — senão o cliente
 * que deixou o cardápio aberto no bolso durante o almoço voltaria e ainda
 * veria a capa do café da manhã.
 */
export function useCapaDoHero(siteSettings: unknown, fixa: CapaFixa): CapaResolvida {
  const programacao = useMemo(() => lerProgramacao(siteSettings), [siteSettings]);

  // A capa fixa vem em duas partes; guardá-las soltas evita recalcular tudo a
  // cada desenho da tela só porque o objeto foi criado de novo.
  const fixaEstavel = useMemo<CapaFixa>(
    () => ({ tipo: fixa.tipo, url: fixa.url }),
    [fixa.tipo, fixa.url],
  );

  const [capa, setCapa] = useState<CapaResolvida>(() =>
    capaDoMomento(programacao, fixaEstavel, agora()),
  );

  const capaRef = useRef(capa);
  capaRef.current = capa;

  useEffect(() => {
    let despertador: ReturnType<typeof setTimeout> | undefined;
    let vivo = true;

    const reavaliar = () => {
      if (!vivo) return;
      const instante = agora();
      const nova = capaDoMomento(programacao, fixaEstavel, instante);

      // Só mexe na tela se a mídia realmente mudou. Trocar o endereço pelo
      // mesmo endereço faria o navegador recarregar o vídeo à toa.
      const atual = capaRef.current;
      if (nova.url !== atual.url || nova.tipo !== atual.tipo) setCapa(nova);

      const proxima = proximaTroca(programacao, instante);
      if (despertador) clearTimeout(despertador);
      if (proxima) {
        const emQuanto = proxima.getTime() - instante.getTime();
        // O navegador não garante esperas muito longas. Acordar antes e
        // recalcular é barato e mantém a conta sempre correta.
        const UM_DIA = 24 * 60 * 60 * 1000;
        despertador = setTimeout(reavaliar, Math.min(Math.max(emQuanto, 1000), UM_DIA));
      }
    };

    reavaliar();

    // Voltou para a tela: refaz a conta, porque o despertador pode ter
    // dormido junto com o aparelho.
    const aoVoltar = () => {
      if (document.visibilityState === "visible") reavaliar();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      vivo = false;
      if (despertador) clearTimeout(despertador);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [programacao, fixaEstavel]);

  return capa;
}

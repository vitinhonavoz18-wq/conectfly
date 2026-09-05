/**
 * A tarja de "loja fechada" no topo do cardápio.
 *
 * POR QUE ELA FICA AQUI, E NÃO DENTRO DE CADA MODELO DE SITE
 *
 * O cardápio tem vários modelos visuais (black, clean, etc.). Se o aviso
 * fosse escrito dentro de cada um, bastaria criar um modelo novo e esquecer
 * de copiar o aviso para existir uma loja que fecha e continua vendendo.
 *
 * Uma plaquinha só, pendurada na porta de entrada, serve todas as salas.
 *
 * O QUE ELA NÃO FAZ
 *
 * Ela não tranca nada — é um aviso. Quem recusa o pedido de verdade é o
 * servidor (`submit-order`), e a tela de finalizar também confere. Esta tarja
 * existe para o cliente descobrir logo ao chegar, e não depois de escolher
 * tudo e digitar o endereço.
 */

export function SiteClosedBanner({ hours }: { hours?: string | null }) {
  const horario = (hours ?? "").trim();

  return (
    <div
      role="status"
      className="sticky top-0 z-50 w-full border-b border-black/10 bg-[#B42318] px-4 py-3 text-center text-white shadow-md"
    >
      <p className="text-sm font-bold tracking-tight sm:text-base">
        Estamos fechados no momento
      </p>
      <p className="mt-0.5 text-xs text-white/90 sm:text-sm">
        Você pode ver o cardápio à vontade — mas não dá para finalizar pedidos agora.
        {horario ? ` Nosso horário: ${horario}.` : ""}
      </p>
    </div>
  );
}

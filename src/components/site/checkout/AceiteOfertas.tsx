/**
 * A caixa de "quero receber ofertas".
 *
 * POR QUE ELA EXISTE E POR QUE COMEÇA DESMARCADA
 *
 * Sem esta caixa, o restaurante não pode mandar promoção para ninguém — e é
 * assim que tem de ser. Ter o telefone da pessoa porque ela pediu uma pizza
 * não é o mesmo que ter permissão para mandar propaganda: é como o
 * restaurante ter o endereço do cliente para entregar e usar isso para
 * enfiar panfleto embaixo da porta toda semana.
 *
 * Ela começa desmarcada e não existe caminho que a marque sozinha. Caixa que
 * já vem marcada não é permissão, é pegadinha. E, na prática, propaganda para
 * quem não pediu é o jeito mais rápido de o número de WhatsApp do restaurante
 * ser denunciado e bloqueado — o prejuízo cai em cima do dono.
 *
 * A mesma caixa é usada nos dois formatos de checkout (lateral e central)
 * para o texto nunca divergir entre eles.
 */

export function AceiteOfertas({
  nomeRestaurante,
  marcado,
  aoMudar,
}: {
  nomeRestaurante?: string | null;
  marcado: boolean;
  aoMudar: (v: boolean) => void;
}) {
  const nome = (nomeRestaurante ?? "").trim();

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] p-3 transition-colors hover:border-[hsl(var(--site-primary)/0.4)]">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => aoMudar(e.target.checked)}
        className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer accent-[hsl(var(--site-primary))]"
      />
      <span className="text-sm leading-snug text-[hsl(var(--site-fg))]">
        {/* "de {nome}" em vez de "do/da {nome}": funciona com qualquer nome,
            sem chutar o gênero e escrever "do Pizzaria Bella". */}
        Quero receber ofertas, novidades e cupons {nome ? `de ${nome}` : "deste estabelecimento"}{" "}
        pelo WhatsApp.
        <span className="mt-0.5 block text-xs font-normal text-[hsl(var(--site-muted-fg))]">
          É opcional e você pode pedir para sair quando quiser.
        </span>
      </span>
    </label>
  );
}

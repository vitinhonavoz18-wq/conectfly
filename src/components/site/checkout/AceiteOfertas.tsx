/**
 * A caixa de "quero receber ofertas".
 *
 * ELA VEM MARCADA — E POR QUE ISSO PRECISA DE CUIDADO
 *
 * Decisão do dono do produto: a caixa chega marcada e o cliente desmarca se
 * não quiser. É prática comum no comércio brasileiro, mas tem um custo real
 * que vale estar escrito aqui, porque quem paga é o restaurante:
 *
 * Quem não repara que estava marcado recebe promoção sem esperar, e o botão
 * mais fácil do WhatsApp nessa hora é "denunciar". Denúncia suficiente e o
 * WhatsApp bloqueia o número do restaurante — não o nosso, o dele. É o
 * equivalente a distribuir panfleto na porta de quem não pediu: funciona
 * algumas vezes e queima a rua para sempre.
 *
 * Por isso o desenho aqui é o oposto de escondido:
 *
 * - a caixa fica dentro de um bloco com cor e borda, não perdida no meio do
 *   formulário;
 * - o texto diz em voz alta que está marcada e que dá para desmarcar;
 * - a área de clique é a linha inteira, então desmarcar é fácil de acertar
 *   com o dedo no celular.
 *
 * Se um dia o número do restaurante começar a ser denunciado, o primeiro
 * lugar para olhar é este arquivo.
 *
 * A mesma caixa é usada nos dois formatos de checkout (lateral e central)
 * para o texto nunca divergir entre eles.
 */

export function AceiteOfertas({
  nomeRestaurante,
  marcado,
  aoMudar,
  descontoPercent,
}: {
  nomeRestaurante?: string | null;
  marcado: boolean;
  aoMudar: (v: boolean) => void;
  /** Desconto que o restaurante oferece a quem aceita. 0 = não oferece nada. */
  descontoPercent?: number | null;
}) {
  const nome = (nomeRestaurante ?? "").trim();
  const desconto = Number(descontoPercent ?? 0);
  const temDesconto = Number.isFinite(desconto) && desconto > 0;

  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
        marcado
          ? "border-[hsl(var(--site-primary)/0.5)] bg-[hsl(var(--site-primary)/0.06)]"
          : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary)/0.4)]"
      }`}
    >
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
        {temDesconto && (
          <span className="mt-1 block text-xs font-bold text-[hsl(var(--site-primary))]">
            Ganhe {desconto}% de desconto no seu próximo pedido.
          </span>
        )}
        {/* Dizer que está marcada é o que separa "oferta" de "pegadinha". */}
        <span className="mt-0.5 block text-xs font-normal text-[hsl(var(--site-muted-fg))]">
          {marcado
            ? "Já vem marcado. Se não quiser, é só desmarcar aqui."
            : "Desmarcado — você não vai receber nada."}
        </span>
      </span>
    </label>
  );
}

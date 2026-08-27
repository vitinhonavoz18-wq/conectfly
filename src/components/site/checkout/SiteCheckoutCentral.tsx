import { useEffect, useRef } from "react";
import { AceiteOfertas } from "./AceiteOfertas";
import {
  X,
  Minus,
  Plus,
  Trash2,
  Bike,
  Store,
  Utensils,
  ShoppingBag,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { formatBRL, formatPhoneMask } from "@/lib/site/format";
import type { DeliveryZoneRow, RestaurantRow } from "@/lib/site/types";
import { useCheckoutCore } from "./useCheckoutCore";

interface Props {
  open: boolean;
  onClose: () => void;
  whatsappNumber: string;
  restaurantName: string;
  deliveryZones?: DeliveryZoneRow[];
  restaurant?: RestaurantRow;
}

/** Rótulo e ícone de cada campo, num só lugar para não repetir classe. */
const inputClass =
  "w-full rounded-xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] px-3.5 py-3 text-base text-[hsl(var(--site-fg))] placeholder:text-[hsl(var(--site-muted-fg))] focus:border-[hsl(var(--site-primary)/0.6)] focus:outline-none";

const invalidClass =
  "ring-2 ring-[hsl(var(--site-danger)/0.35)] border-[hsl(var(--site-danger)/0.6)]";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-[hsl(var(--site-muted-fg))]">
      {children}
    </h3>
  );
}

/**
 * Checkout central — sobe de baixo para cima, no estilo dos aplicativos de
 * delivery. É só a aparência: a conta, as validações e o envio do pedido vêm
 * de `useCheckoutCore`, o mesmo que o painel lateral usa. Trocar de modelo
 * muda o que o cliente vê, nunca o que ele paga.
 */
export function SiteCheckoutCentral(props: Props) {
  const { open, onClose, restaurant, deliveryZones = [] } = props;
  const core = useCheckoutCore(props);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const isDelivery = core.orderType === "delivery";
  const isTable = core.orderType === "table";
  const tablesOn = restaurant?.table_enabled !== false && !!core.validatedTable;
  const pickupOn = restaurant?.pickup_enabled !== false;
  const deliveryOn = restaurant?.delivery_enabled !== false;

  // Trava a rolagem do cardápio atrás do checkout e devolve como estava ao
  // fechar. Sem isso, arrastar dentro do checkout rola a página de trás —
  // o cliente perde o lugar e acha que o site travou.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // ESC fecha, como em qualquer janela do computador.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Ao abrir, o foco entra no checkout — quem navega por teclado ou leitor de
  // tela não fica preso na página de trás.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  const showConfirmation = core.step === "confirmation";

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Seu pedido"
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-[820px] flex-col overflow-hidden rounded-t-3xl bg-[hsl(var(--site-bg))] shadow-[0_-10px_60px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Barrinha de arrastar, centralizada no topo — o sinal visual de que
            isto é uma folha que sobe, e não uma página nova. */}
        <div className="flex shrink-0 justify-center pt-2 sm:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-[hsl(var(--site-border))]" />
        </div>

        {/* Cabeçalho fixo: o cliente sempre enxerga onde está e como sair. */}
        <div className="flex shrink-0 items-center justify-between border-b border-[hsl(var(--site-border))] px-5 pb-3 pt-3">
          <h2 className="text-xl font-black uppercase tracking-tight text-[hsl(var(--site-primary))]">
            Seu pedido
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Fechar o checkout"
            className="grid h-11 w-11 place-items-center rounded-xl text-[hsl(var(--site-muted-fg))] transition-colors hover:bg-[hsl(var(--site-card))]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {showConfirmation ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <CheckCircle2
              className="h-14 w-14 text-[hsl(var(--site-success))]"
              aria-hidden="true"
            />
            <p className="text-lg font-black text-[hsl(var(--site-fg))]">Pedido confirmado!</p>
            {core.ticketNumber && (
              <p className="text-sm text-[hsl(var(--site-muted-fg))]">
                Senha de retirada: <strong>{core.ticketNumber}</strong>
              </p>
            )}
            <button
              onClick={onClose}
              className="site-btn-primary mt-2 rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-widest"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            <div
              ref={core.scrollContainerRef}
              className="flex-1 overflow-y-auto overscroll-contain px-5 py-4"
            >
              {core.items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <ShoppingBag
                    className="h-12 w-12 text-[hsl(var(--site-muted-fg))]"
                    aria-hidden="true"
                  />
                  <p className="font-bold text-[hsl(var(--site-fg))]">Seu carrinho está vazio</p>
                  <p className="text-sm text-[hsl(var(--site-muted-fg))]">
                    Escolha um item do cardápio para começar.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* ---- Resumo do pedido ------------------------------- */}
                  <section className="space-y-3">
                    {core.items.map((line) => (
                      <div
                        key={`${line.itemId}-${line.sizeLabel ?? ""}`}
                        className="flex items-start gap-3 rounded-2xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold leading-tight text-[hsl(var(--site-fg))]">
                            {line.name}
                          </p>
                          {line.sizeLabel && (
                            <p className="text-xs text-[hsl(var(--site-muted-fg))]">
                              {line.sizeLabel}
                            </p>
                          )}
                          {line.description && (
                            <p className="mt-0.5 text-xs leading-snug text-[hsl(var(--site-muted-fg))]">
                              {line.description}
                            </p>
                          )}
                          <p className="mt-1 font-black text-[hsl(var(--site-secondary))]">
                            {formatBRL(line.unitPrice * line.quantity)}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-[hsl(var(--site-border))] p-1">
                          <button
                            aria-label={`Diminuir ${line.name}`}
                            onClick={() =>
                              line.quantity <= 1
                                ? core.removeLine(line.itemId, line.sizeLabel)
                                : core.updateQty(line.itemId, line.sizeLabel, line.quantity - 1)
                            }
                            className="grid h-9 w-9 place-items-center rounded-lg text-[hsl(var(--site-fg))] transition-colors hover:bg-[hsl(var(--site-bg))]"
                          >
                            {line.quantity <= 1 ? (
                              <Trash2 className="h-4 w-4 text-[hsl(var(--site-danger))]" />
                            ) : (
                              <Minus className="h-4 w-4" />
                            )}
                          </button>
                          <span className="w-6 text-center font-black text-[hsl(var(--site-fg))]">
                            {line.quantity}
                          </span>
                          <button
                            aria-label={`Aumentar ${line.name}`}
                            onClick={() =>
                              core.updateQty(line.itemId, line.sizeLabel, line.quantity + 1)
                            }
                            className="grid h-9 w-9 place-items-center rounded-lg text-[hsl(var(--site-fg))] transition-colors hover:bg-[hsl(var(--site-bg))]"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </section>

                  {/* ---- Entrega ou retirada ---------------------------- */}
                  {!isTable && (
                    <section className="space-y-2">
                      <SectionTitle>Como você quer receber?</SectionTitle>
                      <div className="grid grid-cols-2 gap-2">
                        {deliveryOn && (
                          <button
                            aria-pressed={isDelivery}
                            onClick={() => core.setOrderType("delivery")}
                            className={`rounded-2xl border p-3 text-left transition-all ${
                              isDelivery
                                ? "border-[hsl(var(--site-primary))] bg-[hsl(var(--site-primary)/0.08)] ring-1 ring-[hsl(var(--site-primary)/0.3)]"
                                : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))]"
                            }`}
                          >
                            <Bike
                              className="mb-1 h-5 w-5 text-[hsl(var(--site-primary))]"
                              aria-hidden="true"
                            />
                            <p className="font-black text-[hsl(var(--site-fg))]">Entrega</p>
                            <p className="text-xs text-[hsl(var(--site-muted-fg))]">na sua casa</p>
                          </button>
                        )}
                        {pickupOn && (
                          <button
                            aria-pressed={core.orderType === "pickup"}
                            onClick={() => core.setOrderType("pickup")}
                            className={`rounded-2xl border p-3 text-left transition-all ${
                              core.orderType === "pickup"
                                ? "border-[hsl(var(--site-primary))] bg-[hsl(var(--site-primary)/0.08)] ring-1 ring-[hsl(var(--site-primary)/0.3)]"
                                : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))]"
                            }`}
                          >
                            <Store
                              className="mb-1 h-5 w-5 text-[hsl(var(--site-primary))]"
                              aria-hidden="true"
                            />
                            <p className="font-black text-[hsl(var(--site-fg))]">Retirada</p>
                            <p className="text-xs text-[hsl(var(--site-muted-fg))]">
                              no estabelecimento
                            </p>
                          </button>
                        )}
                      </div>
                    </section>
                  )}

                  {isTable && tablesOn && (
                    <section className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--site-primary)/0.4)] bg-[hsl(var(--site-primary)/0.08)] p-3">
                      <Utensils
                        className="h-5 w-5 text-[hsl(var(--site-primary))]"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-black text-[hsl(var(--site-fg))]">
                          Mesa {core.tableNumber}
                        </p>
                        <p className="text-xs text-[hsl(var(--site-muted-fg))]">
                          Pedido lançado direto na comanda.
                        </p>
                      </div>
                    </section>
                  )}

                  {/* ---- Endereço --------------------------------------- */}
                  {isDelivery && (
                    <section className="space-y-2">
                      <SectionTitle>Endereço de entrega</SectionTitle>
                      <textarea
                        ref={core.addressRef}
                        value={core.address}
                        onChange={(e) => core.setAddress(e.target.value)}
                        rows={2}
                        placeholder="Rua, número, bairro e complemento"
                        className={`${inputClass} resize-none ${
                          core.validationAttempted && !core.address.trim() ? invalidClass : ""
                        }`}
                      />
                      {core.hasZones && (
                        <select
                          ref={core.zoneRef}
                          value={core.zoneId}
                          onChange={(e) => core.setZoneId(e.target.value)}
                          className={`${inputClass} ${
                            core.validationAttempted && !core.zoneId ? invalidClass : ""
                          }`}
                        >
                          <option value="">Selecione o bairro</option>
                          {deliveryZones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.neighborhood} — {formatBRL(Number(z.fee ?? 0))}
                            </option>
                          ))}
                        </select>
                      )}
                    </section>
                  )}

                  {/* ---- Dados do cliente ------------------------------- */}
                  <section className="space-y-2">
                    <SectionTitle>Seu nome</SectionTitle>
                    <input
                      ref={core.nameRef}
                      value={core.name}
                      onChange={(e) => core.setName(e.target.value)}
                      placeholder="Nome completo"
                      autoComplete="name"
                      className={`${inputClass} ${
                        core.validationAttempted && !core.name.trim() ? invalidClass : ""
                      }`}
                    />
                  </section>

                  <section className="space-y-2">
                    <SectionTitle>Seu WhatsApp</SectionTitle>
                    <input
                      ref={core.phoneRef}
                      value={core.phone}
                      onChange={(e) => core.setPhone(formatPhoneMask(e.target.value))}
                      placeholder="(00) 00000-0000"
                      inputMode="tel"
                      autoComplete="tel"
                      className={`${inputClass} ${
                        core.validationAttempted && !core.phone.trim() ? invalidClass : ""
                      }`}
                    />
                  </section>

                  {/* ---- Pagamento -------------------------------------- */}
                  <section className="space-y-2">
                    <SectionTitle>Forma de pagamento</SectionTitle>
                    <select
                      ref={core.paymentRef}
                      value={core.paymentMethod}
                      onChange={(e) => core.setPaymentMethod(e.target.value)}
                      className={`${inputClass} ${
                        core.validationAttempted && !core.paymentMethod ? invalidClass : ""
                      }`}
                    >
                      <option value="PIX">PIX (Mais rápido)</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Cartão de Débito">Cartão de Débito</option>
                      <option value="Dinheiro">Dinheiro</option>
                    </select>
                    {core.paymentMethod === "Dinheiro" && (
                      <input
                        ref={core.changeRef}
                        value={core.changeFor}
                        onChange={(e) => core.setChangeFor(e.target.value)}
                        placeholder="Troco para quanto?"
                        inputMode="numeric"
                        className={`${inputClass} ${
                          core.validationAttempted && !core.changeFor.trim() ? invalidClass : ""
                        }`}
                      />
                    )}
                  </section>

                  {/* ---- Observações ------------------------------------ */}
                  <section className="space-y-2">
                    <SectionTitle>Observações do pedido (opcional)</SectionTitle>
                    <textarea
                      value={core.notes}
                      onChange={(e) => core.setNotes(e.target.value)}
                      rows={2}
                      placeholder="Sem cebola, ponto da carne, troco…"
                      className={`${inputClass} resize-none`}
                    />
                  </section>

                  {/* ---- Aceite de ofertas ------------------------------
                       Não aparece em pedido de mesa: quem está sentado na
                       mesa não vira cliente de campanha de delivery. */}
                  {core.orderType !== "table" && (
                    <AceiteOfertas
                      nomeRestaurante={restaurant?.name}
                      marcado={core.aceitaOfertas}
                      aoMudar={core.setAceitaOfertas}
                      descontoPercent={core.descontoAceitePercent}
                    />
                  )}

                  {core.error && (
                    <p
                      role="alert"
                      className="rounded-xl border border-[hsl(var(--site-danger)/0.4)] bg-[hsl(var(--site-danger)/0.1)] p-3 text-sm font-bold text-[hsl(var(--site-danger))]"
                    >
                      {core.error}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé fixo: o total e o botão nunca somem da tela, mesmo com
                o cardápio longo ou o teclado do celular aberto. */}
            {core.items.length > 0 && (
              <div className="shrink-0 space-y-3 border-t border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-[hsl(var(--site-muted-fg))]">
                    <span>Subtotal</span>
                    <span className="font-bold text-[hsl(var(--site-fg))]">
                      {formatBRL(core.totalPrice)}
                    </span>
                  </div>
                  {isDelivery && (
                    <div className="flex justify-between text-[hsl(var(--site-muted-fg))]">
                      <span>Taxa de entrega</span>
                      <span className="font-bold text-[hsl(var(--site-fg))]">
                        {core.selectedZone ? formatBRL(core.deliveryFee) : "a combinar"}
                      </span>
                    </div>
                  )}
                  {/* Desconto por aceitar ofertas. Aparece só quando existe —
                      uma linha de "desconto: R$ 0,00" em todo pedido seria
                      barulho, e para quem tem desconto ela precisa estar
                      visível na conta, não escondida. */}
                  {core.descontoAceiteValor > 0 && (
                    <div className="flex justify-between text-[hsl(var(--site-primary))]">
                      <span className="font-bold">
                        Desconto ({core.descontoAceitePercent}% por aceitar ofertas)
                      </span>
                      <span className="font-bold">− {formatBRL(core.descontoAceiteValor)}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between border-t border-dashed border-[hsl(var(--site-border))] pt-2">
                    <span className="text-xs font-black uppercase tracking-widest text-[hsl(var(--site-muted-fg))]">
                      Total a pagar
                    </span>
                    <span className="text-2xl font-black text-[hsl(var(--site-secondary))]">
                      {formatBRL(core.grandTotal)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => void core.handleFinish()}
                  disabled={core.sending}
                  className="site-btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black uppercase tracking-widest disabled:opacity-70"
                >
                  {core.sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Finalizando pedido...
                    </>
                  ) : (
                    "Finalizar pedido"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

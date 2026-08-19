import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  HelpCircle,
  Loader2,
  Minus,
  Plus,
  Trash2,
  Truck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { ZcShell } from "@/components/zecarreto/ZcShell";
import { ZcMap } from "@/components/zecarreto/ZcMap";
import { ZcAddressField } from "@/components/zecarreto/ZcAddressField";
import { EMPTY_ADDRESS, type AddressValue } from "@/components/zecarreto/address-value";
import { ZcUpload } from "@/components/zecarreto/ZcUpload";
import { useZcSession } from "@/components/zecarreto/useZcSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { zcApi, zcErrorMessage } from "@/lib/zecarreto/client";
import { formatBRL } from "@/lib/zecarreto/domain/money";

export const Route = createFileRoute("/zecarreto/pedir")({ component: PedirPage });

interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  examples: string | null;
  max_weight_kg: number | null;
  max_volume_m3: number | null;
  max_helpers: number;
  sort_order: number;
}

interface Addon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  pricing_mode: "fixed" | "per_unit" | "per_floor" | "percent";
  amount_cents: number;
  percent: number;
  max_quantity: number;
  requires_quantity: boolean;
  category_id: string | null;
}

interface ItemPreset {
  code: string;
  name: string;
  group_name: string;
}

interface Catalog {
  categories: Category[];
  addons: Addon[];
  items: ItemPreset[];
  map: { tile_url: string; attribution: string; default_center: { lat: number; lng: number } };
  order: { max_stops: number; min_lead_minutes: number; max_lead_days: number };
}

interface QuoteLine {
  code: string;
  label: string;
  amountCents: number;
}

interface Quote {
  quoteId: string;
  totalCents: number;
  subtotalCents: number;
  surchargeCents: number;
  tollCents: number;
  serviceFeeCents: number;
  addonsCents: number;
  distanceMeters: number;
  durationSeconds: number;
  billableKm: number;
  minimumApplied: boolean;
  currency: string;
  lines: QuoteLine[];
  expiresAt: string;
}

interface Recommendation {
  categoryId: string | null;
  categoryName: string | null;
  suggestedHelpers: number;
  hasHeavyItems: boolean;
  reason: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

function PedirPage() {
  const navigate = useNavigate();
  const { session, loading } = useZcSession({ required: true });

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [categoryId, setCategoryId] = useState<string>("");
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);

  const [stops, setStops] = useState<AddressValue[]>([{ ...EMPTY_ADDRESS }, { ...EMPTY_ADDRESS }]);
  const [modality, setModality] = useState<"immediate" | "scheduled">("immediate");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const [helpers, setHelpers] = useState(0);
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!session) return;
    zcApi<Catalog>("/catalog")
      .then(setCatalog)
      .catch((error) => toast.error(zcErrorMessage(error)));
  }, [session]);

  const category = catalog?.categories.find((item) => item.id === categoryId) ?? null;

  const applicableAddons = useMemo(
    () =>
      (catalog?.addons ?? []).filter(
        (addon) => addon.category_id === null || addon.category_id === categoryId,
      ),
    [catalog, categoryId],
  );

  const mapPoints = useMemo(
    () =>
      stops
        .filter((stop) => stop.lat !== null && stop.lng !== null)
        .map((stop, index) => ({
          lat: stop.lat as number,
          lng: stop.lng as number,
          label: index === 0 ? "Retirada" : index === stops.length - 1 ? "Entrega" : "Parada",
        })),
    [stops],
  );

  const scheduledFor = useMemo(() => {
    if (modality !== "scheduled" || !date || !time) return undefined;
    // O horário digitado é o do RELÓGIO DA PESSOA. Convertemos para o
    // padrão universal aqui, para o servidor não precisar adivinhar fuso.
    const local = new Date(`${date}T${time}:00`);
    return Number.isNaN(local.getTime()) ? undefined : local.toISOString();
  }, [modality, date, time]);

  function buildPayload() {
    return {
      category_id: categoryId,
      modality,
      scheduled_for: scheduledFor,
      helpers_count: helpers,
      addons: Object.entries(addonQuantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([code, quantity]) => ({ code, quantity })),
      items: Object.entries(itemQuantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([code, quantity]) => ({ code, quantity })),
      stops: stops.map((stop, index) => ({
        kind: index === 0 ? "pickup" : index === stops.length - 1 ? "dropoff" : "stop",
        street: stop.street,
        number: stop.number || undefined,
        complement: stop.complement || undefined,
        district: stop.district || undefined,
        city: stop.city,
        state: stop.state,
        postal_code: stop.postal_code || undefined,
        reference: stop.reference || undefined,
        lat: stop.lat ?? undefined,
        lng: stop.lng ?? undefined,
        contact_name: stop.contact_name || undefined,
        contact_phone: stop.contact_phone || undefined,
        instructions: stop.instructions || undefined,
        floor_number: stop.floor_number ?? undefined,
        has_elevator: stop.has_elevator ?? undefined,
      })),
    };
  }

  async function pedirOrcamento() {
    setQuoting(true);
    try {
      const result = await zcApi<Quote>("/quotes", { method: "POST", body: buildPayload() });
      setQuote(result);
      setStep(5);
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setQuoting(false);
    }
  }

  async function confirmar() {
    if (!quote) return;
    setConfirming(true);
    try {
      const ride = await zcApi<{ id: string }>("/rides", {
        method: "POST",
        body: {
          ...buildPayload(),
          quote_id: quote.quoteId,
          items_description: description || undefined,
          notes: notes || undefined,
          cargo_photos: photos,
          idempotency_key: `${quote.quoteId}-confirm`,
        },
      });
      toast.success("Pedido criado!");
      navigate({ to: "/zecarreto/pedido/$rideId", params: { rideId: ride.id } });
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setConfirming(false);
    }
  }

  async function recomendar() {
    const selections = Object.entries(itemQuantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([code, quantity]) => ({ code, quantity }));
    if (!selections.length) {
      toast.error("Marque pelo menos um item.");
      return;
    }
    try {
      const result = await zcApi<Recommendation>("/recommend", {
        method: "POST",
        body: { items: selections },
      });
      setRecommendation(result);
      if (result.categoryId) setCategoryId(result.categoryId);
      if (result.suggestedHelpers > helpers) setHelpers(result.suggestedHelpers);
    } catch (error) {
      toast.error(zcErrorMessage(error));
    }
  }

  if (loading || !session || !catalog) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const podeAvancar =
    (step === 1 && !!categoryId) ||
    (step === 2 && stops.every((stop) => stop.street && stop.city && stop.state)) ||
    (step === 3 && (modality === "immediate" || !!scheduledFor)) ||
    step === 4;

  return (
    <ZcShell
      title={TITLES[step]}
      subtitle={SUBTITLES[step]}
      back={step === 1 ? { to: "/zecarreto", label: "Início" } : undefined}
      showSignOut={false}
    >
      <ol className="flex gap-1" aria-label="Etapas do pedido">
        {[1, 2, 3, 4, 5].map((n) => (
          <li
            key={n}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              n <= step ? "bg-amber-400" : "bg-neutral-200",
            )}
          />
        ))}
      </ol>

      {/* ---------------- 1. categoria ---------------- */}
      {step === 1 && (
        <div className="space-y-3">
          {catalog.categories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setCategoryId(item.id);
                setShowItemPicker(false);
              }}
              className={cn(
                "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition",
                categoryId === item.id
                  ? "border-amber-400 bg-amber-50"
                  : "border-neutral-200 bg-white hover:border-neutral-300",
              )}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
                <Truck className="h-5 w-5 text-neutral-600" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{item.name}</span>
                <span className="block text-sm text-neutral-600">{item.examples}</span>
                <span className="block text-xs text-neutral-500">
                  até {item.max_weight_kg ?? "—"} kg
                  {item.max_volume_m3 ? ` · ${item.max_volume_m3} m³` : ""}
                </span>
              </span>
              {categoryId === item.id && <Check className="h-5 w-5 text-amber-600" />}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowItemPicker((value) => !value)}
            className="flex w-full items-center gap-4 rounded-xl border border-dashed border-neutral-300 bg-white p-4 text-left hover:border-neutral-400"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
              <HelpCircle className="h-5 w-5 text-neutral-600" />
            </span>
            <span>
              <span className="block font-semibold">Não sei qual escolher</span>
              <span className="block text-sm text-neutral-600">
                Marque o que vai levar e a gente sugere.
              </span>
            </span>
          </button>

          {showItemPicker && (
            <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
              {agrupar(catalog.items).map(([group, items]) => (
                <div key={group}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {group}
                  </p>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <Counter
                        key={item.code}
                        label={item.name}
                        value={itemQuantities[item.code] ?? 0}
                        onChange={(value) =>
                          setItemQuantities({ ...itemQuantities, [item.code]: value })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
              <Button type="button" className="w-full" onClick={recomendar}>
                Ver o veículo indicado
              </Button>
              {recommendation && (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  {recommendation.reason}
                  <span className="mt-1 block text-xs">
                    Você pode trocar a categoria acima se preferir.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------------- 2. endereços ---------------- */}
      {step === 2 && (
        <div className="space-y-4">
          {mapPoints.length > 0 && (
            <ZcMap
              points={mapPoints}
              center={catalog.map.default_center}
              tileUrl={catalog.map.tile_url}
              attribution={catalog.map.attribution}
            />
          )}

          {stops.map((stop, index) => (
            <div key={index} className="space-y-2">
              <ZcAddressField
                title={
                  index === 0
                    ? "Onde retirar"
                    : index === stops.length - 1
                      ? "Onde entregar"
                      : `Parada ${index}`
                }
                value={stop}
                onChange={(value) =>
                  setStops(stops.map((current, i) => (i === index ? value : current)))
                }
              />
              {index !== 0 && index !== stops.length - 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStops(stops.filter((_, i) => i !== index))}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Remover parada
                </Button>
              )}
            </div>
          ))}

          {stops.length < catalog.order.max_stops && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                setStops([...stops.slice(0, -1), { ...EMPTY_ADDRESS }, stops[stops.length - 1]])
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Adicionar parada no meio do caminho
            </Button>
          )}
        </div>
      )}

      {/* ---------------- 3. quando ---------------- */}
      {step === 3 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setModality("immediate")}
            className={cn(
              "flex w-full items-center gap-4 rounded-xl border p-4 text-left",
              modality === "immediate"
                ? "border-amber-400 bg-amber-50"
                : "border-neutral-200 bg-white",
            )}
          >
            <Zap className="h-5 w-5 text-amber-600" />
            <span>
              <span className="block font-semibold">Agora (imediato)</span>
              <span className="block text-sm text-neutral-600">
                Procuramos um carreteiro assim que você confirmar. Custa 35% a mais.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setModality("scheduled")}
            className={cn(
              "flex w-full items-center gap-4 rounded-xl border p-4 text-left",
              modality === "scheduled"
                ? "border-amber-400 bg-amber-50"
                : "border-neutral-200 bg-white",
            )}
          >
            <CalendarClock className="h-5 w-5 text-neutral-600" />
            <span>
              <span className="block font-semibold">Agendar</span>
              <span className="block text-sm text-neutral-600">
                Você escolhe o dia e a hora. Sai pela tarifa normal.
              </span>
            </span>
          </button>

          {modality === "scheduled" && (
            <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="data">Dia</Label>
                <Input
                  id="data"
                  type="date"
                  value={date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hora">Hora</Label>
                <Input
                  id="hora"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </div>
              <p className="text-xs text-neutral-500 sm:col-span-2">
                Agende com pelo menos {catalog.order.min_lead_minutes} minutos de antecedência, e no
                máximo {catalog.order.max_lead_days} dias à frente.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---------------- 4. detalhes ---------------- */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
            <p className="font-semibold">O que vai ser transportado</p>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ex.: uma geladeira, um sofá de 3 lugares e umas 10 caixas"
              rows={3}
            />
            <div className="space-y-1.5">
              <Label>Observações para o carreteiro</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Portaria fecha às 18h, rua estreita, cachorro no quintal..."
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
            <p className="font-semibold">Fotos dos objetos</p>
            <p className="text-sm text-neutral-600">
              Ajuda o carreteiro a saber o que esperar e evita surpresa na hora.
            </p>
            <ZcUpload
              label={`Fotos (${photos.length} enviada${photos.length === 1 ? "" : "s"})`}
              bucket="zc-avatars"
              purpose="carga"
              accept="image/jpeg,image/png,image/webp,image/heic"
              done={photos.length > 0}
              onUploaded={(result) => setPhotos([...photos, result.publicUrl ?? result.path])}
            />
            {photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {photos.map((photo) => (
                  <img
                    key={photo}
                    src={photo}
                    alt="Objeto a transportar"
                    className="h-20 w-28 shrink-0 rounded-lg object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
            <p className="font-semibold">Ajudantes</p>
            <p className="text-sm text-neutral-600">
              O carreteiro dirige e ajuda no básico. Peça ajudantes para carga pesada ou muitos
              volumes.
            </p>
            <Counter
              label="Quantos ajudantes"
              value={helpers}
              max={category?.max_helpers ?? 3}
              onChange={setHelpers}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
            <p className="font-semibold">Adicionais</p>
            {applicableAddons.map((addon) => (
              <div key={addon.code} className="border-b border-neutral-100 pb-3 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{addon.name}</p>
                    {addon.description && (
                      <p className="text-xs text-neutral-500">{addon.description}</p>
                    )}
                    <p className="mt-0.5 text-xs text-neutral-600">{precoDoAdicional(addon)}</p>
                  </div>
                  {addon.requires_quantity ? (
                    <Counter
                      label=""
                      compact
                      value={addonQuantities[addon.code] ?? 0}
                      max={addon.max_quantity}
                      onChange={(value) =>
                        setAddonQuantities({ ...addonQuantities, [addon.code]: value })
                      }
                    />
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant={addonQuantities[addon.code] ? "default" : "outline"}
                      onClick={() =>
                        setAddonQuantities({
                          ...addonQuantities,
                          [addon.code]: addonQuantities[addon.code] ? 0 : 1,
                        })
                      }
                    >
                      {addonQuantities[addon.code] ? "Incluído" : "Incluir"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- 5. revisão ---------------- */}
      {step === 5 && quote && (
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
            <Resumo label="Categoria" value={category?.name ?? "—"} />
            <Resumo
              label="Retirada"
              value={`${stops[0].street}${stops[0].number ? `, ${stops[0].number}` : ""} — ${stops[0].city}/${stops[0].state}`}
            />
            {stops.slice(1, -1).map((stop, index) => (
              <Resumo
                key={index}
                label={`Parada ${index + 1}`}
                value={`${stop.street} — ${stop.city}`}
              />
            ))}
            <Resumo
              label="Entrega"
              value={`${stops[stops.length - 1].street} — ${stops[stops.length - 1].city}/${stops[stops.length - 1].state}`}
            />
            <Resumo label="Distância" value={`${(quote.distanceMeters / 1000).toFixed(1)} km`} />
            <Resumo
              label="Horário"
              value={
                modality === "immediate"
                  ? "Agora"
                  : scheduledFor
                    ? new Date(scheduledFor).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—"
              }
            />
            <Resumo
              label="Modalidade"
              value={modality === "immediate" ? "Imediato (+35%)" : "Agendado (tarifa normal)"}
            />
            <Resumo label="Ajudantes" value={helpers === 0 ? "Nenhum" : String(helpers)} />
            <Resumo
              label="Adicionais"
              value={
                Object.entries(addonQuantities).filter(([, q]) => q > 0).length
                  ? Object.entries(addonQuantities)
                      .filter(([, q]) => q > 0)
                      .map(([code, q]) => {
                        const addon = applicableAddons.find((item) => item.code === code);
                        return q > 1 ? `${addon?.name} (${q}x)` : (addon?.name ?? code);
                      })
                      .join(", ")
                  : "Nenhum"
              }
            />
          </div>

          <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
            <p className="font-semibold">Como chegamos nesse valor</p>
            {quote.lines.map((line) => (
              <div key={line.code} className="flex justify-between text-sm">
                <span className="text-neutral-600">{line.label}</span>
                <span>{formatBRL(line.amountCents)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 text-lg font-bold">
              <span>Total</span>
              <span>{formatBRL(quote.totalCents)}</span>
            </div>
            <p className="text-xs text-neutral-500">
              Este preço fica guardado com o pedido: se a tabela mudar depois, o seu carreto
              continua valendo o que está aqui.
            </p>
          </div>

          <Button className="w-full" size="lg" disabled={confirming} onClick={confirmar}>
            {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar pedido
          </Button>
        </div>
      )}

      {/* ---------------- navegação ---------------- */}
      <div className="flex gap-2">
        {step > 1 && (
          <Button variant="outline" onClick={() => setStep((step - 1) as Step)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>
        )}
        {step < 4 && (
          <Button
            className="flex-1"
            disabled={!podeAvancar}
            onClick={() => setStep((step + 1) as Step)}
          >
            Continuar
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
        {step === 4 && (
          <Button className="flex-1" disabled={quoting} onClick={pedirOrcamento}>
            {quoting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ver o preço
          </Button>
        )}
      </div>
    </ZcShell>
  );
}

const TITLES: Record<Step, string> = {
  1: "O que você precisa transportar?",
  2: "De onde para onde?",
  3: "Quando?",
  4: "Detalhes do carreto",
  5: "Confira antes de confirmar",
};

const SUBTITLES: Record<Step, string> = {
  1: "Escolha o tamanho do veículo — ou peça ajuda para escolher.",
  2: "Retirada, paradas no meio do caminho e entrega.",
  3: "Agora mesmo ou marcado para depois.",
  4: "Quanto mais detalhe, menos surpresa na hora.",
  5: "O preço abaixo é o que você vai pagar.",
};

function Resumo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="shrink-0 text-neutral-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Counter({
  label,
  value,
  onChange,
  max = 20,
  compact = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", !compact && "justify-between")}>
      {label && <span className="text-sm">{label}</span>}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`Diminuir ${label}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-6 text-center text-sm font-semibold">{value}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`Aumentar ${label}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function agrupar(items: ItemPreset[]): [string, ItemPreset[]][] {
  const groups = new Map<string, ItemPreset[]>();
  for (const item of items) {
    const list = groups.get(item.group_name) ?? [];
    list.push(item);
    groups.set(item.group_name, list);
  }
  return [...groups.entries()];
}

function precoDoAdicional(addon: Addon): string {
  if (addon.pricing_mode === "percent") return `+${addon.percent}% sobre o valor`;
  const valor = formatBRL(addon.amount_cents);
  if (addon.pricing_mode === "per_floor") return `${valor} por andar`;
  if (addon.pricing_mode === "per_unit") return `${valor} por item`;
  return valor;
}

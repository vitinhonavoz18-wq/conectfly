import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Link as LinkIcon,
  MapPin,
  Pencil,
  Sparkles,
  Tag,
  Utensils,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { RestaurantRow, SiteData } from "@/lib/site/types";
import { fetchSiteByRestaurant } from "@/lib/site/queries";
import { InfoForm } from "@/components/editor/InfoForm";
import { MenuManager } from "@/components/editor/MenuManager";
import { ComboManager } from "@/components/editor/ComboManager";
import { DeliveryZonesManager } from "@/components/editor/DeliveryZonesManager";
import { DeliverySite } from "@/components/site/DeliverySite";

export const Route = createFileRoute("/edit/$id")({
  component: EditPage,
});

type Tab = "info" | "menu" | "combo" | "delivery" | "preview";

function EditPage() {
  const { id } = Route.useParams();
  const [restaurant, setRestaurant] = useState<RestaurantRow | null>(null);
  const [tab, setTab] = useState<Tab>("info");
  const [preview, setPreview] = useState<SiteData | null>(null);
  const [previewBust, setPreviewBust] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase
      .from("restaurants")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          setNotFound(true);
          return;
        }
        setRestaurant(data as unknown as RestaurantRow);
      });
  }, [id]);

  useEffect(() => {
    if (tab !== "preview" || !restaurant) return;
    fetchSiteByRestaurant(restaurant).then(setPreview);
  }, [tab, restaurant, previewBust]);

  const handleFinalize = async () => {
    if (!restaurant) return;
    setFinalizing(true);
    const { error } = await supabase
      .from("restaurants")
      .update({ published: true })
      .eq("id", restaurant.id);
    setFinalizing(false);
    if (error) return;
    setRestaurant({ ...restaurant, published: true });
    setFinalized(true);
  };

  const shareUrl =
    restaurant && typeof window !== "undefined"
      ? `${window.location.origin}/s/${restaurant.slug}`
      : "";

  const handleCopyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p>Restaurante não encontrado.</p>
        <Link to="/" className="text-primary underline">
          Voltar
        </Link>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "info", label: "Informações", icon: <FileText className="h-4 w-4" /> },
    { id: "menu", label: "Cardápio", icon: <Utensils className="h-4 w-4" /> },
    { id: "combo", label: "Combos", icon: <Tag className="h-4 w-4" /> },
    { id: "delivery", label: "Taxas de entrega", icon: <MapPin className="h-4 w-4" /> },
    { id: "preview", label: "Preview", icon: <Eye className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold truncate">{restaurant.name}</h1>
              <p className="text-xs text-muted-foreground truncate">
                /s/{restaurant.slug}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/s/$slug"
              params={{ slug: restaurant.slug }}
              target="_blank"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted text-sm"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir site
            </Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                if (t.id === "preview") setPreviewBust((n) => n + 1);
              }}
              className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-semibold text-sm whitespace-nowrap transition ${
                tab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {tab === "info" && (
          <InfoForm restaurant={restaurant} onChange={setRestaurant} />
        )}
        {tab === "menu" && <MenuManager restaurantId={restaurant.id} />}
        {tab === "combo" && <ComboManager restaurantId={restaurant.id} />}
        {tab === "delivery" && <DeliveryZonesManager restaurantId={restaurant.id} />}
        {tab === "preview" && (
          <div className="space-y-5">
            <div className="rounded-2xl overflow-hidden border border-border shadow-card">
              {preview ? (
                <div className="h-[70vh] overflow-y-auto bg-black">
                  <DeliverySite data={preview} />
                </div>
              ) : (
                <div className="h-[70vh] flex items-center justify-center text-muted-foreground">
                  Carregando preview...
                </div>
              )}
            </div>

            {!finalized && !restaurant.published ? (
              <div className="rounded-2xl border border-border bg-gradient-card p-6 shadow-card flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow flex-shrink-0">
                    <Sparkles className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-bold">Tudo pronto?</h3>
                    <p className="text-sm text-muted-foreground">
                      Finalize o projeto para publicar e liberar a exportação.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleFinalize}
                  disabled={finalizing}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-bold hover:opacity-90 transition shadow-glow disabled:opacity-50"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  {finalizing ? "Finalizando..." : "Finalizar projeto"}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-success/40 bg-success/10 p-6 shadow-card">
                <div className="flex items-start gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-success flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-success-foreground" />
                  </div>
                  <div>
                    <h3 className="font-bold">Projeto finalizado!</h3>
                    <p className="text-sm text-muted-foreground">
                      Seu site está publicado. Escolha o próximo passo:
                    </p>
                  </div>
                </div>
                <div className="mb-4 rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2 text-sm font-bold">
                    <LinkIcon className="h-4 w-4 text-primary" />
                    Link de preview para compartilhar com o cliente
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Envie este endereço para o cliente visualizar o site antes da
                    exportação ou conexão de domínio próprio.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      readOnly
                      value={shareUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-sm font-mono"
                    />
                    <button
                      onClick={handleCopyShare}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition text-sm"
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" /> Copiar link
                        </>
                      )}
                    </button>
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-muted transition text-sm font-semibold"
                    >
                      <ExternalLink className="h-4 w-4" /> Abrir
                    </a>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Link
                    to="/s/$slug"
                    params={{ slug: restaurant.slug }}
                    target="_blank"
                    className="flex flex-col items-start gap-2 p-4 rounded-xl border border-border bg-card hover:border-primary transition"
                  >
                    <ExternalLink className="h-5 w-5 text-primary" />
                    <span className="font-bold text-sm">Ver em nova aba</span>
                    <span className="text-xs text-muted-foreground">
                      Abre o site público
                    </span>
                  </Link>
                  <Link
                    to="/export/$id"
                    params={{ id: restaurant.id }}
                    className="flex flex-col items-start gap-2 p-4 rounded-xl border border-border bg-card hover:border-primary transition"
                  >
                    <Download className="h-5 w-5 text-primary" />
                    <span className="font-bold text-sm">Exportar projeto</span>
                    <span className="text-xs text-muted-foreground">
                      Baixar código-fonte (.zip)
                    </span>
                  </Link>
                  <button
                    onClick={() => setTab("info")}
                    className="flex flex-col items-start gap-2 p-4 rounded-xl border border-border bg-card hover:border-primary transition text-left"
                  >
                    <Pencil className="h-5 w-5 text-primary" />
                    <span className="font-bold text-sm">Continuar editando</span>
                    <span className="text-xs text-muted-foreground">
                      Voltar para as informações
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
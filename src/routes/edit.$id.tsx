import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Eye, FileText, Tag, Utensils } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { RestaurantRow, SiteData } from "@/lib/site/types";
import { fetchSiteByRestaurant } from "@/lib/site/queries";
import { InfoForm } from "@/components/editor/InfoForm";
import { MenuManager } from "@/components/editor/MenuManager";
import { ComboManager } from "@/components/editor/ComboManager";
import { DeliverySite } from "@/components/site/DeliverySite";

export const Route = createFileRoute("/edit/$id")({
  component: EditPage,
});

type Tab = "info" | "menu" | "combo" | "preview";

function EditPage() {
  const { id } = Route.useParams();
  const [restaurant, setRestaurant] = useState<RestaurantRow | null>(null);
  const [tab, setTab] = useState<Tab>("info");
  const [preview, setPreview] = useState<SiteData | null>(null);
  const [previewBust, setPreviewBust] = useState(0);
  const [notFound, setNotFound] = useState(false);

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
        {tab === "preview" && (
          <div className="rounded-2xl overflow-hidden border border-border shadow-card">
            {preview ? (
              <div className="h-[80vh] overflow-y-auto bg-black">
                <DeliverySite data={preview} />
              </div>
            ) : (
              <div className="h-[80vh] flex items-center justify-center text-muted-foreground">
                Carregando preview...
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
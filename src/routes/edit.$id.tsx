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
   Rocket,
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
     <div className="min-h-screen bg-background">
       <header className="border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
         <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
             <Link
               to="/"
               className="p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-muted-foreground transition-all"
               aria-label="Voltar"
             >
               <ArrowLeft className="h-5 w-5" />
             </Link>
             <div className="min-w-0 ml-1">
               <h1 className="font-black text-xl truncate tracking-tight">{restaurant.name}</h1>
               <p className="text-xs text-primary font-bold uppercase tracking-widest opacity-80">
                 Editor FlyControl
               </p>
             </div>
          </div>
           <div className="flex items-center gap-3">
             <Link
               to="/s/$slug"
               params={{ slug: restaurant.slug }}
               target="_blank"
               className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-sm font-bold transition-all"
             >
               <Eye className="h-4 w-4 text-secondary" /> 
               <span className="hidden sm:inline">Visualizar Site</span>
             </Link>
           </div>
        </div>
         <div className="max-w-7xl mx-auto px-6 flex gap-2 overflow-x-auto scrollbar-hide">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                if (t.id === "preview") setPreviewBust((n) => n + 1);
              }}
               className={`inline-flex items-center gap-2 px-5 py-4 border-b-2 font-bold text-sm whitespace-nowrap transition-all ${
                 tab === t.id
                   ? "border-primary text-primary glow-orange"
                   : "border-transparent text-muted-foreground hover:text-foreground hover:border-white/20"
               }`}
             >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </header>

       <main className="max-w-7xl mx-auto px-6 py-10">
        {tab === "info" && (
          <InfoForm restaurant={restaurant} onChange={setRestaurant} />
        )}
        {tab === "menu" && <MenuManager restaurantId={restaurant.id} />}
        {tab === "combo" && <ComboManager restaurantId={restaurant.id} />}
        {tab === "delivery" && <DeliveryZonesManager restaurantId={restaurant.id} />}
         {tab === "preview" && (
           <div className="space-y-8 site-hero-enter">
             <div className="rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl bg-black/40 backdrop-blur-md">
               <div className="p-4 bg-white/5 border-b border-white/5 flex items-center gap-2">
                 <div className="flex gap-1.5">
                   <div className="w-3 h-3 rounded-full bg-red-500/50" />
                   <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                   <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
                 </div>
                 <div className="flex-1 bg-black/40 rounded-lg px-3 py-1 text-[10px] text-muted-foreground text-center font-mono truncate">
                   {shareUrl}
                 </div>
               </div>
               {preview ? (
                 <div className="h-[75vh] overflow-y-auto bg-black scrollbar-hide">
                   <DeliverySite data={preview} />
                 </div>
               ) : (
                 <div className="h-[75vh] flex items-center justify-center text-muted-foreground font-medium animate-pulse">
                   Preparando sua decolagem...
                 </div>
               )}
             </div>
 
             {!finalized && !restaurant.published ? (
               <div className="card-premium p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between border-primary/20 bg-primary/5">
                 <div className="flex items-start gap-4">
                   <div className="h-14 w-14 rounded-2xl bg-gradient-fire flex items-center justify-center shadow-glow flex-shrink-0 animate-bounce">
                     <Rocket className="h-7 w-7 text-primary-foreground glow-orange" />
                   </div>
                   <div>
                     <h3 className="text-2xl font-black tracking-tight">Pronto para o Sucesso?</h3>
                     <p className="text-muted-foreground text-lg">
                       Publique agora e comece a receber pedidos profissionais.
                     </p>
                   </div>
                 </div>
                 <button
                   onClick={handleFinalize}
                   disabled={finalizing}
                   className="btn-fire px-10 py-4 rounded-2xl text-lg flex items-center gap-3 disabled:opacity-50 disabled:scale-100"
                 >
                   <CheckCircle2 className="h-6 w-6" />
                   {finalizing ? "Publicando..." : "Publicar Meu Site"}
                 </button>
               </div>
             ) : (
               <div className="card-premium p-8 border-emerald-500/30 bg-emerald-500/5 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                   <Rocket className="h-32 w-32 text-emerald-500" />
                 </div>
                 <div className="relative z-10">
                   <div className="flex items-start gap-4 mb-8">
                     <div className="h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_oklch(0.7_0.2_160_/_0.4)]">
                       <CheckCircle2 className="h-8 w-8 text-white" />
                     </div>
                     <div>
                       <h3 className="text-3xl font-black tracking-tight">Site ao Vivo!</h3>
                       <p className="text-muted-foreground text-lg">
                         Sua pizzaria agora tem presença digital de elite.
                       </p>
                     </div>
                   </div>
 
                   <div className="mb-8 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
                     <div className="flex items-center gap-2 mb-3 text-sm font-black uppercase tracking-widest text-primary">
                       <LinkIcon className="h-4 w-4" />
                       Link da sua vitrine
                     </div>
                     <div className="flex flex-col sm:flex-row gap-3">
                       <input
                         readOnly
                         value={shareUrl}
                         onFocus={(e) => e.currentTarget.select()}
                         className="flex-1 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-mono text-emerald-400"
                       />
                       <button
                         onClick={handleCopyShare}
                         className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-black hover:opacity-90 transition-all shadow-glow"
                       >
                         {copied ? (
                           <>
                             <CheckCircle2 className="h-5 w-5" /> Copiado!
                           </>
                         ) : (
                           <>
                             <Copy className="h-5 w-5" /> Copiar Link
                           </>
                         )}
                       </button>
                     </div>
                   </div>
 
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     <Link
                       to="/s/$slug"
                       params={{ slug: restaurant.slug }}
                       target="_blank"
                       className="flex flex-col items-start gap-3 p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/50 hover:bg-white/10 transition-all group/item"
                     >
                       <ExternalLink className="h-6 w-6 text-primary group-hover/item:scale-110 transition-transform" />
                       <div>
                         <div className="font-black text-lg">Abrir Site</div>
                         <div className="text-sm text-muted-foreground">Ver versão pública</div>
                       </div>
                     </Link>
                     <Link
                       to="/export/$id"
                       params={{ id: restaurant.id }}
                       className="flex flex-col items-start gap-3 p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/50 hover:bg-white/10 transition-all group/item"
                     >
                       <Download className="h-6 w-6 text-primary group-hover/item:scale-110 transition-transform" />
                       <div>
                         <div className="font-black text-lg">Exportar ZIP</div>
                         <div className="text-sm text-muted-foreground">Código-fonte completo</div>
                       </div>
                     </Link>
                     <button
                       onClick={() => setTab("info")}
                       className="flex flex-col items-start gap-3 p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/50 hover:bg-white/10 transition-all group/item text-left w-full"
                     >
                       <Pencil className="h-6 w-6 text-primary group-hover/item:scale-110 transition-transform" />
                       <div>
                         <div className="font-black text-lg">Continuar</div>
                         <div className="text-sm text-muted-foreground">Fazer novos ajustes</div>
                       </div>
                     </button>
                   </div>
                 </div>
               </div>
             )}
           </div>
         )}
      </main>
    </div>
  );
}
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
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
  LogOut,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { RestaurantRow, SiteData } from "@/lib/site/types";
import { fetchSiteByRestaurant, getRestaurantById, updateRestaurant, adminFetchSiteData } from "@/lib/site/queries";
 import { useAuth } from "@/hooks/useAuth";
import { getPizzeriaPublicUrl } from "@/lib/site/format";
import { InfoForm } from "@/components/editor/InfoForm";
import { MenuManager } from "@/components/editor/MenuManager";
import { ComboManager } from "@/components/editor/ComboManager";
import { DeliveryZonesManager } from "@/components/editor/DeliveryZonesManager";
import { DeliverySite } from "@/components/site/DeliverySite";
import { toast } from "sonner";
import { BrandLogo } from "@/components/admin/BrandLogo";

export const Route = createFileRoute("/_authenticated/edit/$id")({
  component: EditPage,
});

type Tab = "info" | "appearance" | "menu" | "combo" | "delivery" | "checkout" | "operations" | "seo" | "preview";

function EditPage() {
   const { id } = Route.useParams();
   const router = useRouter();
   const { signOut } = useAuth();
  const [restaurant, setRestaurant] = useState<RestaurantRow | null>(null);
  const [tab, setTab] = useState<Tab>("info");
  const [preview, setPreview] = useState<SiteData | null>(null);
  const [previewBust, setPreviewBust] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.log(`[Edit] Iniciando carregamento do restaurante: ${id} | isAdminRoute: true | adminSessionValid: true`);
    
    getRestaurantById(id)
      .then((data) => {
        console.log(`[Edit] Dados carregados com sucesso: ${data.name}`);
        setRestaurant(data);
      })
      .catch((err) => {
        console.error(`[Edit] Falha ao carregar restaurante ${id}:`, err);
        const errorMessage = String(err.message || err);
        setError(errorMessage);
        
        if (errorMessage.includes("não encontrado")) {
          setNotFound(true);
        } else if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
          toast.error("Erro de permissão. Verifique sua sessão.");
        } else if (errorMessage.includes("invalid input syntax for type uuid")) {
          toast.error("ID inválido");
        } else {
          toast.error(`Falha ao carregar: ${errorMessage}`);
        }
      });
  }, [id]);

  useEffect(() => {
    if (tab !== "preview" || !restaurant) return;
    console.log(`[Edit] Atualizando preview via backend seguro...`);
    adminFetchSiteData(restaurant.id).then(setPreview).catch(err => {
      console.error("[Edit] Erro ao carregar preview:", err);
      toast.error("Falha ao gerar preview do site.");
    });
  }, [tab, restaurant, previewBust]);

  const handleFinalize = async () => {
    if (!restaurant) return;
    setFinalizing(true);
    try {
      await updateRestaurant(restaurant.id, { published: true });
      setRestaurant({ ...restaurant, published: true });
      setFinalized(true);
      toast.success("Vitrine inaugurada com sucesso!");
    } catch (err) {
      console.error("[Edit] Erro ao inaugurar:", err);
      toast.error("Falha ao inaugurar vitrine.");
    } finally {
      setFinalizing(false);
    }
  };

  const shareUrl = restaurant ? getPizzeriaPublicUrl(restaurant.slug, restaurant.custom_subdomain) : "";

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

  if (notFound || error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="bg-destructive/10 p-6 rounded-2xl border border-destructive/20 max-w-md">
          <h2 className="text-xl font-bold text-destructive mb-2 uppercase tracking-tight">
            {notFound ? "Restaurante não encontrado" : "Erro no Carregamento"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {error || "O restaurante solicitado não existe ou você não tem permissão para acessá-lo."}
          </p>
          <Link 
            to="/" 
            className="btn-premium px-8 py-3 rounded-xl inline-flex items-center gap-2 uppercase text-xs tracking-widest"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Painel
          </Link>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="uppercase tracking-[0.3em] text-[10px] font-black animate-pulse">
          Sincronizando Dados...
        </span>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "info", label: "Estabelecimento", icon: <FileText className="h-4 w-4" /> },
    { id: "appearance", label: "Personalização", icon: <Sparkles className="h-4 w-4" /> },
    { id: "menu", label: "Cardápio", icon: <Utensils className="h-4 w-4" /> },
    { id: "beverages" as any, label: "Bebidas", icon: <ShoppingBag className="h-4 w-4" /> },
    { id: "combo", label: "Combos", icon: <Tag className="h-4 w-4" /> },
    { id: "delivery", label: "Entrega", icon: <MapPin className="h-4 w-4" /> },
    { id: "checkout", label: "Checkout", icon: <CheckCircle2 className="h-4 w-4" /> },
    { id: "operations", label: "Funcionamento", icon: <Rocket className="h-4 w-4" /> },
    { id: "seo", label: "SEO", icon: <LinkIcon className="h-4 w-4" /> },
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
             <Link to="/" className="hidden md:flex items-center pr-3 border-r border-white/10 mr-1" aria-label="SiteCreatorFly">
               <BrandLogo size="sm" glow={false} />
             </Link>
             <div className="min-w-0 ml-1">
               <h1 className="font-black text-2xl truncate tracking-tight text-foreground uppercase">{restaurant.name}</h1>
                <p className="text-xs text-primary font-black uppercase tracking-[0.3em] opacity-80">
                  {restaurant.business_type || "Delivery Premium"}
                </p>
             </div>
          </div>
            <div className="flex items-center gap-3">
               <Link
                 to="/$slug"
                  params={{ slug: restaurant.slug }}
                  href={shareUrl}
                 target="_blank"
                 className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-sm font-bold transition-all"
               >
                <Eye className="h-4 w-4 text-secondary" /> 
                <span className="hidden sm:inline">Visualizar Site</span>
              </Link>
              <button
                onClick={() => signOut()}
                className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-bold flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                 <span className="hidden sm:inline text-xs uppercase tracking-widest">Sair</span>
               </button>
               <button
                 onClick={() => {
                   navigator.clipboard.writeText(getPizzeriaPublicUrl(restaurant.slug, restaurant.custom_subdomain));
                   toast.success("Link copiado!");
                 }}
                 className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-primary transition-all"
                 title="Copiar link público"
               >
                 <Copy className="h-4 w-4" />
               </button>
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
                   ? "border-primary text-primary glow-bronze"
                   : "border-transparent text-muted-foreground hover:text-foreground hover:border-white/10"
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
        {tab === "appearance" && (
          <div className="card-premium p-8 border-primary/20 bg-primary/5 text-center">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-black uppercase tracking-widest mb-2">Personalização Visual</h3>
            <p className="text-muted-foreground">Em breve: Controle total sobre logos, cores, banners e layouts do seu site delivery.</p>
          </div>
        )}
        {tab === "menu" && (
          <div className="space-y-6">
            <div className="card-premium p-6 border-primary/20 bg-primary/5 flex items-start gap-4">
              <Sparkles className="h-6 w-6 text-primary flex-shrink-0" />
              <div>
                <h4 className="font-black uppercase text-sm tracking-widest">Gestão de Cardápio</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  A edição detalhada de preços e itens deve ser realizada através do painel <strong>FlyControl</strong>. 
                  As alterações feitas aqui são aplicadas imediatamente ao site.
                </p>
              </div>
            </div>
            <MenuManager restaurantId={restaurant.id} />
          </div>
        )}
        {tab === ("beverages" as any) && (
          <div className="space-y-6">
            <div className="card-premium p-6 border-primary/20 bg-primary/5 flex items-start gap-4">
              <ShoppingBag className="h-6 w-6 text-primary flex-shrink-0" />
              <div>
                <h4 className="font-black uppercase text-sm tracking-widest">Catálogo de Bebidas</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerencie o catálogo de bebidas do seu estabelecimento. Adicione itens manualmente ou importe via JSON para ganhar tempo.
                </p>
              </div>
            </div>
            <div className="card-premium p-8">
              <import { BeverageManager } from "@/components/editor/BeverageManager"; />
              <BeverageManager restaurantId={restaurant.id} />
            </div>
          </div>
        )}
        {tab === "combo" && (
          <div className="space-y-6">
            <div className="card-premium p-6 border-primary/20 bg-primary/5 flex items-start gap-4">
              <Tag className="h-6 w-6 text-primary flex-shrink-0" />
              <div>
                <h4 className="font-black uppercase text-sm tracking-widest">Gestão de Combos</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie e edite combos promocionais. Sincronize com o <strong>FlyControl</strong> para uma gestão integrada.
                </p>
              </div>
            </div>
            <ComboManager restaurantId={restaurant.id} />
          </div>
        )}
        {tab === "delivery" && <DeliveryZonesManager restaurantId={restaurant.id} />}
        {tab === "checkout" && (
          <div className="card-premium p-8 border-emerald-500/20 bg-emerald-500/5 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-xl font-black uppercase tracking-widest mb-2">Configurações de Checkout</h3>
            <p className="text-muted-foreground">Em breve: Personalize taxas, formas de pagamento e mensagens de WhatsApp.</p>
          </div>
        )}
        {tab === "operations" && (
          <div className="card-premium p-8 border-amber-500/20 bg-amber-500/5 text-center">
            <Rocket className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-xl font-black uppercase tracking-widest mb-2">Horários e Funcionamento</h3>
            <p className="text-muted-foreground">Em breve: Gestão automatizada de horários de abertura e fechamento.</p>
          </div>
        )}
        {tab === "seo" && (
          <div className="card-premium p-8 border-blue-500/20 bg-blue-500/5 text-center">
            <LinkIcon className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-black uppercase tracking-widest mb-2">SEO e Marketing</h3>
            <p className="text-muted-foreground">Em breve: Configure como seu site aparece no Google e redes sociais.</p>
          </div>
        )}
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
                   <div className="h-16 w-16 rounded-2xl bg-gradient-bronze flex items-center justify-center shadow-glow flex-shrink-0 animate-bounce">
                     <Rocket className="h-8 w-8 text-primary-foreground glow-bronze" />
                   </div>
                   <div>
                     <h3 className="text-3xl font-black tracking-tighter uppercase">Pronto para a Inauguração?</h3>
                     <p className="text-muted-foreground text-lg italic">
                       Sua cozinha digital está pronta para receber os primeiros clientes.
                     </p>
                   </div>
                 </div>
                 <button
                   onClick={handleFinalize}
                   disabled={finalizing}
                   className="btn-premium px-12 py-4 rounded-2xl text-lg flex items-center gap-3 disabled:opacity-50 disabled:scale-100 uppercase tracking-widest shadow-2xl"
                 >
                   <CheckCircle2 className="h-6 w-6 text-primary-foreground" />
                   {finalizing ? "Inaugurando..." : "Inaugurar Vitrine"}
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
                          Sua vitrine agora tem presença digital de elite.
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
                         className="btn-premium px-8 py-3 rounded-xl flex items-center gap-2 uppercase text-xs tracking-widest shadow-xl"
                       >
                         {copied ? (
                           <>
                             <CheckCircle2 className="h-5 w-5 text-primary-foreground" /> Copiado
                           </>
                         ) : (
                           <>
                             <Copy className="h-5 w-5 text-primary-foreground" /> Copiar Link
                           </>
                         )}
                       </button>
                     </div>
                   </div>
 
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     <Link
                        to="/$slug"
                        params={{ slug: restaurant.slug }}
                        href={shareUrl}
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
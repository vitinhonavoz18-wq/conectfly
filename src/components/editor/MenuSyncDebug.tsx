import { useState } from "react";
import { FileJson, Loader2, X, Check, Copy, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  restaurantId: string;
}

export function MenuSyncDebug({ restaurantId }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchDebugInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get restaurant info
      const { data: restaurant, error: resError } = await supabase
        .from("restaurants")
        .select("slug, menu_sync_token")
        .eq("id", restaurantId)
        .maybeSingle();

      if (resError || !restaurant) throw new Error("Restaurante não encontrado");

      const slug = restaurant.slug;
      const token = restaurant.menu_sync_token;

      if (!token) throw new Error("Token de sincronização não configurado");

      // Call the sync endpoint
      // We use the absolute URL to ensure we hit the edge function correctly
      const baseUrl = window.location.origin.includes('localhost') 
        ? 'https://conectfly.com.br' // Use production for sync testing
        : window.location.origin;
      
      const syncUrl = `${baseUrl}/api/public/menu-sync/${slug}/${token}`;
      
      const response = await fetch(syncUrl);
      const json = await response.json();

      setData({
        url: syncUrl,
        slug,
        restaurant_id: restaurantId,
        token: token.substring(0, 8) + "...",
        response: json
      });
    } catch (err: any) {
      console.error("[MenuSyncDebug] Error:", err);
      setError(err.message || "Erro desconhecido ao carregar JSON.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data.response, null, 2));
    setCopied(true);
    toast.success("JSON copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button 
          onClick={fetchDebugInfo}
          className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-2 text-xs uppercase tracking-widest font-bold"
          title="Visualizar JSON de sincronização"
        >
          <FileJson className="h-4 w-4" />
          <span>Sync JSON</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-zinc-950 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <FileJson className="h-6 w-6" />
            Depuração de Sincronização
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
              Carregando dados reais do endpoint...
            </p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-4 text-destructive">
            <AlertCircle className="h-12 w-12" />
            <p className="font-bold uppercase tracking-widest">{error}</p>
            <button 
              onClick={fetchDebugInfo}
              className="px-6 py-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 text-xs font-bold uppercase tracking-widest transition-all"
            >
              Tentar novamente
            </button>
          </div>
        ) : data ? (
          <div className="flex-1 overflow-hidden flex flex-col gap-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Slug</span>
                <span className="text-sm font-bold text-white">{data.slug}</span>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Categorias</span>
                <span className="text-sm font-bold text-primary">{data.response?.menu?.categories?.length || 0}</span>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Produtos</span>
                <span className="text-sm font-bold text-primary">{data.response?.menu?.products?.length || 0}</span>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Sabores (Pizzas)</span>
                <span className="text-sm font-bold text-primary">{data.response?.menu?.flavors?.length || 0}</span>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Bebidas</span>
                <span className="text-sm font-bold text-primary">{data.response?.menu?.drinks?.length || 0}</span>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Itens Normalizados</span>
                <span className="text-sm font-bold text-emerald-400">{data.response?.menu?.normalized_products?.length || 0}</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 bg-black/50 rounded-2xl border border-white/5 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Preview JSON</span>
                <button 
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:text-white transition-colors"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copiado!" : "Copiar JSON"}
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-zinc-300 custom-scrollbar">
                <pre>{JSON.stringify(data.response, null, 2)}</pre>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
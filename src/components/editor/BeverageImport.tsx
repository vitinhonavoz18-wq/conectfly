import { useState } from "react";
import { Upload, X, Check, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL } from "@/lib/site/format";

interface Props {
  restaurantId: string;
  onImportComplete: () => void;
  onClose: () => void;
}

export function BeverageImport({ restaurantId, onImportComplete, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    withPrice: 0,
    withoutPrice: 0,
    categories: [] as string[]
  });
  const [defaultCategory, setDefaultCategory] = useState("Bebidas");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      parseFile(f);
    }
  };

  const parseFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        
        // Find the list of items
        const itemKeys = ["bebidas", "drinks", "refrigerantes", "items", "produtos", "products", "menu_items", "sabores"];
        let list: any[] = [];
        
        if (Array.isArray(json)) {
          list = json;
        } else {
          for (const key of itemKeys) {
            if (Array.isArray(json[key])) {
              list = json[key];
              break;
            }
          }
        }

        if (list.length === 0 && !Array.isArray(json)) {
          // Fallback: search for any array
          for (const key in json) {
            if (Array.isArray(json[key])) {
              list = json[key];
              break;
            }
          }
        }

        const nameKeys = ["nome", "name", "produto", "product_name", "title", "bebida", "beverage"];
        const priceKeys = ["preco", "preço", "price", "valor", "value", "amount"];
        const catKeys = ["categoria", "category", "tipo", "type", "subtipo"];
        const descKeys = ["descricao", "descrição", "description", "desc"];

        const parsed = list.map(item => {
          let name = "";
          for (const k of nameKeys) if (item[k]) { name = String(item[k]); break; }
          
          let price = 0;
          let hasPrice = false;
          for (const k of priceKeys) {
            if (item[k] !== undefined && item[k] !== null) {
              price = parseFloat(String(item[k]).replace(',', '.'));
              hasPrice = true;
              break;
            }
          }

          let category = "";
          for (const k of catKeys) if (item[k]) { category = String(item[k]); break; }

          let description = "";
          for (const k of descKeys) if (item[k]) { description = String(item[k]); break; }

          return { name, price: isNaN(price) ? 0 : price, category, description, hasPrice };
        }).filter(it => it.name);

        const cats = Array.from(new Set(parsed.map(p => p.category).filter(Boolean)));

        setPreview(parsed);
        setStats({
          total: parsed.length,
          withPrice: parsed.filter(p => p.hasPrice).length,
          withoutPrice: parsed.filter(p => !p.hasPrice).length,
          categories: cats as string[]
        });

      } catch (err) {
        toast.error("Erro ao ler JSON. Verifique o formato do arquivo.");
      }
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!preview || preview.length === 0) return;
    setLoading(true);
    
    try {
      const { data: existing } = await supabase
        .from("pizzeria_beverages")
        .select("name")
        .eq("pizzeria_id", restaurantId);
      
      const existingNames = new Set((existing || []).map(b => b.name.toLowerCase()));
      
      const toInsert = preview
        .filter(p => !existingNames.has(p.name.toLowerCase()))
        .map((p, idx) => ({
          pizzeria_id: restaurantId,
          name: p.name,
          price: p.price,
          brand: p.category || defaultCategory,
          category: p.category || defaultCategory,
          description: p.description || null,
          is_active: true,
          sort_order: idx + (existing?.length || 0)
        }));

      if (toInsert.length === 0) {
        toast.info("Todas as bebidas já existem no sistema.");
        setLoading(false);
        onClose();
        return;
      }

      const { error } = await supabase.from("pizzeria_beverages").insert(toInsert);
      
      if (error) throw error;
      
      toast.success(`${toInsert.length} bebidas importadas com sucesso!`);
      onImportComplete();
      onClose();
    } catch (err: any) {
      toast.error("Erro na importação: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Importar Bebidas</h3>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Arquivo JSON</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {!preview ? (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/10 rounded-3xl bg-white/5 group hover:border-primary/50 transition-all">
              <Upload className="h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors mb-4" />
              <p className="text-sm font-bold text-muted-foreground mb-4">Arraste seu arquivo .json ou clique abaixo</p>
              <label className="btn-premium px-8 py-3 rounded-2xl cursor-pointer shadow-xl">
                Selecionar Arquivo
                <input type="file" accept=".json" hidden onChange={handleFileChange} />
              </label>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Total</p>
                  <p className="text-2xl font-black">{stats.total}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Com Preço</p>
                  <p className="text-2xl font-black text-emerald-400">{stats.withPrice}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Sem Preço</p>
                  <p className="text-2xl font-black text-amber-400">{stats.withoutPrice}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Categorias</p>
                  <p className="text-2xl font-black">{stats.categories.length}</p>
                </div>
              </div>

              {stats.withoutPrice > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p>Algumas bebidas estão sem preço e serão importadas como <strong>R$ 0,00</strong>.</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Categoria Padrão</label>
                <input
                  value={defaultCategory}
                  onChange={(e) => setDefaultCategory(e.target.value)}
                  className="input bg-white/5 border-white/10"
                  placeholder="Ex: Bebidas"
                />
              </div>

              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Prévia dos Itens</p>
                <div className="grid gap-2">
                  {preview.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 text-sm">
                      <span className="font-bold truncate max-w-[200px]">{p.name}</span>
                      <span className="font-black text-primary">{formatBRL(p.price)}</span>
                    </div>
                  ))}
                  {preview.length > 5 && (
                    <p className="text-center text-xs text-muted-foreground font-bold py-2">
                      e mais {preview.length - 5} itens...
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/5 flex items-center justify-end gap-3 bg-black/20">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all"
          >
            Cancelar
          </button>
          {preview && (
            <button
              onClick={handleImport}
              disabled={loading}
              className="btn-premium px-8 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-xl disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirmar Importação
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

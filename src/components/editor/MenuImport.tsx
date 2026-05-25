import { useState, useRef } from "react";
import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2, X, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { PizzaSize } from "@/lib/site/types";

interface Props {
  restaurantId: string;
  onSuccess: () => void;
}

type CategoryType = "PIZZA" | "SIMPLE" | "FLAVORS" | "BEVERAGE" | "SIDE" | "ADDITIONAL" | "COMBOS" | "OTHER";

interface ImportData {
  pizzaria?: string;
  tipo_cardapio?: string;
  categoria?: string;
  category?: string;
  type?: string;
  tamanhos?: Array<{
    nome: string;
    preco: number;
    fatias: number;
    max_sabores: number;
  }>;
  bordas_recheadas?: Array<{ nome: string; acrescimo: number }>;
  sabores?: any[];
  items?: any[];
  produtos?: any[];
  products?: any[];
  menu_items?: any[];
}
 
export function MenuImport({ restaurantId, onSuccess }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Novos campos editáveis
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<CategoryType>("SIMPLE");
  const [importAction, setImportAction] = useState<"ADD" | "REPLACE" | "NEW">("ADD");
  const [showOnPublic, setShowOnPublic] = useState(true);
  const [showDirectly, setShowDirectly] = useState(true);
  const [allowCart, setAllowCart] = useState(true);
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    withPrice: 0,
    withoutPrice: 0
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== "application/json") {
      toast.error("Por favor, selecione um arquivo JSON válido.");
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        console.log("JSON Carregado:", json);
        validateData(json);
      } catch (err) {
        setError("O arquivo JSON é inválido ou está malformado.");
        setData(null);
      }
    };
    reader.readAsText(selectedFile);
  };

  const getPrice = (item: any): number => {
    const priceFields = ["preco", "preço", "price", "valor", "value", "amount"];
    for (const field of priceFields) {
      if (typeof item[field] === "number") return item[field];
      if (typeof item[field] === "string") {
        const val = parseFloat(item[field].replace("R$", "").replace(",", ".").trim());
        if (!isNaN(val)) return val;
      }
    }
    return 0;
  };

  const getItemName = (item: any): string => {
    const nameFields = ["nome", "name", "sabor", "title", "produto", "product_name"];
    for (const field of nameFields) {
      if (item[field]) return String(item[field]);
    }
    return "Sem nome";
  };

  const getItemCode = (item: any): string => {
    const codeFields = ["codigo", "código", "code", "sku", "id"];
    for (const field of codeFields) {
      if (item[field]) return String(item[field]);
    }
    return "";
  };

  const validateData = (json: any) => {
    const listFields = ["sabores", "items", "produtos", "products", "bebidas", "drinks", "menu_items"];
    let foundItems: any[] = [];
    let listFieldUsed = "";

    for (const field of listFields) {
      if (json[field] && Array.isArray(json[field])) {
        foundItems = json[field];
        listFieldUsed = field;
        break;
      }
    }

    if (foundItems.length === 0 && Array.isArray(json)) {
      foundItems = json;
    }

    if (foundItems.length === 0) {
      setError("Não encontramos uma lista de itens válida no JSON. Use campos como 'sabores', 'items' ou 'produtos'.");
      setData(null);
      return;
    }

    setError(null);
    setData(json);
    setItemsList(foundItems);

    // Detectar nome da categoria
    const detectedName = json.categoria || json.category || json.tipo || json.type || json.categoryName || json.tipo_cardapio || "Nova Categoria";
    setCategoryName(detectedName);

    // Detectar tipo
    const isPizza = !!(json.tamanhos || json.bordas_recheadas);
    setCategoryType(isPizza ? "PIZZA" : "SIMPLE");

    // Calcular estatísticas
    const withPrice = foundItems.filter(item => getPrice(item) > 0).length;
    setStats({
      total: foundItems.length,
      withPrice: withPrice,
      withoutPrice: foundItems.length - withPrice
    });

    console.log("Lista detectada:", listFieldUsed || "Array raiz");
    console.log("Categoria detectada:", detectedName);
    console.log("Itens com preço:", withPrice);
  };
 
  const handleImport = async () => {
    if (!data || !restaurantId) return;
    setLoading(true);

    try {
      const finalCategoryName = categoryName.trim() || "Nova Categoria";
      console.log(`[MenuImport] Iniciando importação para categoria: ${finalCategoryName} (${categoryType})`);
      
      const { data: existingCats } = await supabase.from("menu_categories").select("*").eq("restaurant_id", restaurantId);
      
      const foundCat = existingCats?.find(c => c.name.toUpperCase() === finalCategoryName.toUpperCase());
      let mainCat: any = foundCat;
      const pizzaSizes: PizzaSize[] = data.tamanhos?.map(t => ({ label: t.nome, price: t.preco, max_flavors: t.max_sabores })) || [];

      // Lógica de ação para categoria existente
      if (mainCat && importAction === "NEW") {
        mainCat = null; // Forçar criação de nova
      }

      if (!mainCat) {
        const { data: newCat, error: catErr } = await supabase.from("menu_categories").insert({
          restaurant_id: restaurantId,
          name: finalCategoryName,
          icon: categoryType === "PIZZA" ? "🍕" : "📦",
          is_pizza: categoryType === "PIZZA",
          pizza_sizes: categoryType === "PIZZA" ? pizzaSizes as any : null,
          sort_order: existingCats?.length || 0,
          show_on_public_site: showOnPublic,
          show_directly_in_menu: showDirectly,
          allow_cart_addition: allowCart,
          type: categoryType
        }).select().single();
        if (catErr) throw catErr;
        mainCat = newCat;
      } else {
        // Se for REPLACE, remover itens antigos
        if (importAction === "REPLACE") {
          await supabase.from("menu_items").delete().eq("category_id", mainCat.id);
        }
        
        // Atualizar tamanhos se for pizza e tiver novos tamanhos
        if (categoryType === "PIZZA" && pizzaSizes.length > 0) {
          await supabase.from("menu_categories").update({ 
            pizza_sizes: pizzaSizes as any,
            is_pizza: true 
          }).eq("id", mainCat.id);
        }
      }

      // 1.5 Processar Bordas (Se for Pizza)
      if (categoryType === "PIZZA" && data.bordas_recheadas && data.bordas_recheadas.length > 0) {
        let bordasCat = existingCats?.find(c => c.name.toUpperCase() === "BORDAS RECHEADAS");
        if (!bordasCat) {
          const { data: newBCat, error: bCatErr } = await supabase.from("menu_categories").insert({
            restaurant_id: restaurantId, name: "BORDAS RECHEADAS", icon: "🥖", is_pizza: false, sort_order: (existingCats?.length || 0) + 1
          }).select().single();
          if (!bCatErr) bordasCat = newBCat;
        }
        if (bordasCat) {
          const { data: exBordas } = await supabase.from("menu_items").select("*").eq("category_id", bordasCat.id);
          for (const borda of data.bordas_recheadas) {
            const exB = exBordas?.find(i => i.name.toUpperCase() === borda.nome.toUpperCase());
            if (exB) {
              await supabase.from("menu_items").update({ price: borda.acrescimo }).eq("id", exB.id);
            } else {
              await supabase.from("menu_items").insert({
                restaurant_id: restaurantId, category_id: bordasCat.id, name: borda.nome, price: borda.acrescimo, sort_order: exBordas?.length || 0
              });
            }
          }
        }
      }

      // 2. Processar Itens
      const { data: existingItems } = await supabase
        .from("menu_items")
        .select("*")
        .eq("category_id", mainCat.id);

      const sortedItems = [...itemsList].sort((a, b) => {
        const codeA = parseInt(getItemCode(a) || "0");
        const codeB = parseInt(getItemCode(b) || "0");
        return codeA - codeB;
      });

      for (let i = 0; i < sortedItems.length; i++) {
        const item = sortedItems[i];
        const itemName = getItemName(item);
        const itemCode = getItemCode(item);
        const itemPrice = getPrice(item);
        
        const existing = existingItems?.find(ex => 
          (itemCode && ex.name.includes(`[${itemCode}]`)) || 
          ex.name.toUpperCase() === itemName.toUpperCase()
        );

        const displayName = itemCode ? `[${itemCode}] ${itemName}` : itemName;
        
        // Descrição flexível
        let description = "";
        if (item.descricao || item.description || item.detalhes) {
          description = item.descricao || item.description || item.detalhes;
        } else if (item.ingredientes_ordem_preparo && Array.isArray(item.ingredientes_ordem_preparo)) {
          description = item.ingredientes_ordem_preparo.join(", ");
        }

        if (existing) {
          await supabase
            .from("menu_items")
            .update({
              name: displayName,
              description: description,
              price: categoryType === "PIZZA" ? 0 : itemPrice,
              sort_order: i,
            })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("menu_items")
            .insert({
              restaurant_id: restaurantId,
              category_id: mainCat.id,
              name: displayName,
              description: description,
              price: categoryType === "PIZZA" ? 0 : itemPrice,
              sort_order: i,
              is_special: false,
              special_extra: 0
            });
        }
      }

      toast.success("Cardápio importado com sucesso!");
      setIsOpen(false);
      onSuccess();
    } catch (err: any) {
      console.error("Erro na importação:", err);
      toast.error("Erro ao importar: " + err.message);
    } finally {
      setLoading(false);
    }
  };
 
  const reset = () => {
    setFile(null);
    setData(null);
    setError(null);
    setCategoryName("");
    setCategoryType("SIMPLE");
    setImportAction("ADD");
    setItemsList([]);
    setStats({ total: 0, withPrice: 0, withoutPrice: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-sm font-bold transition-all">
          <FileJson className="h-4 w-4 text-primary" />
          <span>Importar Cardápio</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] border-white/10 bg-zinc-950 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">Importar Cardápio JSON</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!data ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-all"
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-bold">Clique para anexar o arquivo .json</p>
                <p className="text-xs text-muted-foreground mt-1 text-zinc-400">Arraste e solte o arquivo aqui</p>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".json" 
                className="hidden" 
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Arquivo e Stats */}
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <FileJson className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-bold text-sm truncate max-w-[200px]">{file?.name}</p>
                    <p className="text-xs text-zinc-400">Detectado {stats.total} itens</p>
                  </div>
                </div>
                <button onClick={reset} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Campos de Configuração */}
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label className="text-xs uppercase font-bold text-zinc-500">Nome da Categoria</Label>
                  <Input 
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="Ex: Pizzas, Bebidas, Pastéis..."
                    className="bg-white/5 border-white/10 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-xs uppercase font-bold text-zinc-500">Tipo de Categoria</Label>
                    <Select value={categoryType} onValueChange={(v: any) => setCategoryType(v)}>
                      <SelectTrigger className="bg-white/5 border-white/10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        <SelectItem value="SIMPLE">Produto Simples</SelectItem>
                        <SelectItem value="FLAVORS">Produto com Sabores</SelectItem>
                        <SelectItem value="PIZZA">Pizza</SelectItem>
                        <SelectItem value="BEVERAGE">Bebida</SelectItem>
                        <SelectItem value="SIDE">Acompanhamento</SelectItem>
                        <SelectItem value="ADDITIONAL">Adicional</SelectItem>
                        <SelectItem value="COMBOS">Combo</SelectItem>
                        <SelectItem value="OTHER">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs uppercase font-bold text-zinc-500">Ação</Label>
                    <Select value={importAction} onValueChange={(v: any) => setImportAction(v)}>
                      <SelectTrigger className="bg-white/5 border-white/10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        <SelectItem value="ADD">Adicionar itens</SelectItem>
                        <SelectItem value="REPLACE">Substituir tudo</SelectItem>
                        <SelectItem value="NEW">Criar nova</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="showPublic" 
                      checked={showOnPublic} 
                      onChange={(e) => setShowOnPublic(e.target.checked)}
                      className="accent-primary h-4 w-4"
                    />
                    <Label htmlFor="showPublic" className="text-xs font-bold cursor-pointer">Exibir no site público</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="showDirect" 
                      checked={showDirectly} 
                      onChange={(e) => setShowDirectly(e.target.checked)}
                      className="accent-primary h-4 w-4"
                    />
                    <Label htmlFor="showDirect" className="text-xs font-bold cursor-pointer">Exibir direto no cardápio principal</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="allowCart" 
                      checked={allowCart} 
                      onChange={(e) => setAllowCart(e.target.checked)}
                      className="accent-primary h-4 w-4"
                    />
                    <Label htmlFor="allowCart" className="text-xs font-bold cursor-pointer">Permitir adicionar ao carrinho</Label>
                  </div>
                </div>
              </div>

              {/* Resumo Detalhado */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Com Preço</p>
                  <p className="text-xl font-black text-green-500">{stats.withPrice}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Sem Preço</p>
                  <p className="text-xl font-black text-amber-500">{stats.withoutPrice}</p>
                </div>
              </div>

              {stats.withoutPrice > 0 && categoryType !== "PIZZA" && (
                <div className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>Atenção: {stats.withoutPrice} itens não possuem preço detectado e serão importados com R$ 0,00.</p>
                </div>
              )}

              {categoryType === "PIZZA" && (
                <div className="text-[11px] text-zinc-400 bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex gap-2">
                  <Info className="h-4 w-4 shrink-0 text-blue-400" />
                  <p>Modo Pizza: Os preços individuais dos sabores serão ignorados (usa os preços dos tamanhos).</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex gap-3 items-center text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => setIsOpen(false)}
            className="flex-1 px-6 py-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-sm font-bold transition-all"
          >
            Cancelar
          </button>
          <button
            disabled={!data || loading}
            onClick={handleImport}
            className="flex-1 btn-premium px-6 py-3 rounded-xl flex items-center justify-center gap-2 uppercase text-xs tracking-widest shadow-xl disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>Confirmar Importação</span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
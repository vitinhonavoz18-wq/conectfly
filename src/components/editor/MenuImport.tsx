 import { useState, useRef } from "react";
 import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogFooter,
   DialogTrigger,
 } from "@/components/ui/dialog";
 import { toast } from "sonner";
 import type { PizzaSize } from "@/lib/site/types";
 
 interface Props {
   restaurantId: string;
   onSuccess: () => void;
 }
 
 interface ImportData {
   pizzaria?: string;
   tipo_cardapio?: string;
   tamanhos?: Array<{
     nome: string;
     preco: number;
     fatias: number;
     max_sabores: number;
   }>;
   bordas_recheadas?: Array<{
     nome: string;
     acrescimo: number;
   }>;
   sabores?: Array<{
     codigo?: string;
     nome: string;
     categoria: string;
     ingredientes_ordem_preparo?: string[];
   }>;
 }
 
 export function MenuImport({ restaurantId, onSuccess }: Props) {
   const [isOpen, setIsOpen] = useState(false);
   const [file, setFile] = useState<File | null>(null);
   const [data, setData] = useState<ImportData | null>(null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);
 
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
         validateData(json);
       } catch (err) {
         setError("O arquivo JSON é inválido ou está malformado.");
         setData(null);
       }
     };
     reader.readAsText(selectedFile);
   };
 
   const validateData = (json: any) => {
     if (!json.sabores || !Array.isArray(json.sabores)) {
       setError("O arquivo deve conter uma lista de 'sabores'.");
       setData(null);
       return;
     }
     setError(null);
     setData(json);
   };
 
   const handleImport = async () => {
     if (!data || !restaurantId) return;
     setLoading(true);
 
     try {
       // 1. Processar Categoria (Pizzas por padrão)
       const categoryName = data.tipo_cardapio?.toUpperCase() || "PIZZA";
       
       // Buscar categorias existentes
       const { data: existingCats } = await supabase
         .from("menu_categories")
         .select("*")
         .eq("restaurant_id", restaurantId);
 
       let mainCat = existingCats?.find(c => c.name.toUpperCase() === categoryName);
 
       // Formatar tamanhos
       const pizzaSizes: PizzaSize[] = data.tamanhos?.map(t => ({
         label: t.nome,
         price: t.preco,
         max_flavors: t.max_sabores
       })) || [];
 
       if (!mainCat) {
         // Criar categoria
         const { data: newCat, error: catErr } = await supabase
           .from("menu_categories")
           .insert({
             restaurant_id: restaurantId,
             name: categoryName,
             icon: "🍕",
             is_pizza: true,
             pizza_sizes: pizzaSizes as any,
             sort_order: existingCats?.length || 0
           })
           .select()
           .single();
         
         if (catErr) throw catErr;
         mainCat = newCat;
       } else {
         // Atualizar tamanhos se vierem no JSON
         if (pizzaSizes.length > 0) {
           await supabase
             .from("menu_categories")
             .update({ pizza_sizes: pizzaSizes as any })
             .eq("id", mainCat.id);
         }
       }
 
       // 2. Processar Sabores
       const { data: existingItems } = await supabase
         .from("menu_items")
         .select("*")
         .eq("category_id", mainCat.id);
 
       const sortedSabores = [...(data.sabores || [])].sort((a, b) => {
         const codeA = parseInt(a.codigo || "0");
         const codeB = parseInt(b.codigo || "0");
         return codeA - codeB;
       });
 
       for (let i = 0; i < sortedSabores.length; i++) {
         const sabor = sortedSabores[i];
         const existing = existingItems?.find(item => 
           (sabor.codigo && item.name.includes(`[${sabor.codigo}]`)) || 
           item.name.toUpperCase() === sabor.nome.toUpperCase()
         );
 
         const displayName = sabor.codigo ? `[${sabor.codigo}] ${sabor.nome}` : sabor.nome;
         const description = sabor.ingredientes_ordem_preparo?.join(", ") || "";
 
         if (existing) {
           await supabase
             .from("menu_items")
             .update({
               name: displayName,
               description: description,
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
               price: 0,
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
       <DialogContent className="sm:max-w-[500px] border-white/10 bg-zinc-950 text-white">
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
             <div className="space-y-4">
               <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                 <div className="flex items-center gap-3">
                   <FileJson className="h-8 w-8 text-primary" />
                   <div>
                     <p className="font-bold text-sm truncate max-w-[200px]">{file?.name}</p>
                     <p className="text-xs text-zinc-400">Pronto para importar</p>
                   </div>
                 </div>
                 <button onClick={reset} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400">
                   <X className="h-4 w-4" />
                 </button>
               </div>
 
               <div className="grid grid-cols-2 gap-3">
                 <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                   <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Sabores</p>
                   <p className="text-2xl font-black">{data.sabores?.length || 0}</p>
                 </div>
                 <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                   <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Tamanhos</p>
                   <p className="text-2xl font-black">{data.tamanhos?.length || 0}</p>
                 </div>
                 <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                   <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Bordas</p>
                   <p className="text-2xl font-black">{data.bordas_recheadas?.length || 0}</p>
                 </div>
                 <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                   <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Tipo</p>
                   <p className="text-lg font-bold truncate uppercase">{data.tipo_cardapio || "Pizzas"}</p>
                 </div>
               </div>
 
               {data.tamanhos && data.tamanhos.length > 0 && (
                 <div className="text-[11px] text-zinc-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex gap-2">
                   <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                   <p>Os tamanhos encontrados no arquivo serão atualizados na categoria principal.</p>
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
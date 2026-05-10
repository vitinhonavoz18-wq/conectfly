import { useEffect, useState } from "react";
import { Plus, Save, Trash2, MapPin, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DeliveryZoneRow } from "@/lib/site/types";
import { DEFAULT_DELIVERY_ZONES } from "@/lib/site/defaultMenu";
import { formatBRL } from "@/lib/site/format";

interface Props {
  restaurantId: string;
}

export function DeliveryZonesManager({ restaurantId }: Props) {
  const [zones, setZones] = useState<DeliveryZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState("");
  const [newFee, setNewFee] = useState("");
  const [filter, setFilter] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("delivery_zones")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order");
    setZones((data ?? []) as unknown as DeliveryZoneRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [restaurantId]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 2000);
  };

  const handleAdd = async () => {
    const name = newName.trim().toUpperCase();
    const fee = Number(newFee.replace(",", "."));
    if (!name) return flash("Informe o nome do bairro");
    if (!Number.isFinite(fee) || fee < 0) return flash("Taxa inválida");
    const sort_order = zones.length;
    const { error } = await supabase.from("delivery_zones").insert({
      restaurant_id: restaurantId,
      neighborhood: name,
      fee,
      sort_order,
    });
    if (error) return flash("Erro: " + error.message);
    setNewName("");
    setNewFee("");
    flash("Bairro adicionado");
    load();
  };

  const handleUpdate = async (z: DeliveryZoneRow, patch: Partial<DeliveryZoneRow>) => {
    setZones((cur) => cur.map((x) => (x.id === z.id ? { ...x, ...patch } : x)));
  };

  const handleSave = async (z: DeliveryZoneRow) => {
    const { error } = await supabase
      .from("delivery_zones")
      .update({ neighborhood: z.neighborhood.toUpperCase(), fee: Number(z.fee) || 0 })
      .eq("id", z.id);
    if (error) return flash("Erro: " + error.message);
    flash("Salvo");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este bairro?")) return;
    await supabase.from("delivery_zones").delete().eq("id", id);
    load();
  };

  const handleSeedDefaults = async () => {
    if (!confirm("Adicionar bairros padrão de Salvador que ainda não existem?")) return;
    const existing = new Set(zones.map((z) => z.neighborhood.toUpperCase()));
    const rows = DEFAULT_DELIVERY_ZONES.filter(
      (d) => !existing.has(d.neighborhood.toUpperCase()),
    ).map((d, i) => ({
      restaurant_id: restaurantId,
      neighborhood: d.neighborhood,
      fee: d.fee,
      sort_order: zones.length + i,
    }));
    if (rows.length === 0) return flash("Todos os bairros padrão já estão cadastrados");
    const { error } = await supabase.from("delivery_zones").insert(rows);
    if (error) return flash("Erro: " + error.message);
    flash(`${rows.length} bairros adicionados`);
    load();
  };

  const filtered = zones.filter((z) =>
    z.neighborhood.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-5">
       <div className="card-premium p-8 border-primary/20 bg-primary/5 relative overflow-hidden">
         <div className="absolute top-0 right-0 p-8 opacity-5">
           <MapPin className="h-24 w-24 text-primary" />
         </div>
         <div className="flex items-start gap-5 mb-6 relative z-10">
           <div className="h-14 w-14 rounded-2xl bg-gradient-bronze flex items-center justify-center shadow-glow border border-primary/30">
             <MapPin className="h-8 w-8 text-primary-foreground" />
           </div>
           <div>
             <h3 className="text-2xl font-black tracking-tighter uppercase">Roteamento Gourmet</h3>
             <p className="text-muted-foreground italic">
               Configure a logística de entrega das suas obras gastronômicas.
             </p>
           </div>
         </div>
         <button
           onClick={handleSeedDefaults}
           className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-bold transition-all"
         >
           <RefreshCw className="h-4 w-4 text-primary" />
           <span>Carregar Bairros Padrão (Salvador)</span>
         </button>
       </div>
 
       <div className="card-premium p-6">
         <h4 className="text-lg font-black mb-4 text-primary tracking-tight">Novo Bairro</h4>
         <div className="grid grid-cols-1 sm:grid-cols-[2fr,1fr,auto] gap-3">
           <input
             value={newName}
             onChange={(e) => setNewName(e.target.value)}
             placeholder="Nome do bairro (ex: Vitória)"
             className="input bg-black/20"
           />
           <div className="relative flex items-center">
             <span className="absolute left-3 text-xs font-bold text-primary">R$</span>
             <input
               value={newFee}
               onChange={(e) => setNewFee(e.target.value)}
               placeholder="0.00"
               inputMode="decimal"
               className="input pl-9 bg-black/20"
             />
           </div>
           <button
             onClick={handleAdd}
             className="btn-premium px-8 py-2.5 rounded-xl flex items-center gap-2 uppercase text-xs tracking-widest shadow-xl"
           >
             <Plus className="h-5 w-5 text-primary-foreground" /> 
             <span>Mapear Bairro</span>
           </button>
         </div>
         {msg && <p className="text-sm font-bold text-primary mt-3 animate-pulse">{msg}</p>}
       </div>

       <div className="card-premium p-6">
         <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
           <h4 className="text-lg font-black tracking-tight">Bairros Atendidos <span className="text-sm font-bold text-muted-foreground ml-2 bg-white/5 px-2 py-1 rounded-md">{zones.length}</span></h4>
           <div className="relative flex-1 max-w-xs">
             <input
               value={filter}
               onChange={(e) => setFilter(e.target.value)}
               placeholder="Buscar bairro..."
               className="input bg-black/20 pl-4 py-2"
             />
           </div>
         </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum bairro cadastrado.</p>
        ) : (
           <div className="space-y-3">
             {filtered.map((z) => (
               <div key={z.id} className="p-3 rounded-xl bg-white/5 border border-white/5 grid grid-cols-1 sm:grid-cols-[2fr,1fr,auto,auto] gap-3 items-center hover:border-white/10 transition-colors group">
                 <input
                   value={z.neighborhood}
                   onChange={(e) => handleUpdate(z, { neighborhood: e.target.value })}
                   className="input bg-black/20 border-transparent focus:border-primary/40 font-bold uppercase"
                 />
                 <div className="flex items-center gap-2">
                   <span className="text-xs font-bold text-primary">R$</span>
                   <input
                     value={String(z.fee)}
                     onChange={(e) =>
                       handleUpdate(z, {
                         fee: Number(e.target.value.replace(",", ".")) || 0,
                       })
                     }
                     inputMode="decimal"
                     className="input flex-1 bg-black/20 border-transparent focus:border-primary/40 font-black text-emerald-400"
                   />
                 </div>
                 <button
                   onClick={() => handleSave(z)}
                   className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-sm font-bold transition-all text-primary"
                 >
                   <Save className="h-4 w-4" /> 
                   <span className="sm:hidden lg:inline">Salvar</span>
                 </button>
                 <button
                   onClick={() => handleDelete(z.id)}
                   className="p-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                   aria-label="Remover"
                 >
                   <Trash2 className="h-5 w-5" />
                 </button>
               </div>
             ))}
           </div>
        )}
      </div>
    </div>
  );
}

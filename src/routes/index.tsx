import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
   Download,
   Eye,
   Globe,
   Rocket,
   Sparkles,
 } from "lucide-react";
import { listRestaurants } from "@/lib/site/queries";
import type { RestaurantRow } from "@/lib/site/types";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/site/format";
import { seedDefaultMenu, seedDefaultDeliveryZones } from "@/lib/site/defaultMenu";
import { generateApiKey } from "@/lib/site/flycontrol";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SiteCreatorFly — Plataforma de sites de delivery" },
      {
        name: "description",
        content:
          "Crie sites de delivery prontos para uso, com cardápio, combos e checkout via WhatsApp.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const router = useRouter();
  const [list, setList] = useState<RestaurantRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const reload = () => {
    listRestaurants().then(setList).catch((e) => setError(String(e)));
  };

  useEffect(() => {
    reload();
  }, []);

  const handleCreate = async () => {
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Informe o nome do restaurante");
      return;
    }
    let slug = slugify(trimmed);
    if (!slug) slug = `site-${Date.now()}`;
    // ensure unique
    const { data: existing } = await supabase
      .from("restaurants")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const { data, error: insErr } = await supabase
      .from("restaurants")
      .insert({ name: trimmed, slug, flycontrol_api_key: generateApiKey() })
      .select()
      .single();
    if (insErr || !data) {
      setError(insErr?.message ?? "Falha ao criar");
      return;
    }
    // Aplica o cardápio padrão pré-definido (ignora erros silenciosamente)
    try {
      await seedDefaultMenu(data.id);
      await seedDefaultDeliveryZones(data.id);
    } catch (e) {
      console.warn("[seedDefaultMenu]", e);
    }
    setName("");
    setCreating(false);
    router.navigate({ to: "/edit/$id", params: { id: data.id } });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este site definitivamente?")) return;
    await supabase.from("restaurants").delete().eq("id", id);
    reload();
  };

  const togglePublished = async (r: RestaurantRow) => {
    await supabase
      .from("restaurants")
      .update({ published: !r.published })
      .eq("id", r.id);
    reload();
  };

  return (
     <div className="min-h-screen bg-background">
       <header className="border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
         <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl bg-gradient-fire flex items-center justify-center shadow-glow animate-pulse">
               <Rocket className="h-6 w-6 text-primary-foreground glow-orange" />
            </div>
            <div>
              <h1 className="font-black tracking-tight text-lg leading-none">
                SiteCreatorFly
              </h1>
              <p className="text-xs text-muted-foreground">
                Sites de delivery prontos para decolar
              </p>
            </div>
          </div>
           <div className="flex items-center gap-4">
             <button
               onClick={() => setCreating(true)}
               className="btn-fire px-5 py-2.5 rounded-xl flex items-center gap-2 group"
             >
               <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" />
               <span>Novo Site</span>
             </button>
           </div>
        </div>
      </header>

       <main className="max-w-7xl mx-auto px-6 py-12">
        {creating && (
           <div className="mb-8 card-premium p-6 site-hero-enter">
             <h3 className="text-xl font-black mb-4 flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4 text-accent" />
              Criar novo site
            </h3>
            <div className="flex flex-col sm:flex-row gap-2">
               <div className="relative flex-1">
                 <input
                   autoFocus
                   value={name}
                   onChange={(e) => setName(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                   placeholder="Ex.: Pizzaria do João"
                   className="w-full px-5 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all text-lg font-medium placeholder:text-muted-foreground/50"
                 />
               </div>
               <div className="flex gap-3">
                 <button
                   onClick={handleCreate}
                   className="btn-fire px-8 py-3 rounded-xl"
                 >
                   Criar Agora
                 </button>
                 <button
                   onClick={() => {
                     setCreating(false);
                     setName("");
                     setError("");
                   }}
                   className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-semibold"
                 >
                   Cancelar
                 </button>
               </div>
            </div>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </div>
        )}

        {list === null ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : list.length === 0 ? (
          <EmptyState onCreate={() => setCreating(true)} />
        ) : (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 site-stagger">
            {list.map((r) => (
               <article key={r.id} className="card-premium p-6 flex flex-col gap-4 group">
                 <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                     <div className="relative">
                       {r.logo_url ? (
                         <img
                           src={r.logo_url}
                           alt={r.name}
                           className="h-14 w-14 rounded-xl object-cover bg-white/5 flex-shrink-0 border border-white/10 group-hover:border-primary/50 transition-colors"
                         />
                       ) : (
                         <div className="h-14 w-14 rounded-xl bg-gradient-fire flex-shrink-0 flex items-center justify-center font-black text-xl text-primary-foreground shadow-glow group-hover:scale-110 transition-transform">
                           {r.name.charAt(0).toUpperCase()}
                         </div>
                       )}
                       <div className={`absolute -top-2 -right-2 h-4 w-4 rounded-full border-2 border-background ${r.published ? 'bg-emerald-500 shadow-[0_0_10px_oklch(0.7_0.2_160)]' : 'bg-orange-500 shadow-[0_0_10px_oklch(0.6_0.2_40)]'}`} />
                     </div>
                     <div className="min-w-0 ml-4">
                       <h3 className="font-black text-lg truncate group-hover:text-primary transition-colors">{r.name}</h3>
                       <p className="text-sm text-muted-foreground/60 truncate flex items-center gap-1.5">
                         <Globe className="h-3 w-3" />
                         {r.slug}
                       </p>
                     </div>
                  </div>
                 </div>
 
                 <div className="grid grid-cols-2 gap-2 mt-auto">
                   <Link
                     to="/edit/$id"
                     params={{ id: r.id }}
                     className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
                   >
                     <Pencil className="h-4 w-4 text-primary" /> Painel
                   </Link>
                   <Link
                     to="/s/$slug"
                     params={{ slug: r.slug }}
                     className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
                   >
                     <Eye className="h-4 w-4 text-secondary" /> Ver
                   </Link>
                 </div>
                 <div className="flex items-center justify-between pt-2 border-t border-white/5">
                   <Link
                     to="/export/$id"
                     params={{ id: r.id }}
                     className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                   >
                     <Download className="h-3 w-3" /> Exportar ZIP
                   </Link>
                   <button
                     onClick={() => handleDelete(r.id)}
                     className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                     title="Excluir site"
                   >
                     <Trash2 className="h-4 w-4" />
                   </button>
                 </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

 function EmptyState({ onCreate }: { onCreate: () => void }) {
   return (
     <div className="rounded-[2.5rem] border-2 border-dashed border-white/10 bg-white/5 p-16 text-center shadow-2xl relative overflow-hidden group">
       <div className="absolute inset-0 bg-gradient-fire opacity-0 group-hover:opacity-[0.03] transition-opacity" />
       <div className="relative z-10">
         <div className="mx-auto h-20 w-20 rounded-3xl bg-gradient-fire flex items-center justify-center mb-6 shadow-glow animate-bounce">
           <Rocket className="h-10 w-10 text-primary-foreground glow-orange" />
         </div>
         <h2 className="text-3xl font-black mb-3 tracking-tight">Comece sua Jornada</h2>
         <p className="text-muted-foreground mb-10 max-w-md mx-auto text-lg leading-relaxed">
           Crie sites de delivery poderosos com cardápio inteligente e checkout via WhatsApp em segundos.
         </p>
         <button
           onClick={onCreate}
           className="btn-fire px-10 py-4 rounded-2xl text-lg flex items-center gap-3 mx-auto shadow-2xl"
         >
           <Plus className="h-6 w-6" />
           <span>Criar Meu Primeiro Site</span>
         </button>
       </div>
     </div>
   );
 }

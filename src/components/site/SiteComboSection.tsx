import { useState } from "react";
import { Plus } from "lucide-react";
import type { ComboGroupRow, ComboRow } from "@/lib/site/types";
import { formatBRL } from "@/lib/site/format";
import { useCart } from "./CartContext";

interface Props {
  groups: (ComboGroupRow & { combos: ComboRow[] })[];
}

export function SiteComboSection({ groups }: Props) {
  const { addLine } = useCart();
  const [active, setActive] = useState(groups[0]?.id ?? "");
  if (groups.length === 0) return null;
  const current = groups.find((g) => g.id === active) ?? groups[0];

  return (
     <section
       id="combos"
       className="py-24 px-4 bg-gradient-to-b from-[hsl(var(--site-bg))] via-[hsl(var(--site-primary)/0.05)] to-[hsl(var(--site-bg))] relative overflow-hidden"
     >
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-[hsl(var(--site-primary)/0.3)] to-transparent" />
       <div className="max-w-7xl mx-auto">
         <div className="text-center mb-12">
           <span className="inline-block px-4 py-1.5 rounded-full bg-[hsl(var(--site-primary)/0.2)] text-[hsl(var(--site-primary))] text-[10px] font-black tracking-[0.3em] uppercase mb-4 border border-[hsl(var(--site-primary)/0.3)]">
             Seleções do Chef
           </span>
             <h2 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase mb-4 text-[hsl(var(--site-fg))]">
               Combos <span className="text-[hsl(var(--site-primary))]">Especiais</span>
            </h2>
           <div className="h-1.5 w-24 bg-[hsl(var(--site-primary))] mx-auto rounded-full" />
         </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-8 justify-start sm:justify-center">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setActive(g.id)}
               className={`px-8 py-3 rounded-2xl whitespace-nowrap font-black text-xs uppercase tracking-widest transition-all duration-300 ${
                 active === g.id
                   ? "site-btn-primary shadow-glow scale-110"
                   : "site-btn-secondary text-[hsl(var(--site-muted-fg))]"
               }`}
             >
              {g.title}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 site-stagger">
          {current.combos.map((c) => (
             <div
               key={c.id}
               className="rounded-3xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] p-8 flex flex-col gap-6 relative group hover:border-[hsl(var(--site-primary)/0.3)] transition-all duration-500 shadow-2xl backdrop-blur-sm"
             >
               {c.badge && (
                 <span className="absolute -top-3 right-6 px-3 py-1.5 rounded-xl bg-gradient-leaf text-white text-[10px] font-black uppercase tracking-widest shadow-lg">
                   {c.badge}
                 </span>
               )}
               <h3 className="font-black text-2xl tracking-tight uppercase group-hover:text-[hsl(var(--site-primary))] transition-colors text-[hsl(var(--site-fg))]">{c.name}</h3>
               <ul className="text-[hsl(var(--site-muted-fg))] space-y-2">
                 {c.items.map((line, i) => (
                   <li key={i} className="flex items-start gap-2 text-sm">
                     <span className="text-[hsl(var(--site-primary))] mt-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--site-primary))] shrink-0" />
                     {line}
                   </li>
                 ))}
               </ul>
               <div className="flex items-center justify-between mt-auto pt-6 border-t border-[hsl(var(--site-border))]">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[hsl(var(--site-muted-fg))]">Investimento</span>
                    <span className="text-3xl font-black text-[hsl(var(--site-primary))] tracking-tighter">
                      {formatBRL(c.price)}
                    </span>
                 </div>
                  <button
                    onClick={() =>
                      addLine({
                        itemId: c.id,
                        name: c.name,
                        description: c.items.join(" + "),
                        unitPrice: c.price,
                      })
                    }
                    className="site-btn-primary p-4 rounded-2xl shadow-xl active:scale-90"
                    title="Adicionar ao pedido"
                  >
                    <Plus className="h-6 w-6 text-[hsl(var(--site-primary-fg))]" />
                  </button>
               </div>
             </div>
          ))}
        </div>
      </div>
    </section>
  );
}
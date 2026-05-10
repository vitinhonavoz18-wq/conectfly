import { Phone, Clock, MapPin } from "lucide-react";

interface Props {
  name: string;
  phoneDisplay: string | null;
  hours: string | null;
  address: string | null;
  city: string | null;
}

export function SiteFooter({ name, phoneDisplay, hours, address, city }: Props) {
  return (
     <footer className="border-t border-white/5 bg-black/40 px-4 py-20 mt-16 backdrop-blur-md relative overflow-hidden">
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
       <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-12 text-center sm:text-left relative z-10">
         {phoneDisplay && (
           <div className="group">
             <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto sm:mx-0 mb-4 group-hover:border-primary/50 transition-colors">
               <Phone className="h-6 w-6 text-primary" />
             </div>
             <h4 className="font-black text-xs uppercase tracking-[0.2em] mb-2 text-muted-foreground">Reservas & Pedidos</h4>
             <p className="text-xl font-black text-foreground tracking-tight">{phoneDisplay}</p>
           </div>
         )}
         {hours && (
           <div className="group">
             <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto sm:mx-0 mb-4 group-hover:border-primary/50 transition-colors">
               <Clock className="h-6 w-6 text-primary" />
             </div>
             <h4 className="font-black text-xs uppercase tracking-[0.2em] mb-2 text-muted-foreground">Horário de Funcionamento</h4>
             <p className="text-sm text-foreground italic whitespace-pre-line leading-relaxed">
               {hours}
             </p>
           </div>
         )}
         {(address || city) && (
           <div className="group">
             <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto sm:mx-0 mb-4 group-hover:border-primary/50 transition-colors">
               <MapPin className="h-6 w-6 text-primary" />
             </div>
             <h4 className="font-black text-xs uppercase tracking-[0.2em] mb-2 text-muted-foreground">Endereço da Unidade</h4>
             <div className="text-sm text-foreground italic leading-relaxed">
               {address && <p>{address}</p>}
               {city && <p className="font-black text-primary not-italic uppercase tracking-widest mt-1">{city}</p>}
             </div>
           </div>
         )}
       </div>
       <div className="max-w-7xl mx-auto text-center mt-20 pt-8 border-t border-white/5">
         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50">
           © {new Date().getFullYear()} {name} • Gastronomia Digital by SuperCreatorFly
         </p>
       </div>
     </footer>
  );
}
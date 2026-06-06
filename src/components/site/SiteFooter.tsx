import { Phone, Clock, MapPin } from "lucide-react";

interface Props {
  name: string;
  phoneDisplay: string | null;
  hours: string | null;
  address: string | null;
  city: string | null;
}

export function SiteFooter({ name, phoneDisplay, hours, address, city }: Props) {
  const cleanPhone = phoneDisplay?.replace(/\D/g, "");

  return (
     <footer className="border-t border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] px-4 py-16 sm:py-24 mt-16 backdrop-blur-md relative overflow-hidden">
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-[hsl(var(--site-primary)/0.3)] to-transparent" />
       
       <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-8 text-center sm:text-left relative z-10">
         {phoneDisplay && (
           <a 
             href={`tel:${cleanPhone}`}
             className="group block"
           >
              <div className="h-14 w-14 rounded-2xl bg-[hsl(var(--site-muted))] border border-[hsl(var(--site-border))] flex items-center justify-center mx-auto sm:mx-0 mb-5 group-hover:border-[hsl(var(--site-primary)/0.6)] group-hover:bg-[hsl(var(--site-primary)/0.05)] transition-all duration-300 shadow-lg">
                <Phone className="h-6 w-6 text-[hsl(var(--site-primary))] group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="font-black text-[10px] uppercase tracking-[0.2em] mb-2 text-[hsl(var(--site-muted-fg))] opacity-80">Reservas & Pedidos</h4>
              <p className="text-xl sm:text-2xl font-black text-[hsl(var(--site-fg))] tracking-tighter group-hover:text-[hsl(var(--site-primary))] transition-colors">{phoneDisplay}</p>
           </a>
         )}

         {hours && (
           <div className="group">
              <div className="h-14 w-14 rounded-2xl bg-[hsl(var(--site-muted))] border border-[hsl(var(--site-border))] flex items-center justify-center mx-auto sm:mx-0 mb-5 group-hover:border-[hsl(var(--site-primary)/0.6)] transition-all duration-300 shadow-lg">
                <Clock className="h-6 w-6 text-[hsl(var(--site-primary))]" />
              </div>
              <h4 className="font-black text-[10px] uppercase tracking-[0.2em] mb-2 text-[hsl(var(--site-muted-fg))] opacity-80">Funcionamento</h4>
              <p className="text-sm sm:text-base text-[hsl(var(--site-fg))] italic whitespace-pre-line leading-relaxed opacity-90">
               {hours}
             </p>
           </div>
         )}

         {(address || city) && (
           <a 
             href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address || ''} ${city || ''}`)}`}
             target="_blank"
             rel="noopener noreferrer"
             className="group block"
           >
              <div className="h-14 w-14 rounded-2xl bg-[hsl(var(--site-muted))] border border-[hsl(var(--site-border))] flex items-center justify-center mx-auto sm:mx-0 mb-5 group-hover:border-[hsl(var(--site-primary)/0.6)] group-hover:bg-[hsl(var(--site-primary)/0.05)] transition-all duration-300 shadow-lg">
                <MapPin className="h-6 w-6 text-[hsl(var(--site-primary))] group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="font-black text-[10px] uppercase tracking-[0.2em] mb-2 text-[hsl(var(--site-muted-fg))] opacity-80">Nossa Unidade</h4>
              <div className="text-sm sm:text-base text-[hsl(var(--site-fg))] italic leading-relaxed group-hover:text-[hsl(var(--site-primary))] transition-colors">
                {address && <p>{address}</p>}
                {city && <p className="font-black text-[hsl(var(--site-primary))] not-italic uppercase tracking-widest mt-2 text-[10px]">{city}</p>}
             </div>
           </a>
         )}
       </div>

        <div className="max-w-7xl mx-auto text-center mt-16 sm:mt-24 pt-10 border-t border-[hsl(var(--site-border))]">
          <div className="flex flex-col items-center gap-4">
            <span className="font-black text-lg tracking-tighter uppercase text-[hsl(var(--site-fg))] opacity-40">{name}</span>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[hsl(var(--site-muted-fg))] opacity-60">
              © {new Date().getFullYear()} • Gastronomia Digital by SuperCreatorFly
            </p>
          </div>
       </div>
     </footer>
  );
}

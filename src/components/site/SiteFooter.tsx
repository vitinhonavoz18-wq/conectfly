import { Phone, Clock, MapPin } from "lucide-react";
import { gradeParaBlocos } from "@/lib/site/rodapeGrade";

interface Props {
  name: string;
  phoneDisplay: string | null;
  hours: string | null;
  address: string | null;
  city: string | null;
}

/**
 * RODAPÉ do cardápio — telefone, horário e endereço, lado a lado.
 *
 * O PROBLEMA QUE ISSO RESOLVE
 *
 * Cada bloco tem três andares: o ícone, o rótulo pequeno ("Reservas &
 * Pedidos") e o conteúdo. Antes, cada bloco era uma pilha independente: se o
 * rótulo de um deles quebrava em duas linhas, o conteúdo daquele bloco descia
 * sozinho e os três deixavam de se alinhar. É a prateleira em que cada
 * suporte foi pregado na altura que deu: os potes ficam tortos mesmo estando
 * todos "no lugar".
 *
 * A CORREÇÃO
 *
 * Os três blocos passam a dividir as MESMAS três faixas de altura (ícone,
 * rótulo, conteúdo). Se o rótulo de um bloco ocupa duas linhas, a faixa do
 * rótulo cresce para todos juntos — e as três colunas continuam alinhadas.
 * É pregar uma única prateleira atravessada, em vez de três suportes soltos.
 */
export function SiteFooter({ name, phoneDisplay, hours, address, city }: Props) {
  const cleanPhone = phoneDisplay?.replace(/\D/g, "");
  // Conta o que REALMENTE vai aparecer, com a mesma regra usada lá embaixo
  // para decidir se cada bloco entra.
  const blocosVisiveis = [phoneDisplay, hours, address || city].filter(Boolean).length;

  // As três faixas compartilhadas + o encaixe de cada bloco nelas.
  const faixasDoRodape = "sm:grid-rows-[auto_auto_1fr]";
  const blocoAlinhado = "sm:grid sm:grid-rows-subgrid sm:row-span-3 sm:gap-0";

  return (
     <footer className="border-t border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] px-4 py-16 sm:py-24 mt-16 backdrop-blur-md relative overflow-x-clip">
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-[hsl(var(--site-primary)/0.3)] to-transparent" />
       
       <div className={`max-w-7xl mx-auto grid grid-cols-1 ${gradeParaBlocos(blocosVisiveis)} ${faixasDoRodape} gap-12 sm:gap-8 text-center sm:text-left relative z-10`}>
         {phoneDisplay && (
           <a 
             href={`tel:${cleanPhone}`}
             className={`group block min-w-0 ${blocoAlinhado}`}
           >
              <div className="h-14 w-14 rounded-2xl bg-[hsl(var(--site-muted))] border border-[hsl(var(--site-border))] flex items-center justify-center mx-auto sm:mx-0 mb-5 group-hover:border-[hsl(var(--site-primary)/0.6)] group-hover:bg-[hsl(var(--site-primary)/0.05)] transition-all duration-300 shadow-lg">
                <Phone className="h-6 w-6 text-[hsl(var(--site-primary))] group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="font-black text-[10px] uppercase tracking-[0.2em] leading-snug mb-2 text-[hsl(var(--site-muted-fg))] opacity-80">Reservas &amp; Pedidos</h4>
              <p className="text-xl sm:text-2xl font-black text-[hsl(var(--site-fg))] tracking-tighter leading-snug break-words group-hover:text-[hsl(var(--site-primary))] transition-colors">{phoneDisplay}</p>
           </a>
         )}

         {hours && (
           <div className={`group min-w-0 ${blocoAlinhado}`}>
              <div className="h-14 w-14 rounded-2xl bg-[hsl(var(--site-muted))] border border-[hsl(var(--site-border))] flex items-center justify-center mx-auto sm:mx-0 mb-5 group-hover:border-[hsl(var(--site-primary)/0.6)] transition-all duration-300 shadow-lg">
                <Clock className="h-6 w-6 text-[hsl(var(--site-primary))]" />
              </div>
              <h4 className="font-black text-[10px] uppercase tracking-[0.2em] leading-snug mb-2 text-[hsl(var(--site-muted-fg))] opacity-80">Funcionamento</h4>
              <p className="text-sm sm:text-base text-[hsl(var(--site-fg))] italic whitespace-pre-line leading-snug break-words opacity-90">
               {hours}
             </p>
           </div>
         )}

         {(address || city) && (
           <a 
             href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address || ''} ${city || ''}`)}`}
             target="_blank"
             rel="noopener noreferrer"
             className={`group block min-w-0 ${blocoAlinhado}`}
           >
              <div className="h-14 w-14 rounded-2xl bg-[hsl(var(--site-muted))] border border-[hsl(var(--site-border))] flex items-center justify-center mx-auto sm:mx-0 mb-5 group-hover:border-[hsl(var(--site-primary)/0.6)] group-hover:bg-[hsl(var(--site-primary)/0.05)] transition-all duration-300 shadow-lg">
                <MapPin className="h-6 w-6 text-[hsl(var(--site-primary))] group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="font-black text-[10px] uppercase tracking-[0.2em] leading-snug mb-2 text-[hsl(var(--site-muted-fg))] opacity-80">Nossa Unidade</h4>
              <div className="text-sm sm:text-base text-[hsl(var(--site-fg))] italic leading-snug break-words group-hover:text-[hsl(var(--site-primary))] transition-colors">
                {address && <p>{address}</p>}
                {city && <p className="font-black text-[hsl(var(--site-primary))] not-italic uppercase tracking-widest mt-2 text-[10px] leading-snug">{city}</p>}
             </div>
           </a>
         )}
       </div>

        <div className="max-w-7xl mx-auto text-center mt-16 sm:mt-24 pt-10 border-t border-[hsl(var(--site-border))]">
          <div className="flex flex-col items-center gap-4">
            <span className="font-black text-lg tracking-tighter uppercase text-[hsl(var(--site-fg))] opacity-40">{name}</span>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[hsl(var(--site-muted-fg))] opacity-60">
              © {new Date().getFullYear()} • Gastronomia Digital
            </p>
          </div>
       </div>
     </footer>
  );
}

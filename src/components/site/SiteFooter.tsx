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
    <footer className="border-t border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] px-4 py-12 mt-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center sm:text-left">
        {phoneDisplay && (
          <div>
            <Phone className="h-6 w-6 mx-auto sm:mx-0 mb-2 text-[hsl(var(--site-primary))]" />
            <h4 className="font-bold mb-1">WhatsApp</h4>
            <p className="text-[hsl(var(--site-muted-fg))]">{phoneDisplay}</p>
          </div>
        )}
        {hours && (
          <div>
            <Clock className="h-6 w-6 mx-auto sm:mx-0 mb-2 text-[hsl(var(--site-primary))]" />
            <h4 className="font-bold mb-1">Horário</h4>
            <p className="text-[hsl(var(--site-muted-fg))] whitespace-pre-line">
              {hours}
            </p>
          </div>
        )}
        {(address || city) && (
          <div>
            <MapPin className="h-6 w-6 mx-auto sm:mx-0 mb-2 text-[hsl(var(--site-primary))]" />
            <h4 className="font-bold mb-1">Localização</h4>
            {address && <p className="text-[hsl(var(--site-muted-fg))]">{address}</p>}
            {city && <p className="text-[hsl(var(--site-muted-fg))]">{city}</p>}
          </div>
        )}
      </div>
      <div className="text-center text-xs text-[hsl(var(--site-muted-fg))] mt-8 pt-6 border-t border-[hsl(var(--site-border))]">
        © {new Date().getFullYear()} {name}. Todos os direitos reservados.
      </div>
    </footer>
  );
}
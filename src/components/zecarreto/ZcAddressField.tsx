/**
 * Campo de endereço com busca.
 *
 * A pessoa digita "rua das flores 100 sao paulo" e escolhe na lista. Isso
 * traz o ponto no mapa junto — que é o que o sistema usa para calcular a
 * distância. Também dá para preencher à mão, se a busca não achar.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { zcApi } from "@/lib/zecarreto/client";
import type { AddressValue } from "./address-value";

interface GeocodeResult {
  label: string;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  lat: number;
  lng: number;
}

interface ZcAddressFieldProps {
  title: string;
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  showAccessFields?: boolean;
}

export function ZcAddressField({
  title,
  value,
  onChange,
  showAccessFields = true,
}: ZcAddressFieldProps) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (term.trim().length < 5) {
      setResults([]);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const found = await zcApi<GeocodeResult[]>(`/geocode?q=${encodeURIComponent(term)}`);
        setResults(found);
        if (found.length === 0) setError("Nada encontrado. Você pode preencher à mão.");
      } catch {
        setError("A busca falhou. Preencha à mão, por favor.");
        setManual(true);
      } finally {
        setSearching(false);
      }
    }, 600);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [term]);

  function choose(result: GeocodeResult) {
    onChange({
      ...value,
      street: result.street ?? term,
      number: result.number ?? value.number,
      district: result.district ?? "",
      city: result.city ?? "",
      state: result.state ?? "",
      postal_code: result.postal_code ?? "",
      lat: result.lat,
      lng: result.lng,
    });
    setResults([]);
    setTerm("");
    setManual(true);
  }

  const preenchido = value.street && value.city && value.state;

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-neutral-400" />
        <p className="font-semibold">{title}</p>
        {value.lat !== null && (
          <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">
            no mapa
          </span>
        )}
      </div>

      <div className="relative">
        <div className="flex gap-2">
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Digite rua, número e cidade"
            aria-label={`Buscar endereço de ${title}`}
          />
          <Button type="button" variant="outline" size="icon" disabled aria-hidden>
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
            {results.map((result) => (
              <li key={`${result.lat},${result.lng},${result.label}`}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                  onClick={() => choose(result)}
                >
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-xs text-amber-700">{error}</p>}

      {preenchido && !manual && (
        <p className="text-sm text-neutral-700">
          {value.street}
          {value.number ? `, ${value.number}` : ""} — {value.city}/{value.state}
        </p>
      )}

      {!manual && (
        <button
          type="button"
          className="text-xs text-neutral-500 underline"
          onClick={() => setManual(true)}
        >
          preencher à mão
        </button>
      )}

      {manual && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <Field
              label="Rua"
              value={value.street}
              onChange={(v) => onChange({ ...value, street: v })}
            />
            <Field
              label="Número"
              value={value.number}
              onChange={(v) => onChange({ ...value, number: v })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Bairro"
              value={value.district}
              onChange={(v) => onChange({ ...value, district: v })}
            />
            <Field
              label="Cidade"
              value={value.city}
              onChange={(v) => onChange({ ...value, city: v })}
            />
            <Field
              label="UF"
              value={value.state}
              maxLength={2}
              onChange={(v) => onChange({ ...value, state: v.toUpperCase() })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Complemento"
              value={value.complement}
              onChange={(v) => onChange({ ...value, complement: v })}
            />
            <Field
              label="Ponto de referência"
              value={value.reference}
              onChange={(v) => onChange({ ...value, reference: v })}
            />
          </div>
        </div>
      )}

      {showAccessFields && (
        <div className="space-y-3 border-t border-neutral-100 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Andar</Label>
              <Input
                inputMode="numeric"
                value={value.floor_number ?? ""}
                onChange={(event) =>
                  onChange({
                    ...value,
                    floor_number: event.target.value ? Number(event.target.value) : null,
                  })
                }
                placeholder="Térreo = 0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tem elevador?</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={value.has_elevator === true ? "default" : "outline"}
                  onClick={() => onChange({ ...value, has_elevator: true })}
                >
                  Sim
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={value.has_elevator === false ? "default" : "outline"}
                  onClick={() => onChange({ ...value, has_elevator: false })}
                >
                  Não
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Quem recebe (opcional)"
              value={value.contact_name}
              onChange={(v) => onChange({ ...value, contact_name: v })}
            />
            <Field
              label="Telefone de quem recebe"
              value={value.contact_phone}
              onChange={(v) => onChange({ ...value, contact_phone: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

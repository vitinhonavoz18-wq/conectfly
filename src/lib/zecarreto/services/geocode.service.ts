/**
 * Busca de endereço (endereço escrito → ponto no mapa).
 *
 * A FASE 3 usa o serviço gratuito do OpenStreetMap. Ele é bom para
 * começar, mas tem limite de uso e não serve para volume alto: quando a
 * plataforma crescer, troca-se o endereço em `geocode.provider_url` por um
 * serviço pago. O resto do sistema não muda.
 */

import { zcError } from "../errors";
import { getSetting } from "./settings.service";

export interface GeocodeResult {
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

interface NominatimItem {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string>;
}

const UF_BY_STATE: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapá: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceará: "CE",
  "distrito federal": "DF",
  "espírito santo": "ES",
  goiás: "GO",
  maranhão: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  pará: "PA",
  paraíba: "PB",
  paraná: "PR",
  pernambuco: "PE",
  piauí: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondônia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "são paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

function toUf(state: string | undefined): string | null {
  if (!state) return null;
  if (state.length === 2) return state.toUpperCase();
  return UF_BY_STATE[state.toLowerCase()] ?? null;
}

export async function searchAddress(params: {
  q: string;
  limit?: number;
}): Promise<GeocodeResult[]> {
  const term = params.q?.trim();
  if (!term || term.length < 4) {
    throw zcError.validation("Escreva um pouco mais do endereço para buscar.");
  }

  const providerUrl = await getSetting<string>(
    "geocode.provider_url",
    "https://nominatim.openstreetmap.org/search",
  );

  const url = new URL(providerUrl);
  url.searchParams.set("q", term);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("limit", String(Math.min(Math.max(params.limit ?? 5, 1), 10)));

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        // O serviço exige identificação de quem chama.
        "User-Agent": "ZeCarreto/1.0 (https://zecarreto.com.br)",
        Accept: "application/json",
        "Accept-Language": "pt-BR",
      },
    });
  } catch {
    throw zcError.internal("A busca de endereços está fora do ar. Digite o endereço à mão.");
  }

  if (!response.ok) {
    throw zcError.internal("A busca de endereços não respondeu. Digite o endereço à mão.");
  }

  const payload = (await response.json().catch(() => [])) as NominatimItem[];
  if (!Array.isArray(payload)) return [];

  return payload
    .map((item): GeocodeResult | null => {
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const address = item.address ?? {};
      return {
        label: item.display_name ?? "",
        street: address.road ?? address.pedestrian ?? null,
        number: address.house_number ?? null,
        district: address.suburb ?? address.neighbourhood ?? address.city_district ?? null,
        city: address.city ?? address.town ?? address.village ?? address.municipality ?? null,
        state: toUf(address.state),
        postal_code: address.postcode?.replace(/\D/g, "") ?? null,
        lat,
        lng,
      };
    })
    .filter((item): item is GeocodeResult => item !== null);
}

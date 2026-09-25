import { onlyDigits } from "@/lib/utils";

export type ViaCepAddress = {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
};

export type ViaCepResult =
  | { ok: true; address: ViaCepAddress }
  | { ok: false; error: string };

/** Consulta de endereço por CEP com tratamento explícito de erros. */
export async function lookupCep(rawCep: string): Promise<ViaCepResult> {
  const cep = onlyDigits(rawCep);

  if (cep.length !== 8) {
    return { ok: false, error: "CEP deve conter 8 dígitos" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { ok: false, error: "Não foi possível consultar o CEP agora" };
    }

    const data = (await response.json()) as Record<string, string | boolean>;

    if (data.erro) {
      return { ok: false, error: "CEP não encontrado" };
    }

    return {
      ok: true,
      address: {
        cep: String(data.cep ?? rawCep),
        street: String(data.logradouro ?? ""),
        district: String(data.bairro ?? ""),
        city: String(data.localidade ?? ""),
        state: String(data.uf ?? ""),
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, error: "A consulta do CEP demorou demais. Preencha manualmente." };
    }
    return { ok: false, error: "Falha de conexão ao consultar o CEP" };
  }
}

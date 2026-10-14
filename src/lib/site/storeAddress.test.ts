import { describe, expect, it } from "vitest";
import {
  looksLikeStoreAddress,
  normalizeStoreAddress,
  storeAddressFormatProblem,
  storeAddressPolicyProblem,
  storeAddressVariations,
  storeRedirectTarget,
  STORE_ADDRESS_MAX,
} from "./storeAddress";

/**
 * Regra do endereço que a loja escolhe (conectfly.com.br/<endereço>).
 *
 * O FlyControl tem uma cópia desta regra para a tela responder na hora, e um
 * teste com os MESMOS exemplos (src/lib/site/enderecoDaLoja.test.ts lá). Se um
 * lado mudar e o outro não, a tela diria "disponível" para um nome que o site
 * recusa — mudou aqui, mude lá.
 */

describe("normalização do endereço", () => {
  it.each([
    ["Açaí e Love", "acai-e-love"],
    ["AÇAI E LOVE ", "acai-e-love"],
    ["  Pizza   da Nonna!! ", "pizza-da-nonna"],
    ["D’Lua Doces", "dlua-doces"],
    ["acai_e.love", "acai-e-love"],
    ["--acai--love--", "acai-love"],
    ["Pão & Cia", "pao-cia"],
    ["acaielove", "acaielove"],
    ["ÇÃÕÉ", "caoe"],
    ["", ""],
  ])("%j vira %j", (entrada, saida) => {
    expect(normalizeStoreAddress(entrada)).toBe(saida);
  });

  it("corta no tamanho máximo sem deixar traço no fim", () => {
    const longo = normalizeStoreAddress("a".repeat(39) + " bcd");
    expect(longo.length).toBeLessThanOrEqual(STORE_ADDRESS_MAX);
    expect(longo.endsWith("-")).toBe(false);
  });
});

describe("formato do endereço", () => {
  it("aceita letras, números e traço no meio", () => {
    expect(storeAddressFormatProblem("acai-e-love")).toBeNull();
    expect(storeAddressFormatProblem("acaielove2")).toBeNull();
    expect(storeAddressFormatProblem("123")).toBeNull();
  });

  it("recusa curto, longo e caracteres fora da regra", () => {
    expect(storeAddressFormatProblem("ab")).toBe("too_short");
    expect(storeAddressFormatProblem("a".repeat(41))).toBe("too_long");
    expect(storeAddressFormatProblem("-acai")).toBe("invalid_format");
    expect(storeAddressFormatProblem("acai-")).toBe("invalid_format");
    expect(storeAddressFormatProblem("acai--love")).toBe("invalid_format");
    expect(storeAddressFormatProblem("Acai")).toBe("invalid_format");
    expect(storeAddressFormatProblem("açai")).toBe("invalid_format");
  });
});

describe("nomes bloqueados", () => {
  it.each([
    "admin",
    "api",
    "login",
    "checkout",
    "edit",
    "export",
    "debug-host",
    "mesa",
    "dashboard",
  ])("%s é página do sistema", (nome) => {
    expect(storeAddressPolicyProblem(nome)).toBe("reserved");
  });

  it.each(["teste", "teste-001", "teste-001-5srj", "teste001"])(
    "%s é endereço de teste",
    (nome) => {
      expect(storeAddressPolicyProblem(nome)).toBe("test_pattern");
    },
  );

  it("palavras que só começam parecido continuam liberadas", () => {
    expect(storeAddressPolicyProblem("testemunha-burguer")).toBeNull();
    expect(storeAddressPolicyProblem("acaielove")).toBeNull();
    expect(storeAddressPolicyProblem("apiario")).toBeNull();
  });
});

describe("variações sugeridas", () => {
  it("oferece variações válidas e diferentes do nome pedido", () => {
    const v = storeAddressVariations("acaielove", { city: "Salvador, BA" });
    expect(v).toContain("acaielove-salvador");
    expect(v).toContain("acaielove-2");
    expect(v).not.toContain("acaielove");
    for (const s of v) {
      expect(storeAddressFormatProblem(s)).toBeNull();
      expect(storeAddressPolicyProblem(s)).toBeNull();
    }
  });

  it("para nome com traço, sugere também a versão sem traço", () => {
    expect(storeAddressVariations("acai-e-love")).toContain("acaielove");
  });
});

describe("redirecionamento para o endereço atual", () => {
  const loja = { slug: "teste-001-5srj", custom_subdomain: "acaielove" };

  it("endereço longo antigo leva ao nome atual", () => {
    expect(storeRedirectTarget("teste-001-5srj", loja)).toBe("acaielove");
  });

  it("nome antigo leva ao nome atual", () => {
    expect(storeRedirectTarget("acai-love-antigo", loja)).toBe("acaielove");
  });

  it("já no endereço atual: não redireciona (sem laço)", () => {
    expect(storeRedirectTarget("acaielove", loja)).toBeNull();
    expect(storeRedirectTarget("ACAIELOVE", loja)).toBeNull();
  });

  it("loja sem nome curto fica no endereço longo", () => {
    expect(
      storeRedirectTarget("minha-loja", { slug: "minha-loja", custom_subdomain: null }),
    ).toBeNull();
  });
});

describe("o que pode chegar ao banco vindo da barra de endereço", () => {
  it("só letras, números e traço", () => {
    expect(looksLikeStoreAddress("acaielove")).toBe(true);
    expect(looksLikeStoreAddress("teste-001-5srj")).toBe(true);
    expect(looksLikeStoreAddress("x,published.eq.false")).toBe(false);
    expect(looksLikeStoreAddress("a)b")).toBe(false);
    expect(looksLikeStoreAddress("")).toBe(false);
  });
});

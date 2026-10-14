import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addressIsFree,
  checkStoreAddress,
  setStoreAddress,
  type AddressDb,
  type StoreRow,
} from "./storeAddress.server";

/**
 * Banco de mentira que se comporta como o de verdade NAQUILO que importa
 * aqui: o caderno `store_addresses` com um dono por endereço, e o gatilho
 * que recusa (erro 23505) a troca para um nome que já tem outro dono.
 *
 * O teste do banco de verdade (Postgres, duas gravações ao mesmo tempo) foi
 * feito à parte com a migração 20261014120000 — ver o relatório da tarefa.
 */
function fakeDb(lojas: StoreRow[]) {
  const restaurants = new Map(lojas.map((l) => [l.id, { ...l }]));
  const caderno = new Map<string, string>();
  for (const l of lojas) {
    caderno.set(l.slug, l.id);
    if (l.custom_subdomain) caderno.set(l.custom_subdomain, l.id);
  }
  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  /** Simula outra loja salvando o nome entre a conferência e a gravação. */
  let antesDeGravar: (() => void) | null = null;

  const db: AddressDb = {
    from(table: string) {
      const filtros: Record<string, string> = {};
      let ou: string | null = null;
      let patch: Record<string, unknown> | null = null;
      const q: any = {
        select: () => q,
        eq: (col: string, val: string) => {
          filtros[col] = val;
          if (patch) return executarUpdate();
          return q;
        },
        or: (expr: string) => {
          ou = expr;
          return q;
        },
        limit: async () => {
          const [a, b] = (ou ?? "").split(",").map((p) => p.split(".eq.")[1]);
          const achou = [...restaurants.values()].filter(
            (r) => r.custom_subdomain === a || r.slug === b,
          );
          return { data: achou.map((r) => ({ id: r.id })), error: null };
        },
        maybeSingle: async () => {
          if (table === "store_addresses") {
            const dono = caderno.get(filtros.address);
            return { data: dono ? { restaurant_id: dono } : null, error: null };
          }
          return { data: null, error: null };
        },
        update: (p: Record<string, unknown>) => {
          patch = p;
          return q;
        },
      };
      const executarUpdate = async () => {
        antesDeGravar?.();
        const id = filtros.id;
        const novo = String(patch!.custom_subdomain);
        const dono = caderno.get(novo);
        if (dono && dono !== id) {
          return { error: { code: "23505", message: "store_address_taken" } };
        }
        caderno.set(novo, id);
        restaurants.get(id)!.custom_subdomain = novo;
        updates.push({ id, patch: patch! });
        return { error: null };
      };
      return q;
    },
  };

  return {
    db,
    restaurants,
    caderno,
    updates,
    setAntesDeGravar: (fn: () => void) => (antesDeGravar = fn),
  };
}

const ACAI: StoreRow = {
  id: "acai",
  slug: "teste-001-5srj",
  custom_subdomain: "acaielove",
  city: "Salvador",
};
const OUTRA: StoreRow = {
  id: "outra",
  slug: "outra-loja",
  custom_subdomain: "outraloja",
  city: null,
};

describe("disponibilidade do endereço", () => {
  it("nome livre aparece como disponível", async () => {
    const { db } = fakeDb([ACAI, OUTRA]);
    expect((await checkStoreAddress(db, OUTRA, "Pizza da Nonna")).status).toBe("available");
  });

  it("nome de outra loja aparece como ocupado, com variações livres", async () => {
    const { db } = fakeDb([ACAI, OUTRA]);
    const r = await checkStoreAddress(db, OUTRA, "acaielove");
    expect(r.status).toBe("taken");
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.suggestions).not.toContain("acaielove");
  });

  it("o endereço longo de outra loja também está ocupado", async () => {
    const { db } = fakeDb([ACAI, OUTRA]);
    expect((await checkStoreAddress(db, OUTRA, "outra")).status).toBe("available");
    expect((await checkStoreAddress(db, ACAI, "outra-loja")).status).toBe("taken");
  });

  it("o nome atual da própria loja aparece como 'é o seu'", async () => {
    const { db } = fakeDb([ACAI]);
    expect((await checkStoreAddress(db, ACAI, "AcaieLove")).status).toBe("current");
  });

  it("formato inválido, reservado e teste são barrados", async () => {
    const { db } = fakeDb([ACAI]);
    expect((await checkStoreAddress(db, ACAI, "ab")).status).toBe("too_short");
    expect((await checkStoreAddress(db, ACAI, "admin")).status).toBe("reserved");
    expect((await checkStoreAddress(db, ACAI, "teste-002")).status).toBe("test_pattern");
  });

  it("a loja pode voltar a um endereço que já foi dela", async () => {
    const { db } = fakeDb([ACAI]);
    // "teste-001-5srj" é o endereço longo da própria loja.
    expect((await checkStoreAddress(db, ACAI, "teste-001-5srj")).status).toBe("yours");
  });
});

describe("troca do endereço", () => {
  it("salva o nome novo e o antigo continua da loja", async () => {
    const f = fakeDb([ACAI, OUTRA]);
    const r = await setStoreAddress(f.db, ACAI, "acai-e-love");
    expect(r).toMatchObject({
      ok: true,
      address: "acai-e-love",
      previous: "acaielove",
      public_url: "https://conectfly.com.br/acai-e-love",
    });
    expect(f.caderno.get("acaielove")).toBe("acai");
    expect(f.caderno.get("acai-e-love")).toBe("acai");
  });

  it("outra loja não consegue pegar o nome antigo logo depois", async () => {
    const f = fakeDb([ACAI, OUTRA]);
    await setStoreAddress(f.db, ACAI, "acai-e-love");
    const outra = { ...OUTRA };
    const r = await setStoreAddress(f.db, outra, "acaielove");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe("taken");
    expect(f.restaurants.get("outra")!.custom_subdomain).toBe("outraloja");
  });

  it("duas lojas ao mesmo tempo: quem grava primeiro fica, a outra recebe 'em uso'", async () => {
    const f = fakeDb([ACAI, OUTRA]);
    // A conferência da OUTRA diz "livre"; antes de ela gravar, o Açaí grava.
    f.setAntesDeGravar(() => {
      f.caderno.set("disputado", "acai");
      f.setAntesDeGravar(() => {});
    });
    const r = await setStoreAddress(f.db, OUTRA, "disputado");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe("taken");
    expect(f.caderno.get("disputado")).toBe("acai");
  });

  it("só mexe na loja informada", async () => {
    const f = fakeDb([ACAI, OUTRA]);
    await setStoreAddress(f.db, OUTRA, "outra-nova");
    expect(f.updates).toEqual([{ id: "outra", patch: { custom_subdomain: "outra-nova" } }]);
    expect(f.restaurants.get("acai")!.custom_subdomain).toBe("acaielove");
  });

  it("salvar o mesmo nome não grava nada", async () => {
    const f = fakeDb([ACAI]);
    const r = await setStoreAddress(f.db, ACAI, "acaielove");
    expect(r).toMatchObject({ ok: true, changed: false });
    expect(f.updates).toHaveLength(0);
  });

  it("nome inválido não chega a ser gravado", async () => {
    const f = fakeDb([ACAI]);
    const r = await setStoreAddress(f.db, ACAI, "login");
    expect(r.ok).toBe(false);
    expect(f.updates).toHaveLength(0);
  });
});

describe("cadastro automático respeita nomes antigos de outras lojas", () => {
  it("nome antigo continua ocupado para loja nova", async () => {
    const f = fakeDb([ACAI]);
    await setStoreAddress(f.db, ACAI, "acai-e-love");
    expect(await addressIsFree(f.db, "acaielove")).toBe(false);
    expect(await addressIsFree(f.db, "loja-nova")).toBe(true);
  });
});

describe("porta do endereço interno", () => {
  const codigo = readFileSync(
    join(process.cwd(), "src/routes/api/internal/store-address.ts"),
    "utf8",
  );

  it("exige a senha de servidor antes de qualquer consulta ou gravação", () => {
    const senha = codigo.indexOf("FL_PROVISION_SECRET");
    const primeiraConsulta = codigo.indexOf('.from("restaurants")');
    expect(senha).toBeGreaterThan(0);
    expect(primeiraConsulta).toBeGreaterThan(senha);
    expect(codigo).toContain('"unauthorized" }, 401');
  });

  it("acha a loja pelo vínculo com o FlyControl, nunca por id vindo do corpo", () => {
    expect(codigo).toContain('.eq("flycontrol_id", flycontrol_id)');
    expect(codigo).not.toMatch(/body\?\.restaurant_id/);
  });
});

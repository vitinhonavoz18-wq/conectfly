import { describe, expect, it } from "vitest";
import { horarioLegivel } from "./capaDaLoja";

describe("horarioLegivel", () => {
  it("tira os colchetes vazios que o painel deixa na frente", () => {
    expect(horarioLegivel("[]14:30 as 22:00")).toBe("14:30 as 22:00");
  });

  it("mantém o texto do lojista quando não há sujeira", () => {
    expect(horarioLegivel("Seg a Sáb, 18h às 23h")).toBe("Seg a Sáb, 18h às 23h");
  });

  it("não mexe em colchetes com conteúdo", () => {
    expect(horarioLegivel("[Seg] 18h às 23h")).toBe("[Seg] 18h às 23h");
  });

  it("devolve nulo quando não sobra nada", () => {
    expect(horarioLegivel("[]")).toBeNull();
    expect(horarioLegivel("   ")).toBeNull();
    expect(horarioLegivel(null)).toBeNull();
    expect(horarioLegivel(undefined)).toBeNull();
  });
});

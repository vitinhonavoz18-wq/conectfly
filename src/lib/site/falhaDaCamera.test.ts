import { describe, expect, it } from "vitest";
import { tipoDaFalha } from "./falhaDaCamera";

describe("tipoDaFalha", () => {
  it("permissão negada", () => {
    expect(tipoDaFalha({ name: "NotAllowedError", message: "Permission denied" })).toBe(
      "permissao",
    );
  });

  it("aparelho sem câmera", () => {
    expect(tipoDaFalha({ name: "NotFoundError", message: "Requested device not found" })).toBe(
      "sem-camera",
    );
  });

  it("câmera presa em outro app", () => {
    expect(tipoDaFalha({ name: "NotReadableError", message: "Could not start video source" })).toBe(
      "ocupada",
    );
  });

  it("erro em texto puro também é entendido", () => {
    expect(tipoDaFalha("NotAllowedError: Permission denied")).toBe("permissao");
  });

  it("sem HTTPS vence qualquer outro motivo", () => {
    expect(tipoDaFalha({ name: "NotAllowedError" }, false)).toBe("inseguro");
  });

  it("erro desconhecido não quebra", () => {
    expect(tipoDaFalha(undefined)).toBe("outra");
    expect(tipoDaFalha({ name: "Algo" })).toBe("outra");
  });
});

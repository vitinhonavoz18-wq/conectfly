import { describe, expect, test } from "bun:test";
import {
  maskCnh,
  maskCpf,
  maskCnpj,
  maskDocumentNumber,
  maskDriver,
  maskEmail,
  maskFor,
  maskGeneric,
  maskPhone,
  maskPixKey,
  maskProfile,
} from "../domain/masking";

describe("mascaramento de dados sensíveis", () => {
  test("CPF mostra só o miolo", () => {
    expect(maskCpf("52998224725")).toBe("***.982.247-**");
    expect(maskCpf("529.982.247-25")).toBe("***.982.247-**");
  });

  test("CNPJ esconde início e fim", () => {
    expect(maskCnpj("11222333000181")).toBe("**.222.333/0001-**");
  });

  test("escolhe sozinho entre CPF e CNPJ", () => {
    expect(maskDocumentNumber("52998224725")).toBe("***.982.247-**");
    expect(maskDocumentNumber("11222333000181")).toBe("**.222.333/0001-**");
  });

  test("telefone mantém DDD e os 4 finais", () => {
    expect(maskPhone("11999990001")).toBe("(11) *****-0001");
    expect(maskPhone("1133330001")).toBe("(11) ****-0001");
  });

  test("e-mail mostra as duas primeiras letras e o domínio", () => {
    expect(maskEmail("maria@gmail.com")).toBe("ma***@gmail.com");
    expect(maskEmail("jo@dominio.com.br")).toBe("jo*@dominio.com.br");
  });

  test("CNH mostra só os 4 últimos", () => {
    expect(maskCnh("12345678901")).toBe("*******8901");
  });

  test("chave PIX segue o tipo dela", () => {
    expect(maskPixKey("52998224725", "cpf")).toBe("***.982.247-**");
    expect(maskPixKey("maria@gmail.com", "email")).toBe("ma***@gmail.com");
    expect(maskPixKey("11999990001", "phone")).toBe("(11) *****-0001");
    expect(maskPixKey("abcdef123456", "random")).toBe("********3456");
  });

  test("valor vazio continua vazio (não vira '****')", () => {
    expect(maskCpf(null)).toBeNull();
    expect(maskPhone("")).toBeNull();
    expect(maskGeneric(undefined)).toBeNull();
  });

  test("nada sensível escapa no perfil mascarado", () => {
    const masked = maskProfile({
      full_name: "Maria Souza",
      document_number: "52998224725",
      phone: "11999990001",
      email: "maria@gmail.com",
    });
    const serialized = JSON.stringify(masked);
    expect(serialized).not.toContain("52998224725");
    expect(serialized).not.toContain("11999990001");
    expect(serialized).not.toContain("maria@gmail.com");
    // O nome continua visível — não é dado sensível.
    expect(masked.full_name).toBe("Maria Souza");
  });

  test("motorista mascarado esconde CNH, PIX e conta bancária", () => {
    const masked = maskDriver({
      cnh_number: "12345678901",
      pix_key: "52998224725",
      pix_key_type: "cpf",
      bank_account: { bank_name: "Banco X", agency: "0001", account: "123456789" },
    });
    const serialized = JSON.stringify(masked);
    expect(serialized).not.toContain("12345678901");
    expect(serialized).not.toContain("123456789");
    expect(masked.cnh_number).toBe("*******8901");
  });

  test("o dono vê o próprio dado inteiro", () => {
    const profile = { document_number: "52998224725", phone: "11999990001", email: "a@b.com" };
    expect(maskFor(profile, true).document_number).toBe("52998224725");
    expect(maskFor(profile, false).document_number).toBe("***.982.247-**");
  });
});

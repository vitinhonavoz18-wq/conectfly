import { describe, expect, test } from "bun:test";
import {
  isValidCnpj,
  isValidCpf,
  plateSchema,
  phoneSchema,
  quoteRequestSchema,
  stopsListSchema,
} from "../validation";

const pickup = { kind: "pickup" as const, street: "Rua A", city: "São Paulo", state: "SP" };
const dropoff = { kind: "dropoff" as const, street: "Rua B", city: "São Paulo", state: "SP" };
const middle = { kind: "stop" as const, street: "Rua C", city: "São Paulo", state: "SP" };

describe("conferência dos dados de entrada", () => {
  test("roteiro precisa começar na retirada e terminar na entrega", () => {
    expect(stopsListSchema.safeParse([pickup, dropoff]).success).toBe(true);
    expect(stopsListSchema.safeParse([pickup, middle, dropoff]).success).toBe(true);
    expect(stopsListSchema.safeParse([dropoff, pickup]).success).toBe(false);
    expect(stopsListSchema.safeParse([pickup]).success).toBe(false);
    expect(stopsListSchema.safeParse([pickup, dropoff, middle]).success).toBe(false);
  });

  test("agendado sem data é recusado", () => {
    const result = quoteRequestSchema.safeParse({
      category_id: "3b1f0f4e-1a2b-4c3d-8e9f-000000000001",
      modality: "scheduled",
      stops: [pickup, dropoff],
    });
    expect(result.success).toBe(false);
  });

  test("agendamento no passado é recusado", () => {
    const result = quoteRequestSchema.safeParse({
      category_id: "3b1f0f4e-1a2b-4c3d-8e9f-000000000001",
      modality: "scheduled",
      scheduled_for: "2020-01-01T10:00:00.000Z",
      stops: [pickup, dropoff],
    });
    expect(result.success).toBe(false);
  });

  test("placa aceita padrão antigo e Mercosul", () => {
    expect(plateSchema.parse("abc-1234")).toBe("ABC1234");
    expect(plateSchema.parse("abc1d23")).toBe("ABC1D23");
    expect(plateSchema.safeParse("12345").success).toBe(false);
  });

  test("telefone exige DDD", () => {
    expect(phoneSchema.parse("(11) 99999-0001")).toBe("11999990001");
    expect(phoneSchema.safeParse("99990001").success).toBe(false);
  });

  test("CPF e CNPJ conferem o dígito verificador", () => {
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("52998224724")).toBe(false);
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("11222333000180")).toBe(false);
  });
});

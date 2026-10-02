import { formatBrDay } from "../time.ts";

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatNumbers(numbers: number[], separator = " · "): string {
  return numbers.map(pad).join(separator);
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

export { formatBrDay };

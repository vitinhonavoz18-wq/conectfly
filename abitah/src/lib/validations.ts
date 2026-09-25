import { z } from "zod";
import { onlyDigits } from "@/lib/utils";

const requiredText = (label: string, min = 2) =>
  z.string().trim().min(min, `Informe ${label}`);

export const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const phoneSchema = z
  .string()
  .trim()
  .refine((value) => onlyDigits(value).length >= 10 && onlyDigits(value).length <= 11, {
    message: "Telefone inválido — use DDD + número",
  });

export const cepSchema = z
  .string()
  .trim()
  .refine((value) => onlyDigits(value).length === 8, { message: "CEP deve ter 8 dígitos" });

/** Validação real de CPF (dígitos verificadores). */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(cpf[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export const checkoutSchema = z.object({
  fullName: requiredText("seu nome completo", 5).refine(
    (value) => value.split(/\s+/).length >= 2,
    { message: "Informe nome e sobrenome" },
  ),
  cpf: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || isValidCpf(value), { message: "CPF inválido" }),
  email: z.string().trim().email("E-mail inválido"),
  phone: phoneSchema,
  shippingMethod: z.enum(["standard", "express", "pickup"]),
  cep: z.string().trim().optional(),
  street: z.string().trim().optional(),
  number: z.string().trim().optional(),
  complement: z.string().trim().optional(),
  district: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  notes: z.string().trim().max(500, "Máximo de 500 caracteres").optional(),
  acceptTerms: z.literal(true, { message: "É necessário aceitar os termos" }),
}).superRefine((data, ctx) => {
  // Endereço só é obrigatório quando há entrega (retirada dispensa).
  if (data.shippingMethod === "pickup") return;
  const required: [keyof typeof data, string][] = [
    ["cep", "Informe o CEP"],
    ["street", "Informe a rua"],
    ["number", "Informe o número"],
    ["district", "Informe o bairro"],
    ["city", "Informe a cidade"],
    ["state", "Informe o estado"],
  ];
  required.forEach(([field, message]) => {
    if (!String(data[field] ?? "").trim()) {
      ctx.addIssue({ code: "custom", path: [field], message });
    }
  });
  if (data.cep && onlyDigits(data.cep).length !== 8) {
    ctx.addIssue({ code: "custom", path: ["cep"], message: "CEP deve ter 8 dígitos" });
  }
});

export type CheckoutFormValues = z.input<typeof checkoutSchema>;

export const contactSchema = z.object({
  name: requiredText("seu nome", 3),
  email: z.string().trim().email("E-mail inválido"),
  phone: phoneSchema,
  subject: requiredText("o assunto", 3),
  message: z.string().trim().min(15, "Escreva ao menos 15 caracteres").max(1000),
});

export type ContactFormValues = z.infer<typeof contactSchema>;

export const newsletterSchema = z.object({
  name: requiredText("seu nome", 3),
  email: z.string().trim().email("E-mail inválido"),
  whatsapp: phoneSchema,
});

export type NewsletterFormValues = z.infer<typeof newsletterSchema>;

export const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
});

export const signUpSchema = z
  .object({
    fullName: requiredText("seu nome completo", 5),
    email: z.string().trim().email("E-mail inválido"),
    phone: phoneSchema,
    password: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { message: "É necessário aceitar os termos" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
  });

export const profileSchema = z.object({
  fullName: requiredText("seu nome completo", 5),
  phone: phoneSchema,
  cpf: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || isValidCpf(value), { message: "CPF inválido" }),
});

export const addressSchema = z.object({
  label: requiredText("um apelido para o endereço", 2),
  recipient: requiredText("o nome de quem recebe", 3),
  cep: cepSchema,
  street: requiredText("a rua"),
  number: requiredText("o número", 1),
  complement: z.string().trim().optional(),
  district: requiredText("o bairro"),
  city: requiredText("a cidade"),
  state: z.enum(brazilianStates, { message: "Selecione o estado" }),
  isDefault: z.boolean().optional(),
});

export type AddressFormValues = z.input<typeof addressSchema>;

export const productSchema = z.object({
  name: requiredText("o nome do produto", 3),
  slug: z
    .string()
    .trim()
    .min(3, "Informe o slug")
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífens"),
  shortDescription: z.string().trim().min(10, "Descrição curta muito curta").max(180),
  description: z.string().trim().min(30, "Descreva o produto com mais detalhes"),
  categorySlug: requiredText("a categoria", 1),
  subcategory: z.string().trim().optional(),
  price: z.coerce.number<number>().positive("Preço deve ser maior que zero"),
  salePrice: z.coerce.number<number>().nonnegative().optional(),
  costPrice: z.coerce.number<number>().nonnegative().optional(),
  sku: requiredText("o SKU", 2),
  barcode: z.string().trim().optional(),
  material: z.string().trim().min(3, "Informe o material"),
  care: z.string().trim().optional(),
  sizes: z.string().trim().min(1, "Informe ao menos um tamanho"),
  colors: z.string().trim().min(1, "Informe ao menos uma cor"),
  stock: z.coerce.number<number>().int().nonnegative(),
  weightGrams: z.coerce.number<number>().nonnegative(),
  heightCm: z.coerce.number<number>().nonnegative(),
  widthCm: z.coerce.number<number>().nonnegative(),
  lengthCm: z.coerce.number<number>().nonnegative(),
  isFeatured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type ProductFormValues = z.input<typeof productSchema>;

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Informe o código")
    .regex(/^[A-Z0-9]+$/, "Use letras maiúsculas e números"),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number<number>().positive("Valor deve ser maior que zero"),
  minOrderValue: z.coerce.number<number>().nonnegative(),
  description: z.string().trim().min(5, "Descreva o cupom"),
  active: z.boolean().optional(),
});

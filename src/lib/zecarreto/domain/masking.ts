/**
 * Mascaramento de dados sensíveis.
 *
 * Regra da casa: o DONO do dado vê o dado inteiro (foi ele quem digitou).
 * Todo mundo mais — inclusive o administrador na listagem — vê mascarado.
 * Quando o administrador precisa mesmo conferir um CPF, ele pede para
 * revelar, e essa consulta fica registrada na auditoria.
 *
 * É a mesma ideia do comprovante do cartão: aparece só o final do número,
 * o suficiente para conferir, nunca o bastante para copiar.
 */

const onlyDigits = (value: string) => value.replace(/\D/g, "");

export function maskCpf(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = onlyDigits(value);
  if (digits.length !== 11) return maskGeneric(value);
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

export function maskCnpj(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = onlyDigits(value);
  if (digits.length !== 14) return maskGeneric(value);
  return `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-**`;
}

/** CPF ou CNPJ, escolhendo sozinho pelo tamanho. */
export function maskDocumentNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = onlyDigits(value);
  if (digits.length === 14) return maskCnpj(digits);
  return maskCpf(digits);
}

export function maskPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = onlyDigits(value);
  if (digits.length < 8) return maskGeneric(value);
  const ddd = digits.slice(0, 2);
  const last = digits.slice(-4);
  const hidden = "*".repeat(Math.max(0, digits.length - 6));
  return `(${ddd}) ${hidden}-${last}`;
}

export function maskEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const [user, domain] = value.split("@");
  if (!domain) return maskGeneric(value);
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${"*".repeat(Math.max(1, user.length - visible.length))}@${domain}`;
}

export function maskCnh(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = onlyDigits(value);
  if (digits.length < 5) return maskGeneric(value);
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random" | null | undefined;

export function maskPixKey(value: string | null | undefined, type: PixKeyType): string | null {
  if (!value) return null;
  switch (type) {
    case "cpf":
      return maskCpf(value);
    case "cnpj":
      return maskCnpj(value);
    case "email":
      return maskEmail(value);
    case "phone":
      return maskPhone(value);
    default:
      return maskGeneric(value);
  }
}

/** Último recurso: mostra só os 4 últimos caracteres. */
export function maskGeneric(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return "*".repeat(value.length);
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}

export interface MaskableProfile {
  document_number?: string | null;
  phone?: string | null;
  email?: string | null;
  [key: string]: unknown;
}

/** Devolve uma CÓPIA do perfil com os campos sensíveis mascarados. */
export function maskProfile<T extends MaskableProfile>(profile: T): T {
  return {
    ...profile,
    document_number: maskDocumentNumber(profile.document_number ?? null),
    phone: maskPhone(profile.phone ?? null),
    email: maskEmail(profile.email ?? null),
  };
}

export interface MaskableDriver {
  cnh_number?: string | null;
  pix_key?: string | null;
  pix_key_type?: string | null;
  bank_account?: unknown;
  [key: string]: unknown;
}

export function maskDriver<T extends MaskableDriver>(driver: T): T {
  const bank = driver.bank_account as Record<string, unknown> | null | undefined;
  return {
    ...driver,
    cnh_number: maskCnh(driver.cnh_number ?? null),
    pix_key: maskPixKey(driver.pix_key ?? null, driver.pix_key_type as PixKeyType),
    bank_account: bank
      ? {
          ...bank,
          account: bank.account ? maskGeneric(String(bank.account)) : undefined,
          agency: bank.agency ?? undefined,
          bank_name: bank.bank_name ?? undefined,
        }
      : bank,
  };
}

/**
 * Aplica ou não o mascaramento conforme quem está olhando.
 * `isOwner` verdadeiro devolve o dado inteiro.
 */
export function maskFor<T extends MaskableProfile>(profile: T, isOwner: boolean): T {
  return isOwner ? profile : maskProfile(profile);
}

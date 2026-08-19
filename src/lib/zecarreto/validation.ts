/**
 * Conferência dos dados que chegam de fora.
 *
 * É o porteiro conferindo a lista antes de deixar entrar: se o pedido vem
 * sem CEP, com cinco mil ajudantes ou com uma nota de 11 estrelas, ele
 * para aqui — não chega ao banco nem vira corrida.
 */

import { z } from "zod";
import {
  ZC_CANCEL_ACTORS,
  ZC_ROLES,
  ZC_VEHICLE_STATUSES,
  ZC_DOCUMENT_TYPES,
  ZC_DRIVER_AVAILABILITIES,
  ZC_NOTIFICATION_CHANNELS,
  ZC_PAYMENT_METHODS,
  ZC_RATING_DIRECTIONS,
  ZC_RIDE_MODALITIES,
  ZC_RIDE_STATUSES,
  ZC_STOP_KINDS,
  ZC_TICKET_PRIORITIES,
  ZC_TICKET_STATUSES,
} from "./domain/enums";

export const uuidSchema = z.string().uuid("Identificador inválido.");

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Telefone brasileiro só com dígitos: 10 (fixo) ou 11 (celular). */
export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length === 10 || value.length === 11, {
    message: "Telefone precisa ter DDD + número (10 ou 11 dígitos).",
  });

export const plateSchema = z
  .string()
  .transform((value) => value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
  .refine((value) => /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(value), {
    message: "Placa inválida. Use o formato ABC1D23 ou ABC1234.",
  });

/** CPF ou CNPJ apenas com dígitos, com verificação do dígito verificador. */
export const documentNumberSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => isValidCpf(value) || isValidCnpj(value), {
    message: "CPF ou CNPJ inválido.",
  });

export function isValidCpf(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (size: number) => {
    let sum = 0;
    for (let i = 0; i < size; i += 1) sum += Number(digits[i]) * (size + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

export function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const calc = (size: number) => {
    const weights =
      size === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < size; i += 1) sum += Number(digits[i]) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(digits[12]) && calc(13) === Number(digits[13]);
}

export const addressSchema = z.object({
  street: z.string().min(3, "Informe a rua."),
  number: z.string().max(20).optional().nullable(),
  complement: z.string().max(120).optional().nullable(),
  district: z.string().max(120).optional().nullable(),
  city: z.string().min(2, "Informe a cidade."),
  state: z.string().length(2, "UF precisa ter 2 letras.").toUpperCase(),
  postal_code: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || v.length === 8, { message: "CEP precisa ter 8 dígitos." })
    .optional(),
  country: z.string().length(2).default("BR"),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  reference: z.string().max(240).optional().nullable(),
});

export const stopInputSchema = addressSchema.extend({
  kind: z.enum(ZC_STOP_KINDS),
  contact_name: z.string().max(120).optional().nullable(),
  contact_phone: z.string().max(20).optional().nullable(),
  instructions: z.string().max(500).optional().nullable(),
  floor_number: z.number().int().min(-5).max(100).optional().nullable(),
  has_elevator: z.boolean().optional().nullable(),
});

/**
 * As paradas precisam começar em retirada, terminar em entrega e ter
 * paradas intermediárias só no meio — como um roteiro de entrega escrito
 * na ordem certa.
 */
export const stopsListSchema = z
  .array(stopInputSchema)
  .min(2, "Um carreto precisa de pelo menos um ponto de retirada e um de entrega.")
  .max(10, "Limite de 10 paradas por carreto.")
  .superRefine((stops, ctx) => {
    if (stops[0]?.kind !== "pickup") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A primeira parada precisa ser a retirada.",
      });
    }
    if (stops[stops.length - 1]?.kind !== "dropoff") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A última parada precisa ser a entrega.",
      });
    }
    stops.slice(1, -1).forEach((stop, index) => {
      if (stop.kind !== "stop") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `A parada ${index + 2} precisa ser uma parada intermediária.`,
        });
      }
    });
  });

/**
 * Adicionais escolhidos: só o CÓDIGO e a quantidade.
 * O preço nunca vem da tela — quem sabe quanto custa é o cadastro.
 */
export const addonSelectionSchema = z.object({
  code: z.string().min(2).max(40),
  quantity: z.number().int().min(1).max(50).default(1),
});

/** Itens que o cliente marcou ("geladeira", "10 caixas"). */
export const itemSelectionSchema = z.object({
  code: z.string().min(2).max(40),
  quantity: z.number().int().min(1).max(200).default(1),
});

export const quoteRequestSchema = z
  .object({
    category_id: uuidSchema,
    region_id: uuidSchema.optional(),
    modality: z.enum(ZC_RIDE_MODALITIES),
    scheduled_for: z.string().datetime({ offset: true }).optional(),
    helpers_count: z.number().int().min(0).max(6).default(0),
    stops: stopsListSchema,
    addons: z.array(addonSelectionSchema).max(12).default([]),
    items: z.array(itemSelectionSchema).max(40).default([]),
    /** Quando o app já sabe a rota (mapa), manda pronta. Senão calculamos. */
    distance_meters: z.number().int().min(0).max(2_000_000).optional(),
    duration_seconds: z.number().int().min(0).max(86_400).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.modality === "scheduled" && !value.scheduled_for) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduled_for"],
        message: "Carreto agendado precisa de data e hora.",
      });
    }
    if (value.scheduled_for && new Date(value.scheduled_for).getTime() < Date.now() - 60_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduled_for"],
        message: "A data do agendamento já passou.",
      });
    }
  });

export const createRideSchema = quoteRequestSchema.and(
  z.object({
    quote_id: uuidSchema.optional(),
    cargo_description: z.string().max(1000).optional(),
    items_description: z.string().max(1000).optional(),
    notes: z.string().max(1000).optional(),
    cargo_photos: z.array(z.string().max(500)).max(10).optional(),
    idempotency_key: z.string().min(8).max(120).optional(),
  }),
);

/** "Não sei qual escolher": manda os itens, recebe a sugestão. */
export const recommendationRequestSchema = z.object({
  items: z.array(itemSelectionSchema).min(1, "Marque pelo menos um item.").max(40),
});

export const addonUpsertSchema = z.object({
  id: uuidSchema.optional(),
  code: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _."),
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional(),
  region_id: uuidSchema.nullable().optional(),
  category_id: uuidSchema.nullable().optional(),
  pricing_mode: z.enum(["fixed", "per_unit", "per_floor", "percent"]),
  amount_cents: z.number().int().min(0).max(1_000_000).default(0),
  percent: z.number().min(0).max(100).default(0),
  max_quantity: z.number().int().min(1).max(50).default(1),
  requires_quantity: z.boolean().default(false),
  icon: z.string().max(40).optional(),
  sort_order: z.number().int().min(0).max(999).default(0),
  active: z.boolean().default(true),
});

export const rideTransitionSchema = z.object({
  to: z.enum(ZC_RIDE_STATUSES),
  reason: z.string().max(500).optional(),
});

export const cancelRideSchema = z.object({
  reason: z.string().min(3, "Conte o motivo do cancelamento.").max(500),
  by: z.enum(ZC_CANCEL_ACTORS).optional(),
});

export const offerResponseSchema = z.object({
  action: z.enum(["accept", "decline"]),
  vehicle_id: uuidSchema.optional(),
  reason: z.string().max(240).optional(),
});

export const locationPingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed_kmh: z.number().min(0).max(300).optional(),
  accuracy_m: z.number().min(0).max(10_000).optional(),
  ride_id: uuidSchema.optional(),
  recorded_at: z.string().datetime({ offset: true }).optional(),
});

export const availabilitySchema = z.object({
  availability: z.enum(ZC_DRIVER_AVAILABILITIES),
});

export const vehicleSchema = z.object({
  category_id: uuidSchema,
  plate: plateSchema,
  brand: z.string().max(60).optional(),
  model: z.string().max(60).optional(),
  model_year: z
    .number()
    .int()
    .min(1950)
    .max(new Date().getFullYear() + 1)
    .optional(),
  color: z.string().max(30).optional(),
  capacity_kg: z.number().int().min(1).max(50_000).optional(),
  body_type: z.string().max(40).optional(),
  has_tarp: z.boolean().optional(),
});

export const documentUploadSchema = z.object({
  owner_kind: z.enum(["driver", "vehicle"]),
  vehicle_id: uuidSchema.optional(),
  type: z.enum(ZC_DOCUMENT_TYPES),
  storage_path: z.string().min(3),
  file_name: z.string().max(240).optional(),
  mime_type: z.string().max(120).optional(),
  issued_at: z.string().date().optional(),
  expires_at: z.string().date().optional(),
});

export const documentReviewSchema = z
  .object({
    status: z.enum(["approved", "rejected", "under_review", "expired"]),
    rejection_reason: z.string().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "rejected" && !value.rejection_reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rejection_reason"],
        message: "Informe o motivo — o motorista precisa saber o que reenviar.",
      });
    }
  });

export const driverReviewSchema = z
  .object({
    status: z.enum(["approved", "rejected", "suspended", "under_review"]),
    reason: z.string().max(500).optional(),
    suspended_until: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.status === "rejected" || value.status === "suspended") && !value.reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Informe o motivo — o motorista precisa saber o que corrigir.",
      });
    }
  });

export const paymentIntentSchema = z.object({
  method: z.enum(ZC_PAYMENT_METHODS),
  idempotency_key: z.string().min(8).max(120).optional(),
});

export const ratingSchema = z.object({
  direction: z.enum(ZC_RATING_DIRECTIONS),
  stars: z.number().int().min(1, "A nota vai de 1 a 5.").max(5, "A nota vai de 1 a 5."),
  comment: z.string().max(1000).optional(),
  tags: z.array(z.string().max(40)).max(8).optional(),
});

export const ticketSchema = z.object({
  subject: z.string().min(3).max(160),
  category: z.string().max(60).default("general"),
  ride_id: uuidSchema.optional(),
  priority: z.enum(ZC_TICKET_PRIORITIES).optional(),
  message: z.string().min(3).max(4000),
});

export const ticketMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  attachments: z.array(z.string().url()).max(5).optional(),
});

export const ticketUpdateSchema = z.object({
  status: z.enum(ZC_TICKET_STATUSES).optional(),
  priority: z.enum(ZC_TICKET_PRIORITIES).optional(),
  assigned_to: uuidSchema.optional().nullable(),
});

export const notificationChannelSchema = z.enum(ZC_NOTIFICATION_CHANNELS);

export const tariffUpsertSchema = z.object({
  name: z.string().min(3).max(120),
  region_id: uuidSchema.nullable().optional(),
  category_id: uuidSchema,
  base_fare_cents: z.number().int().min(0),
  price_per_km_cents: z.number().int().min(0),
  price_per_minute_cents: z.number().int().min(0),
  minimum_fare_cents: z.number().int().min(0),
  included_km: z.number().min(0).max(500).default(0),
  service_fee_cents: z.number().int().min(0).max(100_000).default(0),
  service_fee_pct: z.number().min(0).max(100).default(0),
  toll_policy: z.enum(["none", "fixed", "route"]).default("none"),
  toll_fixed_cents: z.number().int().min(0).max(100_000).default(0),
  toll_applies_above_km: z.number().min(0).max(1000).default(0),
  extra_stop_cents: z.number().int().min(0).default(0),
  helper_cents: z.number().int().min(0).default(0),
  waiting_per_minute_cents: z.number().int().min(0).default(0),
  free_waiting_minutes: z.number().int().min(0).max(240).default(15),
  immediate_surcharge_pct: z.number().min(0).max(500).default(35),
  night_surcharge_pct: z.number().min(0).max(500).default(0),
  night_start: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .default("22:00"),
  night_end: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .default("06:00"),
  weekend_surcharge_pct: z.number().min(0).max(500).default(0),
  platform_commission_pct: z.number().min(0).max(100).default(20),
  cancellation_fee_cents: z.number().int().min(0).default(0),
  cancellation_free_seconds: z.number().int().min(0).max(3600).default(300),
});

export const settingUpdateSchema = z.object({
  key: z.string().min(3).max(80),
  value: z.unknown(),
  description: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------
// FASE 2 — cadastros
// ---------------------------------------------------------------------

export const profileUpdateSchema = z.object({
  full_name: z
    .string()
    .min(3, "Informe seu nome completo.")
    .max(120)
    .refine((value) => value.trim().split(/\s+/).length >= 2, {
      message: "Informe nome e sobrenome.",
    })
    .optional(),
  phone: phoneSchema.optional(),
  email: z.string().email("E-mail inválido.").max(160).optional(),
  document_number: documentNumberSchema.optional(),
  birth_date: z
    .string()
    .date()
    .refine(
      (value) => {
        const age = (Date.now() - new Date(value).getTime()) / (365.25 * 24 * 3600 * 1000);
        return age >= 18 && age < 110;
      },
      { message: "É preciso ter 18 anos ou mais." },
    )
    .optional(),
  avatar_url: z.string().url().max(500).nullable().optional(),
});

export const addressUpsertSchema = addressSchema.extend({
  label: z.string().max(40).optional(),
  is_default: z.boolean().optional(),
});

export const termsAcceptSchema = z.object({
  audience: z.enum(ZC_ROLES),
  version: z.string().max(40).optional(),
});

export const signUploadSchema = z.object({
  bucket: z.enum(["zc-avatars", "zc-documents"]),
  purpose: z.string().min(2).max(60),
  mime_type: z.string().min(3).max(80),
  size_bytes: z
    .number()
    .int()
    .min(1)
    .max(50 * 1024 * 1024)
    .optional(),
});

/** CNH: 11 dígitos, e a validade não pode estar vencida. */
export const cnhSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length === 11, { message: "A CNH tem 11 dígitos." });

export const driverOnboardingSchema = z.object({
  region_id: uuidSchema.nullable().optional(),
  cnh_number: cnhSchema.optional(),
  cnh_category: z
    .string()
    .max(5)
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-E]{1,5}$/.test(value), { message: "Categoria da CNH inválida." })
    .optional(),
  cnh_expires_at: z
    .string()
    .date()
    .refine((value) => new Date(value).getTime() > Date.now(), {
      message: "A CNH está vencida. Renove antes de continuar.",
    })
    .optional(),
  pix_key: z.string().min(3).max(140).optional(),
  pix_key_type: z.enum(["cpf", "cnpj", "email", "phone", "random"]).optional(),
  bank_account: z
    .object({
      bank_name: z.string().max(80).optional(),
      agency: z.string().max(20).optional(),
      account: z.string().max(30).optional(),
      account_type: z.enum(["corrente", "poupanca"]).optional(),
    })
    .optional(),
});

export const vehicleUpsertSchema = vehicleSchema.extend({
  photos: z.array(z.string().max(500)).max(8).optional(),
  notes: z.string().max(500).optional(),
});

export const vehiclePatchSchema = vehicleUpsertSchema.partial();

export const vehicleReviewSchema = z
  .object({
    status: z.enum(ZC_VEHICLE_STATUSES),
    reason: z.string().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status !== "approved" && !value.reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Informe o motivo para o motorista saber o que corrigir.",
      });
    }
  });

export const revealSchema = z.object({
  reason: z.string().min(5, "Diga por que precisa ver o dado completo.").max(240),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;
export type CreateRideInput = z.infer<typeof createRideSchema>;
export type StopInput = z.infer<typeof stopInputSchema>;
export type LocationPingInput = z.infer<typeof locationPingSchema>;
export type VehicleInput = z.infer<typeof vehicleSchema>;
export type TariffUpsertInput = z.infer<typeof tariffUpsertSchema>;

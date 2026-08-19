/**
 * ZÉ CARRETO — listas de valores do domínio.
 *
 * Estes valores são espelho fiel dos tipos criados no banco
 * (migrações `20260818120*`). Se um valor mudar lá, muda aqui — os
 * testes de `__tests__/domain.test.ts` reclamam se sair do lugar.
 */

export const ZC_ROLES = ["client", "driver", "admin"] as const;
export type ZcRole = (typeof ZC_ROLES)[number];

export const ZC_ACCOUNT_STATUSES = ["active", "pending", "suspended", "banned"] as const;
export type ZcAccountStatus = (typeof ZC_ACCOUNT_STATUSES)[number];

export const ZC_DRIVER_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "suspended",
] as const;
export type ZcDriverStatus = (typeof ZC_DRIVER_STATUSES)[number];

export const ZC_DRIVER_AVAILABILITIES = ["offline", "online", "busy"] as const;
export type ZcDriverAvailability = (typeof ZC_DRIVER_AVAILABILITIES)[number];

export const ZC_DOCUMENT_OWNERS = ["driver", "vehicle"] as const;
export type ZcDocumentOwner = (typeof ZC_DOCUMENT_OWNERS)[number];

export const ZC_DOCUMENT_TYPES = [
  "cnh",
  "crlv",
  "profile_photo",
  "vehicle_photo",
  "proof_of_address",
  "criminal_record",
  "bank_proof",
  "selfie",
  "other",
] as const;
export type ZcDocumentType = (typeof ZC_DOCUMENT_TYPES)[number];

export const ZC_VEHICLE_STATUSES = ["pending", "approved", "rejected", "inactive"] as const;
export type ZcVehicleStatus = (typeof ZC_VEHICLE_STATUSES)[number];

export const ZC_DOCUMENT_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "expired",
] as const;
export type ZcDocumentStatus = (typeof ZC_DOCUMENT_STATUSES)[number];

/** A esteira por onde todo carreto passa. A ordem importa. */
export const ZC_RIDE_STATUSES = [
  "draft",
  "awaiting_payment",
  "searching_driver",
  "driver_assigned",
  "driver_to_pickup",
  "driver_arrived",
  "loading",
  "in_transit",
  "unloading",
  "completed",
  "cancelled",
] as const;
export type ZcRideStatus = (typeof ZC_RIDE_STATUSES)[number];

/** Estados finais: chegou aqui, não anda mais. */
export const ZC_RIDE_TERMINAL_STATUSES: readonly ZcRideStatus[] = ["completed", "cancelled"];

/** Estados em que já existe um motorista responsável pela corrida. */
export const ZC_RIDE_ACTIVE_WITH_DRIVER: readonly ZcRideStatus[] = [
  "driver_assigned",
  "driver_to_pickup",
  "driver_arrived",
  "loading",
  "in_transit",
  "unloading",
];

export const ZC_RIDE_MODALITIES = ["scheduled", "immediate"] as const;
export type ZcRideModality = (typeof ZC_RIDE_MODALITIES)[number];

export const ZC_STOP_KINDS = ["pickup", "stop", "dropoff"] as const;
export type ZcStopKind = (typeof ZC_STOP_KINDS)[number];

export const ZC_STOP_STATUSES = ["pending", "arrived", "completed", "skipped"] as const;
export type ZcStopStatus = (typeof ZC_STOP_STATUSES)[number];

export const ZC_OFFER_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "expired",
  "cancelled",
] as const;
export type ZcOfferStatus = (typeof ZC_OFFER_STATUSES)[number];

export const ZC_CANCEL_ACTORS = ["client", "driver", "admin", "system"] as const;
export type ZcCancelActor = (typeof ZC_CANCEL_ACTORS)[number];

export const ZC_PAYMENT_METHODS = ["pix", "credit_card", "debit_card", "cash", "wallet"] as const;
export type ZcPaymentMethod = (typeof ZC_PAYMENT_METHODS)[number];

export const ZC_PAYMENT_STATUSES = [
  "pending",
  "authorized",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
  "cancelled",
  "chargeback",
] as const;
export type ZcPaymentStatus = (typeof ZC_PAYMENT_STATUSES)[number];

export const ZC_TRANSACTION_KINDS = [
  "ride_earning",
  "platform_commission",
  "tip",
  "cancellation_fee",
  "payout",
  "payout_reversal",
  "adjustment_credit",
  "adjustment_debit",
  "refund",
  "bonus",
] as const;
export type ZcTransactionKind = (typeof ZC_TRANSACTION_KINDS)[number];

export const ZC_TRANSACTION_STATUSES = ["pending", "available", "settled", "cancelled"] as const;
export type ZcTransactionStatus = (typeof ZC_TRANSACTION_STATUSES)[number];

export const ZC_PAYOUT_STATUSES = [
  "scheduled",
  "processing",
  "paid",
  "failed",
  "cancelled",
] as const;
export type ZcPayoutStatus = (typeof ZC_PAYOUT_STATUSES)[number];

export const ZC_RATING_DIRECTIONS = ["client_to_driver", "driver_to_client"] as const;
export type ZcRatingDirection = (typeof ZC_RATING_DIRECTIONS)[number];

export const ZC_NOTIFICATION_CHANNELS = ["in_app", "push", "sms", "email", "whatsapp"] as const;
export type ZcNotificationChannel = (typeof ZC_NOTIFICATION_CHANNELS)[number];

export const ZC_NOTIFICATION_STATUSES = ["queued", "sent", "failed", "read"] as const;
export type ZcNotificationStatus = (typeof ZC_NOTIFICATION_STATUSES)[number];

export const ZC_TICKET_STATUSES = [
  "open",
  "pending_user",
  "pending_support",
  "resolved",
  "closed",
] as const;
export type ZcTicketStatus = (typeof ZC_TICKET_STATUSES)[number];

export const ZC_TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type ZcTicketPriority = (typeof ZC_TICKET_PRIORITIES)[number];

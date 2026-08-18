/**
 * ZÉ CARRETO — porta de entrada do módulo.
 *
 * Quem for construir as telas (FASE 2 em diante) importa daqui:
 *   import { computeQuote, ZC_RIDE_STATUSES } from "@/lib/zecarreto";
 *
 * Atenção: `db/client`, `http/*` e `services/*` só rodam no SERVIDOR
 * (usam a chave de serviço). Em código de tela, use `realtime.ts`,
 * `domain/*` e `validation.ts`, que são seguros para o navegador.
 */

export * from "./domain/enums";
export * from "./domain/money";
export * from "./domain/geo";
export * from "./domain/pricing";
export * from "./domain/ride-status";
export * from "./errors";
export * from "./realtime";
export * from "./validation";
export type {
  ZcDriverRow,
  ZcRideRow,
  ZcRideStopRow,
  ZcRideOfferRow,
  ZcTariffRow,
  ZcVehicleCategoryRow,
  ZcWalletRow,
  ZcWalletTransactionRow,
  ZcPayoutRow,
  ZcNotificationRow,
  ZcSupportTicketRow,
} from "./db/types";

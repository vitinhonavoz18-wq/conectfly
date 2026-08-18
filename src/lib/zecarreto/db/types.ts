/**
 * Tipos das tabelas do ZÉ CARRETO (prefixo `zc_`).
 *
 * O SiteCreatorFly já tem o seu `src/integrations/supabase/types.ts`, que
 * é gerado automaticamente e NÃO conhece as tabelas do ZÉ CARRETO. Este
 * arquivo descreve só as nossas tabelas, para o editor avisar o erro
 * antes de o código rodar. Ao regenerar os tipos do Supabase, este
 * arquivo pode ser substituído pela versão gerada.
 */

import type {
  ZcAccountStatus,
  ZcCancelActor,
  ZcDocumentOwner,
  ZcDocumentStatus,
  ZcDocumentType,
  ZcDriverAvailability,
  ZcDriverStatus,
  ZcNotificationChannel,
  ZcNotificationStatus,
  ZcOfferStatus,
  ZcPaymentMethod,
  ZcPaymentStatus,
  ZcPayoutStatus,
  ZcRatingDirection,
  ZcRideModality,
  ZcRideStatus,
  ZcRole,
  ZcStopKind,
  ZcStopStatus,
  ZcTicketPriority,
  ZcTicketStatus,
  ZcTransactionKind,
  ZcTransactionStatus,
} from "../domain/enums";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

/** Campos obrigatórios na criação; o resto é opcional (tem valor padrão). */
type Insertable<Row, Required extends keyof Row> = Pick<Row, Required> &
  Partial<Omit<Row, Required>>;

type Timestamps = {
  created_at: string;
  updated_at: string;
};

export type ZcProfileRow = Timestamps & {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  document_number: string | null;
  birth_date: string | null;
  avatar_url: string | null;
  status: ZcAccountStatus;
  last_seen_at: string | null;
  metadata: Json;
  deleted_at: string | null;
};

export type ZcUserRoleRow = {
  id: string;
  user_id: string;
  role: ZcRole;
  granted_by: string | null;
  created_at: string;
};

export type ZcRegionRow = Timestamps & {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string;
  timezone: string;
  center_lat: number | null;
  center_lng: number | null;
  radius_km: number | null;
  demand_multiplier: number;
  active: boolean;
  is_default: boolean;
  metadata: Json;
  deleted_at: string | null;
};

export type ZcVehicleCategoryRow = Timestamps & {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  examples: string | null;
  max_weight_kg: number | null;
  max_length_cm: number | null;
  max_width_cm: number | null;
  max_height_cm: number | null;
  helpers_included: number;
  max_helpers: number;
  icon: string | null;
  sort_order: number;
  active: boolean;
  metadata: Json;
  deleted_at: string | null;
};

export type ZcTariffRow = Timestamps & {
  id: string;
  name: string;
  region_id: string | null;
  category_id: string;
  currency: string;
  base_fare_cents: number;
  price_per_km_cents: number;
  price_per_minute_cents: number;
  minimum_fare_cents: number;
  extra_stop_cents: number;
  helper_cents: number;
  waiting_per_minute_cents: number;
  free_waiting_minutes: number;
  immediate_surcharge_pct: number;
  night_surcharge_pct: number;
  night_start: string;
  night_end: string;
  weekend_surcharge_pct: number;
  platform_commission_pct: number;
  cancellation_fee_cents: number;
  cancellation_free_seconds: number;
  active: boolean;
  valid_from: string;
  valid_to: string | null;
  metadata: Json;
  deleted_at: string | null;
};

export type ZcCustomerRow = Timestamps & {
  id: string;
  profile_id: string;
  default_region_id: string | null;
  default_payment_method: string | null;
  company_name: string | null;
  rating_avg: number;
  rating_count: number;
  rides_count: number;
  metadata: Json;
  deleted_at: string | null;
};

export type ZcDriverRow = Timestamps & {
  id: string;
  profile_id: string;
  region_id: string | null;
  status: ZcDriverStatus;
  availability: ZcDriverAvailability;
  current_vehicle_id: string | null;
  cnh_number: string | null;
  cnh_category: string | null;
  cnh_expires_at: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  bank_account: Json;
  rating_avg: number;
  rating_count: number;
  rides_count: number;
  acceptance_rate: number;
  cancellation_rate: number;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  suspended_until: string | null;
  last_online_at: string | null;
  metadata: Json;
  deleted_at: string | null;
};

export type ZcVehicleRow = Timestamps & {
  id: string;
  driver_id: string;
  category_id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  model_year: number | null;
  color: string | null;
  capacity_kg: number | null;
  body_type: string | null;
  has_tarp: boolean;
  active: boolean;
  verified_at: string | null;
  verified_by: string | null;
  metadata: Json;
  deleted_at: string | null;
};

export type ZcDocumentRow = Timestamps & {
  id: string;
  owner_kind: ZcDocumentOwner;
  driver_id: string | null;
  vehicle_id: string | null;
  type: ZcDocumentType;
  status: ZcDocumentStatus;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  issued_at: string | null;
  expires_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  metadata: Json;
  deleted_at: string | null;
};

export type ZcAddressRow = Timestamps & {
  id: string;
  profile_id: string;
  label: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  reference: string | null;
  is_default: boolean;
  deleted_at: string | null;
};

export type ZcSettingRow = Timestamps & {
  key: string;
  value: Json;
  description: string | null;
  updated_by: string | null;
};

export type ZcAuditLogRow = {
  id: number;
  actor_profile_id: string | null;
  actor_role: ZcRole | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  before: Json | null;
  after: Json | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Json;
  created_at: string;
};

export type ZcQuoteRow = {
  id: string;
  profile_id: string | null;
  region_id: string | null;
  category_id: string;
  tariff_id: string;
  modality: ZcRideModality;
  scheduled_for: string | null;
  distance_meters: number;
  duration_seconds: number;
  stops_count: number;
  helpers_count: number;
  breakdown: Json;
  subtotal_cents: number;
  surcharge_cents: number;
  total_cents: number;
  platform_fee_cents: number;
  driver_net_cents: number;
  currency: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

export type ZcRideRow = Timestamps & {
  id: string;
  code: string;
  customer_id: string;
  customer_profile_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  region_id: string | null;
  category_id: string;
  tariff_id: string | null;
  quote_id: string | null;
  status: ZcRideStatus;
  modality: ZcRideModality;
  scheduled_for: string | null;
  cargo_description: string | null;
  cargo_photos: Json;
  helpers_count: number;
  notes: string | null;
  distance_meters: number;
  duration_seconds: number;
  price_breakdown: Json;
  subtotal_cents: number;
  surcharge_cents: number;
  total_cents: number;
  platform_fee_cents: number;
  driver_earnings_cents: number;
  currency: string;
  requested_at: string | null;
  paid_at: string | null;
  searching_started_at: string | null;
  assigned_at: string | null;
  pickup_arrived_at: string | null;
  loading_started_at: string | null;
  in_transit_at: string | null;
  unloading_started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: ZcCancelActor | null;
  cancellation_reason: string | null;
  cancellation_fee_cents: number;
  idempotency_key: string | null;
  metadata: Json;
  deleted_at: string | null;
};

export type ZcRideStopRow = Timestamps & {
  id: string;
  ride_id: string;
  sequence: number;
  kind: ZcStopKind;
  status: ZcStopStatus;
  street: string;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  reference: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  instructions: string | null;
  floor_number: number | null;
  has_elevator: boolean | null;
  arrived_at: string | null;
  completed_at: string | null;
};

export type ZcRideStatusEventRow = {
  id: number;
  ride_id: string;
  from_status: ZcRideStatus | null;
  to_status: ZcRideStatus;
  actor_profile_id: string | null;
  actor_role: ZcRole | null;
  reason: string | null;
  metadata: Json;
  created_at: string;
};

export type ZcRideOfferRow = Timestamps & {
  id: string;
  ride_id: string;
  driver_id: string;
  status: ZcOfferStatus;
  round: number;
  distance_meters: number | null;
  payout_cents: number | null;
  expires_at: string;
  responded_at: string | null;
  decline_reason: string | null;
};

export type ZcDriverLocationRow = {
  driver_id: string;
  ride_id: string | null;
  lat: number;
  lng: number;
  heading: number | null;
  speed_kmh: number | null;
  accuracy_m: number | null;
  availability: ZcDriverAvailability;
  recorded_at: string;
  updated_at: string;
};

export type ZcRideTrackingRow = {
  id: number;
  ride_id: string;
  driver_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed_kmh: number | null;
  recorded_at: string;
  created_at: string;
};

export type ZcPaymentRow = Timestamps & {
  id: string;
  ride_id: string | null;
  customer_profile_id: string;
  method: ZcPaymentMethod;
  status: ZcPaymentStatus;
  amount_cents: number;
  refunded_cents: number;
  currency: string;
  provider: string;
  provider_payment_id: string | null;
  provider_payload: Json;
  idempotency_key: string | null;
  authorized_at: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  metadata: Json;
};

export type ZcWalletRow = Timestamps & {
  id: string;
  driver_id: string;
  currency: string;
  balance_pending_cents: number;
  balance_available_cents: number;
  total_earned_cents: number;
  total_paid_out_cents: number;
  blocked: boolean;
  blocked_reason: string | null;
};

export type ZcWalletTransactionRow = {
  id: string;
  wallet_id: string;
  driver_id: string;
  ride_id: string | null;
  payout_id: string | null;
  kind: ZcTransactionKind;
  status: ZcTransactionStatus;
  amount_cents: number;
  balance_after_cents: number;
  currency: string;
  description: string | null;
  reference: string | null;
  available_at: string | null;
  settled_at: string | null;
  metadata: Json;
  created_at: string;
};

export type ZcPayoutRow = Timestamps & {
  id: string;
  driver_id: string;
  wallet_id: string;
  period_start: string;
  period_end: string;
  gross_cents: number;
  fees_cents: number;
  net_cents: number;
  currency: string;
  status: ZcPayoutStatus;
  method: string;
  pix_key: string | null;
  pix_key_type: string | null;
  scheduled_for: string | null;
  processed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  external_id: string | null;
  metadata: Json;
};

export type ZcPayoutItemRow = {
  id: string;
  payout_id: string;
  transaction_id: string;
  amount_cents: number;
  created_at: string;
};

export type ZcRatingRow = {
  id: string;
  ride_id: string;
  direction: ZcRatingDirection;
  rater_profile_id: string;
  ratee_profile_id: string;
  stars: number;
  comment: string | null;
  tags: string[];
  created_at: string;
};

export type ZcNotificationRow = {
  id: string;
  profile_id: string;
  ride_id: string | null;
  channel: ZcNotificationChannel;
  type: string;
  title: string;
  body: string | null;
  data: Json;
  status: ZcNotificationStatus;
  dedupe_key: string | null;
  sent_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  error: string | null;
  created_at: string;
};

export type ZcSupportTicketRow = Timestamps & {
  id: string;
  code: string;
  profile_id: string;
  ride_id: string | null;
  subject: string;
  category: string;
  status: ZcTicketStatus;
  priority: ZcTicketPriority;
  assigned_to: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  metadata: Json;
};

export type ZcSupportMessageRow = {
  id: string;
  ticket_id: string;
  author_profile_id: string | null;
  is_staff: boolean;
  body: string;
  attachments: Json;
  created_at: string;
};

export type ZecarretoDatabase = {
  public: {
    Tables: {
      zc_profiles: Table<ZcProfileRow, Insertable<ZcProfileRow, "id" | "full_name">>;
      zc_user_roles: Table<ZcUserRoleRow, Insertable<ZcUserRoleRow, "user_id" | "role">>;
      zc_regions: Table<ZcRegionRow, Insertable<ZcRegionRow, "slug" | "name">>;
      zc_vehicle_categories: Table<
        ZcVehicleCategoryRow,
        Insertable<ZcVehicleCategoryRow, "slug" | "name">
      >;
      zc_tariffs: Table<ZcTariffRow, Insertable<ZcTariffRow, "name" | "category_id">>;
      zc_customers: Table<ZcCustomerRow, Insertable<ZcCustomerRow, "profile_id">>;
      zc_drivers: Table<ZcDriverRow, Insertable<ZcDriverRow, "profile_id">>;
      zc_vehicles: Table<
        ZcVehicleRow,
        Insertable<ZcVehicleRow, "driver_id" | "category_id" | "plate">
      >;
      zc_documents: Table<
        ZcDocumentRow,
        Insertable<ZcDocumentRow, "owner_kind" | "type" | "storage_path">
      >;
      zc_addresses: Table<
        ZcAddressRow,
        Insertable<ZcAddressRow, "profile_id" | "street" | "city" | "state">
      >;
      zc_settings: Table<ZcSettingRow, Insertable<ZcSettingRow, "key" | "value">>;
      zc_audit_logs: Table<ZcAuditLogRow, Insertable<ZcAuditLogRow, "action" | "entity_table">>;
      zc_quotes: Table<
        ZcQuoteRow,
        Insertable<
          ZcQuoteRow,
          | "category_id"
          | "tariff_id"
          | "modality"
          | "distance_meters"
          | "duration_seconds"
          | "subtotal_cents"
          | "total_cents"
          | "expires_at"
        >
      >;
      zc_rides: Table<
        ZcRideRow,
        Insertable<ZcRideRow, "customer_id" | "customer_profile_id" | "category_id">
      >;
      zc_ride_stops: Table<
        ZcRideStopRow,
        Insertable<ZcRideStopRow, "ride_id" | "sequence" | "kind" | "street" | "city" | "state">
      >;
      zc_ride_status_events: Table<
        ZcRideStatusEventRow,
        Insertable<ZcRideStatusEventRow, "ride_id" | "to_status">
      >;
      zc_ride_offers: Table<
        ZcRideOfferRow,
        Insertable<ZcRideOfferRow, "ride_id" | "driver_id" | "expires_at">
      >;
      zc_driver_locations: Table<
        ZcDriverLocationRow,
        Insertable<ZcDriverLocationRow, "driver_id" | "lat" | "lng">
      >;
      zc_ride_tracking: Table<
        ZcRideTrackingRow,
        Insertable<ZcRideTrackingRow, "ride_id" | "driver_id" | "lat" | "lng">
      >;
      zc_payments: Table<
        ZcPaymentRow,
        Insertable<ZcPaymentRow, "customer_profile_id" | "method" | "amount_cents">
      >;
      zc_wallets: Table<ZcWalletRow, Insertable<ZcWalletRow, "driver_id">>;
      zc_wallet_transactions: Table<
        ZcWalletTransactionRow,
        Insertable<ZcWalletTransactionRow, "wallet_id" | "driver_id" | "kind" | "amount_cents">
      >;
      zc_payouts: Table<
        ZcPayoutRow,
        Insertable<ZcPayoutRow, "driver_id" | "wallet_id" | "period_start" | "period_end">
      >;
      zc_payout_items: Table<
        ZcPayoutItemRow,
        Insertable<ZcPayoutItemRow, "payout_id" | "transaction_id" | "amount_cents">
      >;
      zc_ratings: Table<
        ZcRatingRow,
        Insertable<
          ZcRatingRow,
          "ride_id" | "direction" | "rater_profile_id" | "ratee_profile_id" | "stars"
        >
      >;
      zc_notifications: Table<
        ZcNotificationRow,
        Insertable<ZcNotificationRow, "profile_id" | "type" | "title">
      >;
      zc_support_tickets: Table<
        ZcSupportTicketRow,
        Insertable<ZcSupportTicketRow, "profile_id" | "subject">
      >;
      zc_support_messages: Table<
        ZcSupportMessageRow,
        Insertable<ZcSupportMessageRow, "ticket_id" | "body">
      >;
    };
    Views: Record<string, never>;
    Functions: {
      zc_accept_ride_offer: {
        Args: { _offer_id: string; _driver_id: string; _vehicle_id?: string | null };
        Returns: ZcRideRow;
      };
      zc_wallet_recompute: {
        Args: { _wallet_id: string };
        Returns: ZcWalletRow;
      };
      zc_has_role: {
        Args: { _user_id: string; _role: ZcRole };
        Returns: boolean;
      };
      zc_ride_transition_allowed: {
        Args: { _from: ZcRideStatus; _to: ZcRideStatus };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

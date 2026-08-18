/**
 * Tempo real — o que muda na tela sozinho, sem o usuário atualizar.
 *
 * Aqui ficam só os NOMES dos canais e o jeito de assinar. É como combinar
 * em que rádio cada equipe fala: o cliente ouve o canal da corrida dele, o
 * motorista ouve o canal de ofertas dele, o admin ouve o painel.
 *
 * Este arquivo pode rodar no navegador — por isso não importa nada do
 * servidor nem chave secreta.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const zcChannels = {
  /** Tudo que acontece numa corrida específica. */
  ride: (rideId: string) => `zc:ride:${rideId}`,
  /** Ofertas chegando para um motorista. */
  driverOffers: (driverId: string) => `zc:driver:${driverId}:offers`,
  /** Posição do motorista durante a corrida. */
  rideTracking: (rideId: string) => `zc:ride:${rideId}:tracking`,
  /** Avisos de uma pessoa (cliente, motorista ou admin). */
  notifications: (profileId: string) => `zc:notify:${profileId}`,
  /** Painel do administrador: corridas entrando e saindo. */
  adminRides: () => "zc:admin:rides",
} as const;

type Unsubscribe = () => void;

/** Acompanha uma corrida (status, paradas e etapas). */
export function subscribeToRide(
  client: SupabaseClient,
  rideId: string,
  handlers: {
    onRide?: (payload: unknown) => void;
    onStop?: (payload: unknown) => void;
    onStatusEvent?: (payload: unknown) => void;
  },
): Unsubscribe {
  const channel = client
    .channel(zcChannels.ride(rideId))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "zc_rides", filter: `id=eq.${rideId}` },
      (payload) => handlers.onRide?.(payload),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "zc_ride_stops", filter: `ride_id=eq.${rideId}` },
      (payload) => handlers.onStop?.(payload),
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "zc_ride_status_events",
        filter: `ride_id=eq.${rideId}`,
      },
      (payload) => handlers.onStatusEvent?.(payload),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

/** Ofertas de carreto chegando para um motorista. */
export function subscribeToDriverOffers(
  client: SupabaseClient,
  driverId: string,
  onOffer: (payload: unknown) => void,
): Unsubscribe {
  const channel = client
    .channel(zcChannels.driverOffers(driverId))
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "zc_ride_offers",
        filter: `driver_id=eq.${driverId}`,
      },
      (payload) => onOffer(payload),
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

/** Posição do motorista no mapa, durante a corrida. */
export function subscribeToDriverLocation(
  client: SupabaseClient,
  driverId: string,
  onMove: (payload: unknown) => void,
): Unsubscribe {
  const channel = client
    .channel(`zc:driver:${driverId}:location`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "zc_driver_locations",
        filter: `driver_id=eq.${driverId}`,
      },
      (payload) => onMove(payload),
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

/** Avisos da pessoa logada. */
export function subscribeToNotifications(
  client: SupabaseClient,
  profileId: string,
  onNotification: (payload: unknown) => void,
): Unsubscribe {
  const channel = client
    .channel(zcChannels.notifications(profileId))
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "zc_notifications",
        filter: `profile_id=eq.${profileId}`,
      },
      (payload) => onNotification(payload),
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

/**
 * Envio da posição do carreteiro.
 *
 * Duas regras de ouro:
 *
 *  1. **Só liga quando precisa.** O aparelho só acompanha a localização
 *     quando o carreteiro está ONLINE ou dentro de um carreto. Fora disso,
 *     desliga — bateria é o combustível do celular dele.
 *
 *  2. **Só com permissão.** O navegador pergunta uma vez; se a pessoa
 *     recusar, o aplicativo explica por que precisa e não insiste sozinho.
 *
 * O envio ainda é espaçado por tempo aqui na tela — e o servidor tem a
 * palavra final sobre o que vale a pena guardar.
 */

import { useEffect, useRef, useState } from "react";
import { zcApi } from "@/lib/zecarreto/client";

export type LocationPermission = "unknown" | "granted" | "denied" | "unavailable";

export interface DriverLocationState {
  permission: LocationPermission;
  lastSentAt: Date | null;
  lastError: string | null;
  active: boolean;
  /** Pede a permissão ao navegador (precisa partir de um toque na tela). */
  request: () => Promise<void>;
}

export function useDriverLocation(options: {
  enabled: boolean;
  minIntervalSeconds?: number;
  rideId?: string | null;
}): DriverLocationState {
  const { enabled, minIntervalSeconds = 15, rideId = null } = options;
  const [permission, setPermission] = useState<LocationPermission>("unknown");
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastSendRef = useRef<number>(0);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermission("unavailable");
      return;
    }
    if (!navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        setPermission(status.state === "prompt" ? "unknown" : (status.state as LocationPermission));
        status.onchange = () =>
          setPermission(
            status.state === "prompt" ? "unknown" : (status.state as LocationPermission),
          );
      })
      .catch(() => undefined);
  }, []);

  async function enviar(position: GeolocationPosition) {
    const agora = Date.now();
    if (agora - lastSendRef.current < minIntervalSeconds * 1000) return;
    if (sendingRef.current) return;

    sendingRef.current = true;
    lastSendRef.current = agora;
    try {
      await zcApi("/drivers/me/location", {
        method: "POST",
        body: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading ?? undefined,
          speed_kmh:
            position.coords.speed === null ? undefined : Math.max(0, position.coords.speed * 3.6),
          accuracy_m: position.coords.accuracy ?? undefined,
          ride_id: rideId ?? undefined,
          app_state:
            typeof document !== "undefined" && document.hidden ? "background" : "foreground",
          recorded_at: new Date(position.timestamp).toISOString(),
        },
      });
      setLastSentAt(new Date());
      setLastError(null);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Falha ao enviar a posição.");
    } finally {
      sendingRef.current = false;
    }
  }

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    // Desligado? Encerra o acompanhamento e não gasta bateria à toa.
    if (!enabled) {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      return;
    }

    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setPermission("granted");
        void enviar(position);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setPermission("denied");
        setLastError(traduzErroDeLocalizacao(error));
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );

    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, rideId, minIntervalSeconds]);

  async function request() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermission("unavailable");
      return;
    }
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPermission("granted");
          void enviar(position);
          resolve();
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) setPermission("denied");
          setLastError(traduzErroDeLocalizacao(error));
          resolve();
        },
        { enableHighAccuracy: true, timeout: 20_000 },
      );
    });
  }

  return {
    permission,
    lastSentAt,
    lastError,
    active: enabled && permission === "granted",
    request,
  };
}

function traduzErroDeLocalizacao(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Você precisa liberar a localização para receber carretos.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Não conseguimos achar sua posição. Verifique o GPS.";
  }
  return "Demorou demais para achar sua posição. Tentando de novo.";
}

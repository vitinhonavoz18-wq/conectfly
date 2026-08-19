/**
 * Mapa do pedido.
 *
 * Mostra os pontos do carreto (retirada, paradas e entrega) ligados por
 * uma linha. Só roda no navegador — no servidor não existe tela para
 * desenhar, então o mapa carrega depois que a página abre.
 *
 * Os quadradinhos do mapa vêm de um endereço configurável no admin
 * (`map.tile_url`). Hoje é o OpenStreetMap, que é gratuito; trocar por um
 * provedor pago é mudar essa configuração, sem mexer em código.
 */

import { useEffect, useRef } from "react";
import type { LatLngExpression, Map as LeafletMap, Marker, Polyline } from "leaflet";

export interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
}

interface ZcMapProps {
  points: MapPoint[];
  center?: { lat: number; lng: number };
  tileUrl?: string;
  attribution?: string;
  height?: number;
  className?: string;
}

const DEFAULT_TILE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export function ZcMap({
  points,
  center,
  tileUrl,
  attribution = "© OpenStreetMap",
  height = 220,
  className,
}: ZcMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<(Marker | Polyline)[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      if (!containerRef.current) return;
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      const fallbackCenter: LatLngExpression = [
        center?.lat ?? points[0]?.lat ?? -23.5505,
        center?.lng ?? points[0]?.lng ?? -46.6333,
      ];

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: false,
        }).setView(fallbackCenter, 12);

        L.tileLayer(tileUrl || DEFAULT_TILE, { attribution, maxZoom: 19 }).addTo(mapRef.current);
      }

      const map = mapRef.current;
      for (const layer of layersRef.current) layer.remove();
      layersRef.current = [];

      const valid = points.filter(
        (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng),
      );
      if (!valid.length) {
        map.setView(fallbackCenter, 12);
        return;
      }

      valid.forEach((point, index) => {
        const isFirst = index === 0;
        const isLast = index === valid.length - 1;
        const color = isFirst ? "#f59e0b" : isLast ? "#10b981" : "#525252";
        const marker = L.circleMarker([point.lat, point.lng], {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: color,
          fillOpacity: 1,
        }).addTo(map);
        if (point.label) marker.bindTooltip(point.label, { direction: "top" });
        layersRef.current.push(marker as unknown as Marker);
      });

      if (valid.length > 1) {
        const line = L.polyline(
          valid.map((point) => [point.lat, point.lng] as LatLngExpression),
          { color: "#171717", weight: 3, opacity: 0.6, dashArray: "6 6" },
        ).addTo(map);
        layersRef.current.push(line);
        map.fitBounds(line.getBounds(), { padding: [30, 30] });
      } else {
        map.setView([valid[0].lat, valid[0].lng], 15);
      }
    }

    draw();
    return () => {
      cancelled = true;
    };
  }, [points, center, tileUrl, attribution]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className ?? "w-full overflow-hidden rounded-xl border border-neutral-200"}
      style={{ height }}
      role="img"
      aria-label="Mapa com os pontos do carreto"
    />
  );
}

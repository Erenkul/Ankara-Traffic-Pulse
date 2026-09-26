import { useEffect, useMemo, useState } from 'react';
import type { MetroPath } from './useMetroData';

export interface TrainPoint {
  lineId: string;
  name: string;
  color: [number, number, number];
  position: [number, number];
  /** Kuzeyden saat yönünde derece */
  bearing: number;
}

const AVG_SPEED_KMH = 35;   // Ankara metrosu ortalama işletme hızı (duraklar dahil) — yaklaşık
const TRAINS_PER_LINE = 3;
const TICK_MS = 2000;

interface Track {
  line: MetroPath;
  cum: number[];   // noktaya kadar kümülatif km
  total: number;
}

function km(a: [number, number], b: [number, number]) {
  const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dx = (b[0] - a[0]) * 111.32 * Math.cos(lat);
  const dy = (b[1] - a[1]) * 110.57;
  return Math.hypot(dx, dy);
}

function bearing(a: [number, number], b: [number, number]) {
  const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  return (Math.atan2((b[0] - a[0]) * Math.cos(lat), b[1] - a[1]) * 180) / Math.PI;
}

function at(track: Track, d: number): { position: [number, number]; bearing: number } {
  const { cum, line } = track;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const a = line.path[i - 1], b = line.path[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const u = Math.min(1, Math.max(0, (d - cum[i - 1]) / seg));
  return { position: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], bearing: bearing(a, b) };
}

/**
 * Hat üzerinde gidip gelen TEMSİLİ trenler. Gerçek konum değildir:
 * EGO raylı sistem için canlı konum yayınlamıyor. Trenler ortalama hızla
 * hat boyunca eşit aralıklı dağıtılır.
 */
export function useTrains(paths: MetroPath[], enabled: boolean) {
  const tracks = useMemo<Track[]>(() => {
    // Her hat için en uzun parçayı ana güzergâh say
    const best: Record<string, Track> = {};
    for (const line of paths) {
      const cum = [0];
      for (let i = 1; i < line.path.length; i++) cum.push(cum[i - 1] + km(line.path[i - 1], line.path[i]));
      const total = cum[cum.length - 1];
      if (total > 0 && total > (best[line.id]?.total ?? 0)) best[line.id] = { line, cum, total };
    }
    return Object.values(best);
  }, [paths]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, [enabled]);

  return useMemo<TrainPoint[]>(() => {
    if (!enabled) return [];
    const hours = now / 3_600_000;
    return tracks.flatMap(track => {
      const cycle = (2 * track.total) / AVG_SPEED_KMH; // gidiş-dönüş saat
      return Array.from({ length: TRAINS_PER_LINE }, (_, k) => {
        const phase = ((hours / cycle) + k / TRAINS_PER_LINE) % 1;
        const forward = phase < 0.5;
        const d = (forward ? phase * 2 : (1 - phase) * 2) * track.total;
        const p = at(track, d);
        return {
          lineId: track.line.id,
          name: track.line.name,
          color: track.line.color,
          position: p.position,
          bearing: forward ? p.bearing : (p.bearing + 180) % 360,
        };
      });
    });
  }, [tracks, now, enabled]);
}

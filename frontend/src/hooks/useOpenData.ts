import { useEffect, useState } from 'react';
import { API_BASE } from '../constants';

export interface OpenDataSource {
  dataset: string;
  page: string;
  license: string;
  fetchedAt: string;
}

export interface ParkingPoint {
  position: [number, number];
  name?: string;
  capacity?: number;
  free?: number;
}

export interface BikePath {
  name?: string;
  path: [number, number][];
}

type Geometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'MultiLineString'; coordinates: [number, number][][] };

interface Layer {
  features: { geometry: Geometry; properties: { name?: string; capacity?: number; free?: number } }[];
  source: OpenDataSource | null;
}

/** Ankara açık veri katmanları (ULASAV / Şeffaf Ankara). Veri yoksa boş döner. */
export function useOpenData(available: { parking: number; bike: number } | undefined) {
  const [parking, setParking] = useState<ParkingPoint[]>([]);
  const [bike, setBike] = useState<BikePath[]>([]);
  const [sources, setSources] = useState<{ parking: OpenDataSource | null; bike: OpenDataSource | null }>(
    { parking: null, bike: null });

  const hasParking = (available?.parking ?? 0) > 0;
  const hasBike = (available?.bike ?? 0) > 0;

  useEffect(() => {
    if (!hasParking) return;
    let cancelled = false;
    const load = () => fetch(`${API_BASE}/opendata/parking`).then(r => r.json()).then((l: Layer) => {
      if (cancelled) return;
      setParking(l.features.filter(f => f.geometry.type === 'Point').map(f => ({
        position: f.geometry.coordinates as [number, number], ...f.properties,
      })));
      setSources(s => ({ ...s, parking: l.source }));
    }).catch(() => {});
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [hasParking]);

  useEffect(() => {
    if (!hasBike) return;
    let cancelled = false;
    fetch(`${API_BASE}/opendata/bike`).then(r => r.json()).then((l: Layer) => {
      if (cancelled) return;
      setBike(l.features.flatMap(f => {
        if (f.geometry.type === 'LineString') return [{ name: f.properties.name, path: f.geometry.coordinates }];
        if (f.geometry.type === 'MultiLineString')
          return f.geometry.coordinates.map(path => ({ name: f.properties.name, path }));
        return [];
      }));
      setSources(s => ({ ...s, bike: l.source }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [hasBike]);

  return { parking, bike, sources };
}

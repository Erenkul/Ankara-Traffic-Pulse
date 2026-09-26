import { useEffect, useState } from 'react';
import { API_BASE } from '../constants';

export type OpenLayerKey = 'parking' | 'bikestations' | 'bike' | 'cablecar';

export interface OpenDataSource {
  provider: 'file' | 'seffaf' | 'url' | 'ulasav' | 'osm';
  dataset: string;
  page: string;
  license: string;
  fetchedAt: string;
}

interface Props {
  name?: string;
  capacity?: number;
  free?: number;
  kind?: string;
  district?: string;
  fee?: boolean;
  major?: boolean;
  length?: number;
}

/** Otopark, bisiklet istasyonu, teleferik durağı gibi nokta öğeleri. */
export interface OpenPoint extends Props {
  layer: OpenLayerKey;
  position: [number, number];
}

export interface BikePath {
  name?: string;
  path: [number, number][];
}

/** @deprecated OpenPoint kullanın */
export type ParkingPoint = OpenPoint;

type Geometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'MultiLineString'; coordinates: [number, number][][] };

interface Layer {
  features: { geometry: Geometry; properties: Props }[];
  source: OpenDataSource | null;
}

const POINT_LAYERS: OpenLayerKey[] = ['parking', 'bikestations', 'cablecar'];
const REFRESH_MS: Record<OpenLayerKey, number> = {
  parking: 5 * 60_000, bikestations: 30 * 60_000, bike: 60 * 60_000, cablecar: 60 * 60_000,
};

type Counts = Partial<Record<OpenLayerKey, number>>;
type Sources = Record<OpenLayerKey, OpenDataSource | null>;

/** Ankara açık veri katmanları (yerel dosya / Şeffaf Ankara / ULASAV / OSM). */
export function useOpenData(available: Counts | undefined) {
  const [points, setPoints] = useState<Record<string, OpenPoint[]>>({});
  const [bike, setBike] = useState<BikePath[]>([]);
  const [sources, setSources] = useState<Sources>(
    { parking: null, bikestations: null, bike: null, cablecar: null });

  // Sayı değiştiğinde (ör. sunucu veriyi ilk kez çektiğinde) katmanı yeniden yükle
  const key = JSON.stringify(available ?? {});

  useEffect(() => {
    const counts: Counts = JSON.parse(key);
    let cancelled = false;
    const timers: ReturnType<typeof setInterval>[] = [];

    const load = (layer: OpenLayerKey) =>
      fetch(`${API_BASE}/opendata/${layer}`).then(r => r.json()).then((l: Layer) => {
        if (cancelled) return;
        if (layer === 'bike') {
          setBike(l.features.flatMap(f => {
            if (f.geometry.type === 'LineString') return [{ name: f.properties.name, path: f.geometry.coordinates }];
            if (f.geometry.type === 'MultiLineString')
              return f.geometry.coordinates.map(path => ({ name: f.properties.name, path }));
            return [];
          }));
        } else {
          setPoints(p => ({
            ...p,
            [layer]: l.features.filter(f => f.geometry.type === 'Point').map(f => ({
              layer, position: f.geometry.coordinates as [number, number], ...f.properties,
            })),
          }));
        }
        setSources(s => ({ ...s, [layer]: l.source }));
      }).catch(() => {});

    for (const layer of [...POINT_LAYERS, 'bike'] as OpenLayerKey[]) {
      if ((counts[layer] ?? 0) > 0) {
        load(layer);
        timers.push(setInterval(() => load(layer), REFRESH_MS[layer]));
      }
    }
    return () => { cancelled = true; timers.forEach(clearInterval); };
  }, [key]);

  return {
    parking: points.parking ?? [],
    bikeStations: points.bikestations ?? [],
    cablecar: points.cablecar ?? [],
    bike,
    sources,
  };
}

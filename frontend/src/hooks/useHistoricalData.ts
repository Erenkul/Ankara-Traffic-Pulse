import { useState, useEffect } from 'react';
import { API_BASE } from '../constants';
import type { TrafficPoint } from './useTrafficData';

export function useHistoricalData(hour: number | null) {
  const [data, setData]       = useState<TrafficPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hour === null) { setData([]); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/traffic/history?hour=${hour}`)
      .then(r => r.json())
      .then((geojson: { features: { geometry: { coordinates: [number, number] }; properties: { congestionRatio: number; closed: boolean } }[] }) => {
        if (cancelled) return;
        setData(geojson.features.map(f => ({
          position: f.geometry.coordinates,
          congestionRatio: f.properties.congestionRatio,
          closed: f.properties.closed,
        })));
      })
      .catch(() => { if (!cancelled) setData([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hour]);

  return { data, loading };
}

import { useState, useEffect } from 'react';
import { API_BASE } from '../constants';
import type { TrafficPoint } from './useTrafficData';

export function useWeeklyHeatmap(enabled: boolean) {
  const [data, setData]       = useState<TrafficPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) { setData([]); return; }
    setLoading(true);
    fetch(`${API_BASE}/traffic/weekly`)
      .then(r => r.json())
      .then((fc: { features: { geometry: { coordinates: [number, number] }; properties: { congestionRatio: number } }[] }) => {
        setData(fc.features.map(f => ({
          position: f.geometry.coordinates,
          congestionRatio: f.properties.congestionRatio,
          closed: false,
        })));
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [enabled]);

  return { data, loading };
}

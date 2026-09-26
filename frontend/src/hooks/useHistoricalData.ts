import { useState, useEffect } from 'react';
import { API_BASE } from '../constants';
import { toTrafficPoints, type TrafficPoint, type TrafficFeatureCollection } from '../types';

export function useHistoricalData(hour: number | null) {
  const [data, setData]       = useState<TrafficPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hour === null) { setData([]); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/traffic/history?hour=${hour}`)
      .then(r => r.json())
      .then((geojson: TrafficFeatureCollection) => {
        if (!cancelled) setData(toTrafficPoints(geojson));
      })
      .catch(() => { if (!cancelled) setData([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hour]);

  return { data, loading };
}

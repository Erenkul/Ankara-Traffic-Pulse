import { useState, useEffect } from 'react';
import { API_BASE } from '../constants';
import { toTrafficPoints, type TrafficPoint, type TrafficFeatureCollection } from '../types';

export function useWeeklyHeatmap(enabled: boolean) {
  const [data, setData]       = useState<TrafficPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) { setData([]); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/traffic/weekly`)
      .then(r => r.json())
      .then((fc: TrafficFeatureCollection) => {
        if (!cancelled) setData(toTrafficPoints(fc));
      })
      .catch(() => { if (!cancelled) setData([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled]);

  return { data, loading };
}

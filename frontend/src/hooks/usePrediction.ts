import { useState, useEffect } from 'react';
import { API_BASE } from '../constants';

export interface PredictionSlot {
  deltaHours: number;
  hour: number;
  timestamp: string;
  predictedCongestion: number;
  confidence: 'yüksek' | 'orta' | 'heuristic';
  label: 'Tıkanık' | 'Yoğun' | 'Orta' | 'Serbest';
}

export function usePrediction(enabled: boolean, hours = 4) {
  const [data, setData]       = useState<PredictionSlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/traffic/predict?hours=${hours}`);
        const json: PredictionSlot[] = await res.json();
        if (!cancelled) setData(json);
      } catch { /* sessiz */ } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const id = setInterval(load, 5 * 60 * 1000); // 5 dk'da bir yenile
    return () => { cancelled = true; clearInterval(id); };
  }, [enabled, hours]);

  return { data, loading };
}

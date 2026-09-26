import { useState, useEffect } from 'react';
import { API_BASE } from '../constants';

export interface Sources {
  traffic: 'tomtom' | 'demo' | 'none';
  buses: 'ego' | 'demo' | 'none';
  metro: 'osm' | 'static';
}

export interface Meta {
  sources: Sources;
  db: boolean;
  /** Açık veri katmanlarındaki öğe sayısı (0 = veri yok) */
  openData?: { parking: number; bikestations: number; bike: number; cablecar: number };
  openDataProviders?: Record<string, string | null>;
}

/** Veri kaynaklarını (gerçek / demo) dakikada bir sorgular. */
export function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`${API_BASE}/meta`)
        .then(r => r.json())
        .then((m: Meta) => { if (!cancelled) { setMeta(m); setReachable(true); } })
        .catch(() => { if (!cancelled) setReachable(false); });
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return { meta, reachable };
}

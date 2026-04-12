import { useState, useEffect } from 'react';
import { API_BASE } from '../constants';

export interface MetroRoute {
  type: 'Feature';
  properties: { id: string; name: string; color: [number, number, number] };
  geometry: { type: 'LineString'; coordinates: [number, number][] };
}

export interface MetroFeatureCollection {
  type: 'FeatureCollection';
  features: MetroRoute[];
}

export function useMetroData() {
  const [routes, setRoutes] = useState<MetroRoute[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/metro/routes`)
      .then(r => r.json())
      .then((fc: MetroFeatureCollection) => setRoutes(fc.features))
      .catch(() => {});
  }, []);

  return { routes };
}

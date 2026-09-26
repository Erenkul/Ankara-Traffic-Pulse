import { useState, useEffect } from 'react';
import { API_BASE } from '../constants';

type RGB = [number, number, number];

export interface MetroPath {
  id: string;
  name: string;
  color: RGB;
  path: [number, number][];
}

export interface MetroStation {
  name: string;
  lines: string[];
  position: [number, number];
}

interface RouteFeature {
  properties: { id: string; name: string; color: RGB };
  geometry:
    | { type: 'LineString'; coordinates: [number, number][] }
    | { type: 'MultiLineString'; coordinates: [number, number][][] };
}

interface StationFeature {
  properties: { name: string; lines: string[] };
  geometry: { coordinates: [number, number] };
}

export function useMetroData() {
  const [paths, setPaths]       = useState<MetroPath[]>([]);
  const [stations, setStations] = useState<MetroStation[]>([]);
  const [lineColors, setLineColors] = useState<Record<string, RGB>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API_BASE}/metro/routes`).then(r => r.json()),
      fetch(`${API_BASE}/metro/stations`).then(r => r.json()),
    ])
      .then(([routes, sts]: [{ features: RouteFeature[] }, { features: StationFeature[] }]) => {
        if (cancelled) return;
        // MultiLineString (OSM) parçalarını ayrı yollara böl
        const flat: MetroPath[] = routes.features.flatMap(f => {
          const parts = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
          return parts.map(path => ({ ...f.properties, path }));
        });
        setPaths(flat);
        setLineColors(Object.fromEntries(routes.features.map(f => [f.properties.id, f.properties.color])));
        setStations(sts.features.map(f => ({
          name: f.properties.name,
          lines: f.properties.lines,
          position: f.geometry.coordinates,
        })));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return { paths, stations, lineColors };
}

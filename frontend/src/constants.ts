export const ANKARA_CENTER = {
  longitude: 32.8597,
  latitude: 39.9334,
  zoom: 12
};

export const CARTO_STYLE = {
  version: 8 as const,
  sources: {
    carto: {
      type: 'raster' as const,
      tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© CARTO © OpenStreetMap'
    }
  },
  layers: [{ id: 'carto-layer', type: 'raster' as const, source: 'carto' }]
};

export const API_BASE = 'http://localhost:8000/api/v1';
export const TRAFFIC_REFRESH_MS = 60_000;
export const BUS_REFRESH_MS = 60_000;

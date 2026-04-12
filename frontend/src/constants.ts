const API_HOST = import.meta.env.VITE_API_BASE ?? 'http://localhost:8002';
const WS_HOST  = import.meta.env.VITE_WS_BASE  ?? 'ws://localhost:8002';

export const API_BASE = `${API_HOST}/api/v1`;
export const WS_URL   = `${WS_HOST}/ws/traffic`;

export const ANKARA_CENTER = {
  longitude: 32.8597,
  latitude:  39.9334,
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

export const TRAFFIC_REFRESH_MS = 60_000;

export const DISTRICT_LABELS: Record<string, string> = {
  'Kızılay':        'Kızılay',
  'Çankaya':        'Çankaya',
  'Ulus':           'Ulus',
  'Yenimahalle':    'Yenimahalle',
  'Eskişehir Yolu': 'Eskişehir Yolu',
  'Esenboğa Yolu':  'Esenboğa Yolu',
  'Konya Yolu':     'Konya Yolu',
};

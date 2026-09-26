const API_HOST = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
const WS_HOST  = import.meta.env.VITE_WS_BASE  ?? 'ws://localhost:8000';

export const API_BASE = `${API_HOST}/api/v1`;
export const WS_URL   = `${WS_HOST}/ws/traffic`;

export const ANKARA_CENTER = {
  longitude: 32.8597,
  latitude:  39.9334,
  zoom: 12
};

// Altlık harita: OpenFreeMap koyu vektör stili — ücretsiz, API anahtarı gerekmez.
// (CARTO karoları artık anahtarsız isteklerde "API KEY REQUIRED" görseli döndürüyor.)
// VITE_MAP_STYLE ile başka bir MapLibre stil adresi verilebilir.
export const MAP_STYLE: string =
  import.meta.env.VITE_MAP_STYLE ?? 'https://tiles.openfreemap.org/styles/dark';

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

// Hız / serbest akış hızı oranına göre yoğunluk seviyeleri (TrafficMap ile aynı eşikler)
export const LEVEL_COLORS = {
  free: '#00D084',
  slow: '#FFD200',
  busy: '#FF8A1F',
  jam:  '#FF4D4D',
} as const;

/** 0–100 yoğunluk yüzdesi (100 = tam tıkanık) için renk. */
export function congestionPctColor(pct: number): string {
  if (pct < 20) return LEVEL_COLORS.free;
  if (pct < 40) return LEVEL_COLORS.slow;
  if (pct < 60) return LEVEL_COLORS.busy;
  return LEVEL_COLORS.jam;
}

export const AUTHOR = {
  name: 'Alp Eren Kul',
  site: 'https://alperenkul.com',
  repo: 'https://github.com/Erenkul/Ankara-Traffic-Pulse',
};

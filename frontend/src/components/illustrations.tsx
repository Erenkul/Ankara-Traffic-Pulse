/**
 * İzometrik (3B görünümlü) ulaşım illüstrasyonları ve harita ikonları.
 *
 * Çizimler koddan üretilir: 3B kutular izometrik izdüşümle (x sağ-aşağı,
 * y sol-aşağı, z yukarı) 2B çokgenlere çevrilir; üst yüz açık, yan yüzler
 * koyu tonlanarak derinlik hissi verilir.
 */
import type { ReactNode } from 'react';

type P3 = [number, number, number];

const COS = 0.866;
const SIN = 0.5;
const iso = ([x, y, z]: P3): [number, number] => [(x - y) * COS, (x + y) * SIN - z];
const pts = (ps: P3[]) => ps.map(p => iso(p).map(n => n.toFixed(2)).join(',')).join(' ');

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => {
    const c = (n >> s) & 255;
    return Math.round(f >= 1 ? c + (255 - c) * (f - 1) : c * f);
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** Görünen üç yüzüyle (üst, ön-sol y=y1, ön-sağ x=x1) izometrik kutu. */
function Box({ x0, x1, y0, y1, z0, z1, color, stroke = 'rgba(0,0,0,0.25)' }: {
  x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; color: string; stroke?: string;
}) {
  return (
    <g stroke={stroke} strokeWidth={0.6} strokeLinejoin="round">
      <polygon points={pts([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]])} fill={shade(color, 0.86)} />
      <polygon points={pts([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]])} fill={shade(color, 0.66)} />
      <polygon points={pts([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]])} fill={shade(color, 1.12)} />
    </g>
  );
}

/** y = sabit yüz üzerinde dikdörtgen (yan pencereler, şeritler). */
const sideRect = (y: number, a: number, b: number, c: number, d: number, fill: string, key?: string) => (
  <polygon key={key} points={pts([[a, y, c], [b, y, c], [b, y, d], [a, y, d]])} fill={fill} />
);
/** x = sabit yüz üzerinde dikdörtgen (ön cam, farlar). */
const frontRect = (x: number, a: number, b: number, c: number, d: number, fill: string, key?: string) => (
  <polygon key={key} points={pts([[x, a, c], [x, b, c], [x, b, d], [x, a, d]])} fill={fill} />
);

function Wheel({ xc, y, zc, r }: { xc: number; y: number; zc: number; r: number }) {
  const ring = (rr: number): P3[] =>
    Array.from({ length: 20 }, (_, i) => {
      const t = (i / 20) * Math.PI * 2;
      return [xc + rr * Math.cos(t), y, zc + rr * Math.sin(t)];
    });
  return (
    <g>
      <polygon points={pts(ring(r))} fill="#1a1f27" />
      <polygon points={pts(ring(r * 0.45))} fill="#8a94a3" />
    </g>
  );
}

function Frame({ children, box, width, label }: {
  children: ReactNode; box: [number, number, number, number]; width: number; label: string;
}) {
  const [minX, minY, w, h] = box;
  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} width={width} height={(width * h) / w} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

const Shadow = ({ x0, x1, y0, y1 }: { x0: number; x1: number; y0: number; y1: number }) => (
  <polygon points={pts([[x0 + 4, y0 + 4, 0], [x1 + 8, y0 + 4, 0], [x1 + 8, y1 + 8, 0], [x0 + 4, y1 + 8, 0]])}
    fill="rgba(0,0,0,0.35)" />
);

/** EGO tarzı körüklü olmayan şehir otobüsü: beyaz gövde, mavi şerit. */
export function Bus3D({ width = 170, stripe = '#1f6fd1' }: { width?: number; stripe?: string }) {
  const L = 130, W = 30, Z0 = 8, Z1 = 46;
  const glass = '#16243a';
  const windows = [10, 30, 50, 70, 90, 108].map((a, i) =>
    sideRect(W, a, a + 16, 25, 41, glass, `w${i}`));
  return (
    <Frame box={[-32, -56, 150, 146]} width={width} label="EGO otobüsü illüstrasyonu">
      <Shadow x0={0} x1={L} y0={0} y1={W} />
      <Box x0={0} x1={L} y0={0} y1={W} z0={Z0} z1={Z1} color="#f2f5f9" />
      {/* Klima ünitesi */}
      <Box x0={40} x1={80} y0={6} y1={24} z0={Z1} z1={Z1 + 5} color="#d9dee6" />
      {/* Şeritler ve pencereler */}
      {sideRect(W, 0, L, 12, 19, stripe)}
      {sideRect(W, 0, L, 42, 44, shade(stripe, 1.2))}
      {windows}
      {/* Kapılar */}
      {sideRect(W, 116, 127, 10, 41, '#223350')}
      {sideRect(W, 58, 69, 10, 41, '#223350')}
      {/* Ön yüz: cam, hat tabelası, farlar, tampon */}
      {frontRect(L, 3, 27, 22, 41, glass)}
      {frontRect(L, 5, 25, 42, 45, '#ffb020')}
      {frontRect(L, 0, W, 12, 19, stripe)}
      {frontRect(L, 3, 8, 13, 17, '#fff7c2')}
      {frontRect(L, 22, 27, 13, 17, '#fff7c2')}
      {frontRect(L, 0, W, 8, 10, '#2a3240')}
      <Wheel xc={24} y={W} zc={Z0} r={8} />
      <Wheel xc={104} y={W} zc={Z0} r={8} />
    </Frame>
  );
}

/** İki vagonlu metro treni, hat rengiyle şeritli; raylar üzerinde. */
export function Train3D({ width = 210, color = '#dc3232' }: { width?: number; color?: string }) {
  const W = 28, Z0 = 7, Z1 = 40, CAR = 96, GAP = 6;
  const cars = [0, CAR + GAP];
  const glass = '#16243a';
  return (
    <Frame box={[-46, -46, 248, 180]} width={width} label="Metro treni illüstrasyonu">
      {/* Raylar ve traversler */}
      {Array.from({ length: 14 }, (_, i) => (
        <polygon key={`s${i}`} fill="#3a3f48"
          points={pts([[-16 + i * 17, -2, 0], [-10 + i * 17, -2, 0], [-10 + i * 17, W + 2, 0], [-16 + i * 17, W + 2, 0]])} />
      ))}
      {[5, W - 5].map(y => (
        <polygon key={`r${y}`} fill="#9aa4b2"
          points={pts([[-18, y - 1, 1.5], [2 * CAR + GAP + 26, y - 1, 1.5], [2 * CAR + GAP + 26, y + 1, 1.5], [-18, y + 1, 1.5]])} />
      ))}
      <Shadow x0={0} x1={2 * CAR + GAP} y0={0} y1={W} />
      {cars.map((x0, ci) => (
        <g key={ci}>
          <Box x0={x0} x1={x0 + CAR} y0={0} y1={W} z0={Z0} z1={Z1} color="#dfe4ea" />
          {sideRect(W, x0, x0 + CAR, 11, 16, color)}
          {sideRect(W, x0, x0 + CAR, 36, 38, shade(color, 0.8))}
          {[6, 30, 56, 78].map((a, i) => sideRect(W, x0 + a, x0 + a + 14, 20, 34, glass, `g${ci}${i}`))}
          {[20, 46, 70].map((a, i) => sideRect(W, x0 + a, x0 + a + 8, 9, 34, shade(color, 0.55), `d${ci}${i}`))}
          <Wheel xc={x0 + 16} y={W} zc={Z0 - 1} r={5} />
          <Wheel xc={x0 + CAR - 16} y={W} zc={Z0 - 1} r={5} />
        </g>
      ))}
      {/* Kabin önü */}
      {frontRect(2 * CAR + GAP, 3, W - 3, 20, 36, glass)}
      {frontRect(2 * CAR + GAP, 0, W, 11, 16, color)}
      {frontRect(2 * CAR + GAP, 3, 7, 12, 15, '#fff7c2')}
      {frontRect(2 * CAR + GAP, W - 7, W - 3, 12, 15, '#fff7c2')}
    </Frame>
  );
}

/** Otopark: iki katlı yapı ve P tabelası. */
export function Parking3D({ width = 90 }: { width?: number }) {
  return (
    <Frame box={[-46, -36, 92, 96]} width={width} label="Otopark illüstrasyonu">
      <Shadow x0={0} x1={44} y0={0} y1={44} />
      <Box x0={0} x1={44} y0={0} y1={44} z0={0} z1={16} color="#8793a5" />
      <Box x0={0} x1={44} y0={0} y1={44} z0={18} z1={32} color="#9aa6b8" />
      {sideRect(44, 4, 40, 4, 12, '#2a3242')}
      {sideRect(44, 4, 40, 21, 29, '#2a3242')}
      <Box x0={34} x1={38} y0={36} y1={40} z0={32} z1={52} color="#6b7686" />
      {frontRect(38, 30, 46, 46, 62, '#1f6fd1')}
      {(() => {
        const [x, y] = iso([38, 38, 50]);
        return <text x={x} y={y + 4} fontSize="11" fontWeight="700" fill="#fff" textAnchor="middle">P</text>;
      })()}
    </Frame>
  );
}

/** Bisiklet istasyonu: park yuvası ve yanında izometrik bisiklet. */
export function Bicycle3D({ width = 120 }: { width?: number }) {
  const ring = (xc: number, zc: number, r: number): P3[] =>
    Array.from({ length: 24 }, (_, i) => {
      const t = (i / 24) * Math.PI * 2;
      return [xc + r * Math.cos(t), 14, zc + r * Math.sin(t)];
    });
  const line = (ps: P3[], color: string, w = 2.4) => (
    <polyline points={pts(ps)} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  );
  const frame = '#14a05a';
  return (
    <Frame box={[-26, -58, 104, 86]} width={width} label="Bisiklet illüstrasyonu">
      {/* Zemin plakası ve istasyon direği */}
      <polygon points={pts([[-6, -4, 0], [72, -4, 0], [72, 24, 0], [-6, 24, 0]])} fill="#2a3240" />
      <Box x0={60} x1={66} y0={0} y1={6} z0={0} z1={40} color="#9aa6b8" />
      <Box x0={57} x1={69} y0={-3} y1={9} z0={40} z1={46} color="#14a05a" />
      <polygon points={pts([[4, 16, 0], [56, 16, 0], [56, 24, 0], [4, 24, 0]])} fill="rgba(0,0,0,.35)" />
      {/* Tekerlekler */}
      <polygon points={pts(ring(12, 12, 11))} fill="none" stroke="#c9d1dc" strokeWidth={3} />
      <polygon points={pts(ring(48, 12, 11))} fill="none" stroke="#c9d1dc" strokeWidth={3} />
      {/* Kadro */}
      {line([[12, 14, 12], [27, 14, 12], [23, 14, 30], [12, 14, 12]], frame)}
      {line([[27, 14, 12], [44, 14, 28], [23, 14, 30]], frame)}
      {line([[44, 14, 28], [48, 14, 12]], frame)}
      {line([[42, 14, 34], [44, 14, 28]], '#c9d1dc', 2)}
      {line([[42, 8, 34], [42, 20, 34]], '#c9d1dc', 2.2)}
      {line([[19, 14, 33], [27, 14, 33]], '#1a1f27', 3.2)}
      {line([[22, 14, 30], [23, 14, 33]], '#c9d1dc', 2)}
    </Frame>
  );
}

// ── Harita ikonları (üstten, gölgeli) ──────────────────────────────────────
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Kuzeyi gösteren (burun yukarıda) üstten otobüs ikonu. */
export const BUS_ICON = {
  id: 'bus',
  width: 48,
  height: 64,
  anchorY: 32,
  url: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64" viewBox="0 0 48 64">
  <defs><linearGradient id="r" x1="0" x2="1"><stop offset="0" stop-color="#cfd6e0"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#b9c2cf"/></linearGradient></defs>
  <rect x="12" y="8" width="26" height="52" rx="7" fill="rgba(0,0,0,.45)"/>
  <rect x="10" y="4" width="26" height="52" rx="7" fill="url(#r)" stroke="#0b0f16" stroke-width="2"/>
  <rect x="13" y="7" width="20" height="8" rx="3" fill="#16243a"/>
  <rect x="10" y="20" width="4" height="30" fill="#1f6fd1"/><rect x="32" y="20" width="4" height="30" fill="#1f6fd1"/>
  <rect x="17" y="24" width="12" height="12" rx="2" fill="#dfe5ec" stroke="#9aa4b2"/>
  <rect x="15" y="4" width="16" height="3" rx="1.5" fill="#ffb020"/>
</svg>`),
};

const trainIconCache: Record<string, { id: string; url: string; width: number; height: number; anchorY: number }> = {};

/** Hat rengine boyanmış üstten iki vagonlu tren ikonu. */
export function trainIcon(rgb: [number, number, number]) {
  const key = rgb.join('-');
  if (!trainIconCache[key]) {
    const c = `rgb(${rgb.join(',')})`;
    trainIconCache[key] = {
      id: `train-${key}`,
      width: 36,
      height: 96,
      anchorY: 48,
      url: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="96" viewBox="0 0 36 96">
  <defs><linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="#c3cad4"/><stop offset=".5" stop-color="#f4f6f9"/><stop offset="1" stop-color="#aab3c0"/></linearGradient></defs>
  <rect x="10" y="8" width="20" height="86" rx="6" fill="rgba(0,0,0,.45)"/>
  <rect x="8" y="4" width="20" height="42" rx="8" fill="url(#t)" stroke="#0b0f16" stroke-width="2"/>
  <rect x="8" y="49" width="20" height="42" rx="3" fill="url(#t)" stroke="#0b0f16" stroke-width="2"/>
  <rect x="8" y="14" width="3" height="30" fill="${c}"/><rect x="25" y="14" width="3" height="30" fill="${c}"/>
  <rect x="8" y="51" width="3" height="38" fill="${c}"/><rect x="25" y="51" width="3" height="38" fill="${c}"/>
  <rect x="11" y="6" width="14" height="6" rx="3" fill="#16243a"/>
</svg>`),
    };
  }
  return trainIconCache[key];
}

export type ParkingLevel = 'free' | 'mid' | 'full' | 'unknown';

const PARKING_COLORS: Record<ParkingLevel, string> = {
  free: '#12a36a',     // < %70 dolu
  mid: '#d99a00',      // %70–90
  full: '#d93636',     // > %90
  unknown: '#1f6fd1',  // doluluk bilgisi yok
};

/** Boş yer / kapasite oranından doluluk seviyesi. */
export function parkingLevel(free?: number, capacity?: number): ParkingLevel {
  if (free === undefined || !capacity) return 'unknown';
  const occupancy = 1 - free / capacity;
  return occupancy < 0.7 ? 'free' : occupancy < 0.9 ? 'mid' : 'full';
}

const parkingIcons = {} as Record<ParkingLevel, { id: string; url: string; width: number; height: number; anchorY: number }>;

/** Doluluk rengine boyanmış "P" otopark ikonu. */
export function parkingIcon(level: ParkingLevel) {
  if (!parkingIcons[level]) {
    parkingIcons[level] = {
      id: `parking-${level}`,
      width: 40,
      height: 40,
      anchorY: 20,
      url: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <rect x="7" y="7" width="30" height="30" rx="8" fill="rgba(0,0,0,.45)"/>
  <rect x="4" y="4" width="30" height="30" rx="8" fill="${PARKING_COLORS[level]}" stroke="#0b0f16" stroke-width="2"/>
  <path d="M14 27V11h7a5 5 0 0 1 0 10h-7" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/>
</svg>`),
    };
  }
  return parkingIcons[level];
}

export const PARKING_ICON = parkingIcon('unknown');
export const PARKING_LEVEL_COLORS = PARKING_COLORS;

/** Yeşil zeminli bisiklet ikonu (bisiklet parkı / istasyonu). */
export const BIKE_ICON = {
  id: 'bike',
  width: 40,
  height: 40,
  anchorY: 20,
  url: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <circle cx="22" cy="22" r="16" fill="rgba(0,0,0,.45)"/>
  <circle cx="19" cy="19" r="16" fill="#14a05a" stroke="#0b0f16" stroke-width="2"/>
  <g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11.5" cy="22.5" r="4.5"/><circle cx="26.5" cy="22.5" r="4.5"/>
    <path d="M11.5 22.5l4.5-8h7l3.5 8M16 14.5l3.5 8h-8M21.5 11.5h3M15 12.5h3"/>
  </g>
</svg>`),
};

/** Mor zeminli teleferik kabini ikonu. */
export const CABLECAR_ICON = {
  id: 'cablecar',
  width: 40,
  height: 40,
  anchorY: 20,
  url: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <rect x="7" y="7" width="30" height="30" rx="8" fill="rgba(0,0,0,.45)"/>
  <rect x="4" y="4" width="30" height="30" rx="8" fill="#8a4fd8" stroke="#0b0f16" stroke-width="2"/>
  <path d="M8 11l22-3M19 9.5v5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
  <rect x="12" y="14.5" width="14" height="13" rx="3" fill="#fff"/>
  <rect x="14.5" y="17" width="9" height="4.5" rx="1" fill="#8a4fd8"/>
</svg>`),
};

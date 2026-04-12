import { useEffect, useState } from 'react';
import { API_BASE } from '../constants';

interface DistrictStat {
  district: string;
  congestionPct: number;
  avgCongestionRatio: number;
  sampleCount: number;
}

function congestionColor(pct: number): string {
  if (pct <= 20) return '#00D084';  // yeşil — serbest
  if (pct <= 50) return '#FFC300';  // sarı  — yavaş
  return '#FF4D4D';                 // kırmızı — tıkanık
}

export default function DistrictSidebar() {
  const [stats, setStats]     = useState<DistrictStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      fetch(`${API_BASE}/traffic/districts`)
        .then(r => r.json())
        .then((d: DistrictStat[]) => { setStats(d); setLoading(false); })
        .catch(() => setLoading(false));
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      position: 'absolute', top: 24, right: 24,
      background: 'rgba(13,17,23,0.90)',
      color: '#fff', padding: '14px 16px',
      borderRadius: 10, fontSize: 13,
      border: '1px solid #1E6FE8',
      backdropFilter: 'blur(6px)',
      minWidth: 210,
      maxHeight: 'calc(100vh - 48px)',
      overflowY: 'auto',
    }}>
      <div style={{ color: '#00C2FF', fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>
        BÖLGE YOĞUNLUĞU
      </div>

      {loading && <div style={{ color: '#555' }}>Yükleniyor…</div>}
      {!loading && stats.length === 0 && (
        <div style={{ color: '#555', fontSize: 11 }}>
          TomTom key girilince<br />burada veriler görünür.
        </div>
      )}

      {stats.map(s => (
        <div key={s.district} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#e2e8f0' }}>{s.district}</span>
            <span style={{ color: congestionColor(s.congestionPct), fontWeight: 600 }}>
              {s.congestionPct.toFixed(0)}%
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ background: '#1a1f2e', borderRadius: 4, height: 5, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(s.congestionPct, 100)}%`,
              height: '100%',
              background: congestionColor(s.congestionPct),
              borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

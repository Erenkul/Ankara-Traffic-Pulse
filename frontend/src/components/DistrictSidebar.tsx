import { useEffect, useState } from 'react';
import { API_BASE, congestionPctColor } from '../constants';

interface DistrictStat {
  district: string;
  congestionPct: number;
  avgCongestionRatio: number;
  sampleCount: number;
}

export default function DistrictSidebar({ onClose }: { onClose: () => void }) {
  const [stats, setStats]     = useState<DistrictStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`${API_BASE}/traffic/districts`)
        .then(r => r.json())
        .then((d: DistrictStat[]) => { if (!cancelled) setStats(d); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const sorted = [...stats].sort((a, b) => b.congestionPct - a.congestionPct);

  return (
    <section className="panel card" aria-label="Bölge yoğunluğu">
      <div className="card-head">
        <span className="panel-title">Bölge yoğunluğu</span>
        <button className="icon-btn" onClick={onClose} aria-label="Bölge panelini kapat">✕</button>
      </div>

      {loading && <div className="card-note">Yükleniyor…</div>}
      {!loading && sorted.length === 0 && (
        <div className="card-note">Henüz trafik ölçümü yok.</div>
      )}

      {sorted.map(s => {
        const color = congestionPctColor(s.congestionPct);
        return (
          <div className="row" key={s.district}>
            <div className="row-top">
              <span>{s.district}</span>
              <span className="val" style={{ color }}>%{s.congestionPct.toFixed(0)}</span>
            </div>
            <div className="track">
              <div style={{ width: `${Math.min(Math.max(s.congestionPct, 2), 100)}%`, background: color }} />
            </div>
          </div>
        );
      })}
      {sorted.length > 0 && <div className="card-note">En yoğundan en sakine · yüzde = hız kaybı</div>}
    </section>
  );
}

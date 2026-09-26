import type { PredictionSlot } from '../hooks/usePrediction';

interface Props {
  data: PredictionSlot[];
  loading: boolean;
  onClose: () => void;
}

const LABEL_COLOR: Record<string, string> = {
  Tıkanık: '#FF3232',
  Yoğun:   '#FF7800',
  Orta:    '#FFD200',
  Serbest: '#00D084',
};

const CONFIDENCE_ICON: Record<string, string> = {
  yüksek:    '★★★',
  orta:      '★★☆',
  heuristic: '★☆☆',
};

function congestionBar(ratio: number) {
  const pct = Math.round(ratio * 100);
  const color =
    ratio >= 0.75 ? '#FF3232' :
    ratio >= 0.55 ? '#FF7800' :
    ratio >= 0.35 ? '#FFD200' : '#00D084';
  return (
    <div style={{ marginTop: 4, background: '#1a2030', borderRadius: 4, height: 6, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4,
                    transition: 'width 0.6s ease' }} />
    </div>
  );
}

export default function PredictionPanel({ data, loading, onClose }: Props) {
  return (
    <div style={{
      background: 'rgba(13,17,23,0.93)',
      color: '#fff', padding: '14px 16px',
      borderRadius: 10, fontSize: 12,
      border: '1px solid #1E6FE8',
      backdropFilter: 'blur(6px)',
      minWidth: 230,
    }}>
      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: '#00C2FF', fontWeight: 700, letterSpacing: 1, fontSize: 13 }}>
          TAHMİN {loading && <span style={{ fontSize: 10, color: '#555' }}>yükleniyor…</span>}
        </span>
        <button onClick={onClose} aria-label="Tahmin panelini kapat" style={{
          background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, lineHeight: 1,
        }}>✕</button>
      </div>

      {data.length === 0 && !loading && (
        <div style={{ color: '#555', fontSize: 11 }}>Veri bekleniyor…</div>
      )}

      {data.map(slot => {
        const hhmm = new Date(slot.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
        const labelColor = LABEL_COLOR[slot.label] ?? '#888';
        const confIcon   = CONFIDENCE_ICON[slot.confidence] ?? '★☆☆';
        return (
          <div key={slot.deltaHours} style={{
            marginBottom: 10,
            paddingBottom: 8,
            borderBottom: '1px solid #1a2030',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ color: '#aaa', fontWeight: 600 }}>
                +{slot.deltaHours}s — {hhmm}
              </span>
              <span style={{ color: labelColor, fontWeight: 700 }}>{slot.label}</span>
            </div>
            {congestionBar(slot.predictedCongestion)}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
              <span style={{ color: '#444' }}>{Math.round(slot.predictedCongestion * 100)}% yoğunluk</span>
              <span style={{ color: '#333', fontSize: 9 }} title={`Güven: ${slot.confidence}`}>{confIcon}</span>
            </div>
          </div>
        );
      })}

      <div style={{ color: '#2a3040', fontSize: 10, marginTop: 2 }}>
        ★★★ ML model · ★★☆ az veri · ★☆☆ kural bazlı
      </div>
    </div>
  );
}

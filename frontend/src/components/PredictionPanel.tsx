import type { PredictionSlot } from '../hooks/usePrediction';
import { LEVEL_COLORS } from '../constants';

interface Props {
  data: PredictionSlot[];
  loading: boolean;
  onClose: () => void;
}

const LABEL_COLOR: Record<string, string> = {
  Tıkanık: LEVEL_COLORS.jam,
  Yoğun:   LEVEL_COLORS.busy,
  Orta:    LEVEL_COLORS.slow,
  Serbest: LEVEL_COLORS.free,
};

const CONFIDENCE_TEXT: Record<string, string> = {
  yüksek:    'ML modeli · 500+ kayıt',
  orta:      'ML modeli · 100+ kayıt',
  heuristic: 'Ankara saatlik profili (kural tabanlı)',
};

export default function PredictionPanel({ data, loading, onClose }: Props) {
  return (
    <section className="panel card" aria-label="Trafik tahmini">
      <div className="card-head">
        <span className="panel-title">Tahmin · sonraki {data.length || 4} saat</span>
        <button className="icon-btn" onClick={onClose} aria-label="Tahmin panelini kapat">✕</button>
      </div>

      {loading && data.length === 0 && <div className="card-note">Yükleniyor…</div>}
      {!loading && data.length === 0 && <div className="card-note">Tahmin alınamadı.</div>}

      {data.map(slot => {
        const hhmm = new Date(slot.timestamp).toLocaleTimeString('tr-TR', {
          hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul',
        });
        const color = LABEL_COLOR[slot.label] ?? '#888';
        const pct = Math.round(slot.predictedCongestion * 100);
        return (
          <div className="row" key={slot.deltaHours}>
            <div className="row-top">
              <span><span className="mono">{hhmm}</span> <span className="muted">+{slot.deltaHours} sa</span></span>
              <span style={{ color, fontWeight: 600 }}>{slot.label} <span className="val">%{pct}</span></span>
            </div>
            <div className="track"><div style={{ width: `${Math.max(pct, 2)}%`, background: color }} /></div>
          </div>
        );
      })}

      {data[0] && <div className="card-note">Kaynak: {CONFIDENCE_TEXT[data[0].confidence] ?? data[0].confidence}</div>}
    </section>
  );
}

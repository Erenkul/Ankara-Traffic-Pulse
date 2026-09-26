import { useEffect } from 'react';
import { AUTHOR } from '../constants';
import type { Meta } from '../hooks/useMeta';

const SOURCE_TEXT = {
  traffic: { tomtom: 'TomTom Traffic Flow API (canlı)', demo: 'Demo — saatlik Ankara profilinden üretilen örnek veri', none: 'Veri yok' },
  buses:   { ego: 'EGO (canlı)', demo: 'Demo — koridorlarda hareket eden örnek otobüsler', none: 'Veri yok' },
  metro:   { osm: 'OpenStreetMap (gerçek güzergâh)', static: 'Yerleşik veri (istasyonlar arası düz çizgi)' },
} as const;

export default function AboutDialog({ meta, onClose }: { meta: Meta | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="panel dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="card-head">
          <h2 id="about-title">Ankara Traffic Pulse</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat" autoFocus>✕</button>
        </div>
        <p>
          Ankara'nın 8 ana koridorundaki 32 noktada trafik yoğunluğunu, EGO otobüslerini ve
          raylı sistem hatlarını tek haritada gösterir. Yoğunluk, anlık hızın serbest akış
          hızına oranıdır.
        </p>
        <ul>
          <li><strong>Canlı:</strong> WebSocket ile anlık güncelleme</li>
          <li><strong>Geçmiş:</strong> son 7 günün seçilen saati</li>
          <li><strong>Haftalık:</strong> 7 günlük ortalama ısı haritası</li>
          <li><strong>Tahmin:</strong> önümüzdeki 4 saat (ML veya kural tabanlı)</li>
        </ul>
        {meta && (
          <div>
            <div className="panel-title" style={{ marginBottom: 6 }}>Şu anki veri kaynakları</div>
            <ul>
              <li>Trafik: {SOURCE_TEXT.traffic[meta.sources.traffic]}</li>
              <li>Otobüs: {SOURCE_TEXT.buses[meta.sources.buses]}</li>
              <li>Metro: {SOURCE_TEXT.metro[meta.sources.metro]}</li>
              <li>Geçmiş veri: {meta.db ? 'PostgreSQL bağlı' : 'veritabanı yok'}</li>
            </ul>
          </div>
        )}
        <p className="credit">
          Geliştiren <strong>{AUTHOR.name}</strong> ·{' '}
          <a href={AUTHOR.site} target="_blank" rel="noreferrer">alperenkul.com</a> ·{' '}
          <a href={AUTHOR.repo} target="_blank" rel="noreferrer">GitHub</a>
          <br />
          FastAPI · React · Deck.gl · MapLibre · Harita © CARTO © OpenStreetMap
        </p>
      </div>
    </div>
  );
}

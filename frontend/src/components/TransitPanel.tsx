import { useState } from 'react';
import { Bus3D, Train3D, Parking3D } from './illustrations';
import type { ParkingPoint, OpenDataSource } from '../hooks/useOpenData';

interface Line { id: string; name: string; color: [number, number, number] }

interface Props {
  busCount: number;
  busLive: boolean | null;
  lines: Line[];
  metroSource: 'osm' | 'static' | undefined;
  parking: ParkingPoint[];
  bikeCount: number;
  openSources: { parking: OpenDataSource | null; bike: OpenDataSource | null };
  onClose: () => void;
}

const rgb = (c: [number, number, number]) => `rgb(${c.join(',')})`;

export default function TransitPanel({
  busCount, busLive, lines, metroSource, parking, bikeCount, openSources, onClose,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = lines.find(l => l.id === selected) ?? lines[0];
  const totalFree = parking.reduce((s, p) => s + (p.free ?? 0), 0);
  const hasFree = parking.some(p => p.free !== undefined);

  return (
    <section className="panel card" aria-label="Ulaşım">
      <div className="card-head">
        <span className="panel-title">Ulaşım</span>
        <button className="icon-btn" onClick={onClose} aria-label="Ulaşım panelini kapat">✕</button>
      </div>

      <div className="transit-block">
        <div className="transit-art"><Bus3D width={150} /></div>
        <div className="transit-text">
          <strong>EGO otobüsleri</strong>
          <span className="muted">
            {busCount} araç · {busLive === null ? 'veri yok' : busLive ? 'canlı konum' : 'demo konum'}
          </span>
          <span className="card-note">30 sn'de bir güncellenir, harita üzerinde gidiş yönüne döner.</span>
        </div>
      </div>

      {active && (
        <div className="transit-block">
          <div className="transit-art"><Train3D width={190} color={rgb(active.color)} /></div>
          <div className="transit-text">
            <strong>Raylı sistem</strong>
            <div className="line-chips" role="group" aria-label="Hat seçin">
              {lines.map(l => (
                <button
                  key={l.id}
                  aria-pressed={l.id === active.id}
                  onClick={() => setSelected(l.id)}
                  style={{ ['--line' as string]: rgb(l.color) }}
                >{l.id === 'A1' ? 'Ankaray' : l.id}</button>
              ))}
            </div>
            <span className="muted">{active.name}</span>
            <span className="card-note">
              Güzergâh: {metroSource === 'osm' ? 'OpenStreetMap' : 'yerleşik veri (yaklaşık)'}.
              Haritadaki trenler temsilidir; canlı tren konumu yayınlanmıyor.
            </span>
          </div>
        </div>
      )}

      {parking.length > 0 && (
        <div className="transit-block">
          <div className="transit-art"><Parking3D width={80} /></div>
          <div className="transit-text">
            <strong>Otoparklar</strong>
            <span className="muted">
              {parking.length} otopark{hasFree ? ` · ${totalFree.toLocaleString('tr-TR')} boş yer` : ''}
            </span>
            {openSources.parking && (
              <a className="card-note" href={openSources.parking.page} target="_blank" rel="noreferrer">
                Kaynak: {openSources.parking.dataset}
              </a>
            )}
          </div>
        </div>
      )}

      {bikeCount > 0 && (
        <div className="transit-text">
          <strong>Bisiklet yolları</strong>
          <span className="muted">{bikeCount} yol parçası</span>
          {openSources.bike && (
            <a className="card-note" href={openSources.bike.page} target="_blank" rel="noreferrer">
              Kaynak: {openSources.bike.dataset}
            </a>
          )}
        </div>
      )}
    </section>
  );
}

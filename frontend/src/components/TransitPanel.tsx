import { useMemo, useState } from 'react';
import {
  Bus3D, Train3D, Parking3D, Bicycle3D, BIKE_ICON, CABLECAR_ICON,
  parkingIcon, parkingLevel, PARKING_LEVEL_COLORS,
} from './illustrations';
import type { OpenPoint, BikePath, OpenDataSource, OpenLayerKey } from '../hooks/useOpenData';

interface Line { id: string; name: string; color: [number, number, number] }

interface Props {
  busCount: number;
  busLive: boolean | null;
  lines: Line[];
  metroSource: 'osm' | 'static' | undefined;
  parking: OpenPoint[];
  bikeStations: OpenPoint[];
  cablecar: OpenPoint[];
  bike: BikePath[];
  openSources: Record<OpenLayerKey, OpenDataSource | null>;
  onFocus: (position: [number, number]) => void;
  onClose: () => void;
}

const rgb = (c: [number, number, number]) => `rgb(${c.join(',')})`;

const PROVIDER_TEXT: Record<OpenDataSource['provider'], string> = {
  file: 'ULASAV / Şeffaf Ankara (indirilen dosya)',
  seffaf: 'Şeffaf Ankara API',
  url: 'Harici veri adresi',
  ulasav: 'ULASAV',
  osm: 'OpenStreetMap',
};

function pathKm(paths: BikePath[]) {
  let km = 0;
  for (const { path } of paths) {
    for (let i = 1; i < path.length; i++) {
      const [x1, y1] = path[i - 1], [x2, y2] = path[i];
      const lat = ((y1 + y2) / 2) * (Math.PI / 180);
      km += Math.hypot((x2 - x1) * 111.32 * Math.cos(lat), (y2 - y1) * 110.57);
    }
  }
  return km;
}

function SourceNote({ source }: { source: OpenDataSource | null }) {
  if (!source) return null;
  return (
    <a className="card-note" href={source.page} target="_blank" rel="noreferrer" title={source.license}>
      Kaynak: {PROVIDER_TEXT[source.provider] ?? source.dataset}
    </a>
  );
}

function PlaceList({ items, onFocus, render }: {
  items: OpenPoint[];
  onFocus: (p: [number, number]) => void;
  render: (p: OpenPoint) => React.ReactNode;
}) {
  return (
    <ul className="place-list">
      {items.map((p, i) => (
        <li key={`${p.position.join(',')}-${i}`}>
          <button onClick={() => onFocus(p.position)}>{render(p)}</button>
        </li>
      ))}
    </ul>
  );
}

export default function TransitPanel({
  busCount, busLive, lines, metroSource, parking, bikeStations, cablecar, bike, openSources, onFocus, onClose,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = lines.find(l => l.id === selected) ?? lines[0];

  const parkingStats = useMemo(() => {
    const withOcc = parking.filter(p => p.free !== undefined && p.capacity);
    const cap = withOcc.reduce((s, p) => s + (p.capacity ?? 0), 0);
    const free = withOcc.reduce((s, p) => s + (p.free ?? 0), 0);
    const top = (withOcc.length ? withOcc : parking.filter(p => p.capacity || p.name))
      .slice()
      .sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0))
      .slice(0, 5);
    return { withOcc: withOcc.length, occupancy: cap ? 1 - free / cap : null, free, top };
  }, [parking]);

  const bikeStats = useMemo(() => ({
    km: pathKm(bike),
    capacity: bikeStations.reduce((s, p) => s + (p.capacity ?? 0), 0),
    rental: bikeStations.filter(p => p.kind === 'bicycle_rental').length,
    top: bikeStations.filter(p => p.name).slice(0, 5),
  }), [bike, bikeStations]);

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
            {cablecar.length > 0 && (
              <span className="muted inline-ico">
                <img src={CABLECAR_ICON.url} alt="" />Teleferik: {cablecar.length} durak
              </span>
            )}
            <span className="card-note">
              Güzergâh: {metroSource === 'osm' ? 'OpenStreetMap' : 'yerleşik veri (yaklaşık)'}.
              Haritadaki trenler temsilidir; canlı tren konumu yayınlanmıyor.
            </span>
          </div>
        </div>
      )}

      {parking.length > 0 && (
        <div className="transit-block">
          <div className="transit-art"><Parking3D width={84} /></div>
          <div className="transit-text">
            <strong>Otoparklar</strong>
            <span className="muted">
              {parking.length.toLocaleString('tr-TR')} otopark
              {parkingStats.withOcc > 0 && ` · ${parkingStats.free.toLocaleString('tr-TR')} boş yer`}
            </span>
            {parkingStats.occupancy !== null ? (
              <div className="row">
                <div className="row-top">
                  <span>Ortalama doluluk</span>
                  <span className="val">%{Math.round(parkingStats.occupancy * 100)}</span>
                </div>
                <div className="track">
                  <div style={{
                    width: `${Math.round(parkingStats.occupancy * 100)}%`,
                    background: PARKING_LEVEL_COLORS[parkingStats.occupancy < 0.7 ? 'free' : parkingStats.occupancy < 0.9 ? 'mid' : 'full'],
                  }} />
                </div>
              </div>
            ) : (
              <span className="card-note">
                Ankara Büyükşehir otopark doluluk verisi yayınlamıyor; konum ve kapasite gösteriliyor.
              </span>
            )}
            <div className="occ-legend">
              {(['free', 'mid', 'full', 'unknown'] as const).map(l => (
                <span key={l}>
                  <img src={parkingIcon(l).url} alt="" />
                  {{ free: '<%70', mid: '%70–90', full: '>%90', unknown: 'bilinmiyor' }[l]}
                </span>
              ))}
            </div>
            {parkingStats.top.length > 0 && (
              <PlaceList items={parkingStats.top} onFocus={onFocus} render={p => (
                <>
                  <img src={parkingIcon(parkingLevel(p.free, p.capacity)).url} alt="" />
                  <span className="pl-name">{p.name ?? 'Otopark'}</span>
                  <span className="pl-val">
                    {p.free !== undefined && p.capacity
                      ? `%${Math.round((1 - p.free / p.capacity) * 100)}`
                      : p.capacity ? `${p.capacity} araç` : ''}
                  </span>
                </>
              )} />
            )}
            <SourceNote source={openSources.parking} />
          </div>
        </div>
      )}

      {(bikeStations.length > 0 || bike.length > 0) && (
        <div className="transit-block">
          <div className="transit-art"><Bicycle3D width={130} /></div>
          <div className="transit-text">
            <strong>Bisiklet</strong>
            {bikeStations.length > 0 && (
              <span className="muted inline-ico">
                <img src={BIKE_ICON.url} alt="" />
                {bikeStations.length} park / istasyon
                {bikeStats.capacity > 0 && ` · ${bikeStats.capacity} bisiklet kapasitesi`}
              </span>
            )}
            {bike.length > 0 && (
              <span className="muted inline-ico">
                <b className="ico-line" />{bikeStats.km.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} km bisiklet yolu
              </span>
            )}
            {bikeStats.top.length > 0 && (
              <PlaceList items={bikeStats.top} onFocus={onFocus} render={p => (
                <>
                  <img src={BIKE_ICON.url} alt="" />
                  <span className="pl-name">{p.name}</span>
                  <span className="pl-val">{p.capacity ? `${p.capacity} yer` : ''}</span>
                </>
              )} />
            )}
            <SourceNote source={openSources.bikestations ?? openSources.bike} />
            {openSources.bike && openSources.bikestations
              && openSources.bike.provider !== openSources.bikestations.provider && (
              <SourceNote source={openSources.bike} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

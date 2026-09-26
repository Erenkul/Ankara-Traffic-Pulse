import { useCallback, useEffect, useState } from 'react';
import { Map } from 'react-map-gl/maplibre';
import { DeckGL } from '@deck.gl/react';
import { ScatterplotLayer, PathLayer, TextLayer, IconLayer, ColumnLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ANKARA_CENTER, CARTO_STYLE, LEVEL_COLORS } from '../constants';
import { useWebSocket } from '../hooks/useWebSocket';
import { useHistoricalData } from '../hooks/useHistoricalData';
import { useMetroData, type MetroPath, type MetroStation } from '../hooks/useMetroData';
import { useWeeklyHeatmap } from '../hooks/useWeeklyHeatmap';
import { usePrediction } from '../hooks/usePrediction';
import { useMeta, type Meta } from '../hooks/useMeta';
import { TimeSlider } from './TimeSlider';
import DistrictSidebar from './DistrictSidebar';
import PredictionPanel from './PredictionPanel';
import AboutDialog from './AboutDialog';
import TransitPanel from './TransitPanel';
import { BUS_ICON, PARKING_ICON, trainIcon } from './illustrations';
import { useTrains, type TrainPoint } from '../hooks/useTrains';
import { useOpenData, type ParkingPoint, type BikePath } from '../hooks/useOpenData';
import type { TrafficPoint, BusPoint } from '../types';

type ViewMode  = 'live' | 'history' | 'weekly';
type LayerMode = 'scatter' | 'heat' | 'columns';
type ViewState = typeof ANKARA_CENTER & { pitch?: number; bearing?: number; transitionDuration?: number };

// Canlı veri bu süreden eskiyse kullanıcı uyarılır
const STALE_AFTER_MS = 5 * 60_000;
const IS_NARROW = typeof window !== 'undefined' && window.innerWidth < 720;

type RGBA = [number, number, number, number];
const hex = (h: string, a: number): RGBA =>
  [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];

function getCongestionColor(ratio: number): RGBA {
  if (ratio >= 0.80) return hex(LEVEL_COLORS.free, 220);
  if (ratio >= 0.60) return hex(LEVEL_COLORS.slow, 225);
  if (ratio >= 0.40) return hex(LEVEL_COLORS.busy, 235);
  return hex(LEVEL_COLORS.jam, 245);
}

function levelName(ratio: number) {
  if (ratio >= 0.80) return 'Serbest';
  if (ratio >= 0.60) return 'Yavaş';
  if (ratio >= 0.40) return 'Yoğun';
  return 'Tıkanık';
}

function SourceBadge({ label, live }: { label: string; live: boolean | null }) {
  const cls = live === null ? 'off' : live ? 'live' : 'demo';
  const text = live === null ? 'yok' : live ? 'canlı' : 'demo';
  return <span className={`badge ${cls}`} title={`${label}: ${text}`}><i />{label} · {text}</span>;
}

function tooltipFor(o: unknown, lineColors: Record<string, [number, number, number]>) {
  if (!o || typeof o !== 'object') return null;
  let html = '';
  if ('bearing' in o && 'lineId' in o) {
    const t = o as TrainPoint;
    return { html: `<div class="tt-title">${t.name}</div><div class="tt-sub">Temsili tren · canlı konum değil</div>` };
  }
  if ('path' in o && !('id' in o)) {
    const b = o as BikePath;
    return { html: `<div class="tt-title">Bisiklet yolu</div>${b.name ? `<div class="tt-sub">${b.name}</div>` : ''}` };
  }
  if ('capacity' in o || 'free' in o || ('name' in o && !('lines' in o) && !('path' in o))) {
    const pk = o as ParkingPoint;
    const parts = [];
    if (pk.free !== undefined) parts.push(`${pk.free} boş`);
    if (pk.capacity !== undefined) parts.push(`${pk.capacity} kapasite`);
    return { html: `<div class="tt-title">${pk.name ?? 'Otopark'}</div>${parts.length ? `<div class="tt-sub">${parts.join(' · ')}</div>` : ''}` };
  }
  if ('congestionRatio' in o) {
    const t = o as TrafficPoint;
    const pct = Math.round((1 - t.congestionRatio) * 100);
    html = `<div class="tt-title">${levelName(t.congestionRatio)} · %${pct} yoğunluk</div>`;
    if (t.currentSpeed !== undefined && t.freeFlowSpeed !== undefined)
      html += `<div class="tt-sub">${t.currentSpeed} km/s · serbest akışta ${t.freeFlowSpeed} km/s</div>`;
    if (t.closed) html += '<div style="color:#FF4D4D">Yol kapalı</div>';
  } else if ('hatNo' in o) {
    const b = o as BusPoint;
    html = `<div class="tt-title">EGO hat ${b.hatNo}</div>`;
    if (b.hiz) html += `<div class="tt-sub">${b.hiz} km/s</div>`;
  } else if ('lines' in o) {
    const s = o as MetroStation;
    const chips = s.lines.map(l => {
      const c = lineColors[l] ?? [150, 150, 150];
      return `<span style="color:rgb(${c.join(',')});font-weight:600">${l}</span>`;
    }).join(' · ');
    html = `<div class="tt-title">${s.name}</div><div class="tt-sub">${chips}</div>`;
  } else if ('path' in o) {
    html = `<div class="tt-title">${(o as MetroPath).name}</div>`;
  }
  return html ? { html } : null;
}

export default function TrafficMap() {
  const [viewState, setViewState]     = useState<ViewState>(ANKARA_CENTER);
  const [viewMode, setViewMode]       = useState<ViewMode>('live');
  const [layerMode, setLayerMode]     = useState<LayerMode>('scatter');
  const [historyHour, setHistoryHour] = useState<number>(8);
  const [showSidebar, setShowSidebar]       = useState(!IS_NARROW);
  const [showMetro, setShowMetro]           = useState(true);
  const [showBuses, setShowBuses]           = useState(true);
  const [showPrediction, setShowPrediction] = useState(false);
  const [showControls, setShowControls]     = useState(!IS_NARROW);
  const [showAbout, setShowAbout]           = useState(false);
  const [showTransit, setShowTransit]       = useState(!IS_NARROW);
  const [showParking, setShowParking]       = useState(true);
  const [showBike, setShowBike]             = useState(true);

  const { trafficData: liveTraffic, busData, lastUpdate, connected } = useWebSocket();
  const { data: historyTraffic, loading: histLoading } = useHistoricalData(
    viewMode === 'history' ? historyHour : null
  );
  const { data: weeklyTraffic, loading: weeklyLoading } = useWeeklyHeatmap(viewMode === 'weekly');
  const { paths: metroPaths, stations, lineColors } = useMetroData();
  const { data: predData, loading: predLoading } = usePrediction(showPrediction);
  const { meta, reachable } = useMeta();
  const trains = useTrains(metroPaths, showMetro);
  const { parking, bike, sources: openSources } = useOpenData(meta?.openData);
  const lines = Object.values(Object.fromEntries(metroPaths.map(p => [p.id, { id: p.id, name: p.name, color: p.color }])));

  // "x dk önce" göstergesi için saat
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const dataAgeMs = lastUpdate ? now - lastUpdate.getTime() : null;
  const isStale   = dataAgeMs !== null && dataAgeMs > STALE_AFTER_MS;

  const activeTraffic: TrafficPoint[] =
    viewMode === 'live'    ? liveTraffic    :
    viewMode === 'history' ? historyTraffic :
    weeklyTraffic;

  const resetView = useCallback(() => {
    setViewState({ ...ANKARA_CENTER, pitch: layerMode === 'columns' ? 52 : 0,
      bearing: layerMode === 'columns' ? -18 : 0, transitionDuration: 700 } as ViewState);
  }, [layerMode]);

  const zoom = viewState.zoom;
  const toggleHeat = layerMode === 'heat';
  const columns = layerMode === 'columns';

  const setLayer = (mode: LayerMode) => {
    setLayerMode(mode);
    // 3B sütunlarda kamerayı eğ, diğerlerinde düz görünüme dön
    setViewState(vs => ({
      ...vs,
      pitch: mode === 'columns' ? 52 : 0,
      bearing: mode === 'columns' ? -18 : 0,
      transitionDuration: 700,
    }));
  };

  // ── Katmanlar ───────────────────────────────────────────────────────────────

  const layers = [
    new PathLayer<BikePath>({
      id: 'bike-layer',
      data: bike,
      getPath: d => d.path,
      getColor: [120, 220, 150, 190],
      getWidth: 2.5,
      widthUnits: 'pixels',
      pickable: true,
      visible: showBike && bike.length > 0,
    }),
    new PathLayer<MetroPath>({
      id: 'metro-layer',
      data: metroPaths,
      getPath: d => d.path,
      getColor: d => [...d.color, 210] as RGBA,
      getWidth: 5,
      widthUnits: 'pixels',
      capRounded: true,
      jointRounded: true,
      pickable: true,
      visible: showMetro,
    }),
    new HeatmapLayer<TrafficPoint>({
      id: 'traffic-heat',
      data: activeTraffic,
      getPosition: d => d.position,
      getWeight: d => 1 - d.congestionRatio,
      radiusPixels: 80,
      intensity: 1.2,
      threshold: 0.05,
      colorRange: [
        [0, 208, 132, 0],
        [0, 208, 132, 170],
        [255, 210, 0, 200],
        [255, 138, 31, 220],
        [255, 77, 77, 240],
        [200, 0, 50, 255],
      ],
      visible: toggleHeat,
    }),
    new ScatterplotLayer<TrafficPoint>({
      id: 'traffic-halo',
      data: activeTraffic,
      getPosition: d => d.position,
      getRadius: 18,
      radiusUnits: 'pixels',
      getFillColor: d => { const c = getCongestionColor(d.congestionRatio); return [c[0], c[1], c[2], 45]; },
      visible: layerMode === 'scatter',
    }),
    new ColumnLayer<TrafficPoint>({
      id: 'traffic-columns',
      data: activeTraffic,
      getPosition: d => d.position,
      diskResolution: 16,
      radius: 160,
      extruded: true,
      // Yoğunluk arttıkça sütun yükselir (yüzde × 30 m)
      getElevation: d => Math.max(0.03, 1 - d.congestionRatio) * 3000,
      getFillColor: d => getCongestionColor(d.congestionRatio),
      material: { ambient: 0.5, diffuse: 0.6, shininess: 20 },
      pickable: true,
      visible: columns,
      transitions: { getElevation: 800, getFillColor: 600 },
    }),
    new ScatterplotLayer<TrafficPoint>({
      id: 'traffic-scatter',
      data: activeTraffic,
      getPosition: d => d.position,
      getRadius: 8,
      radiusUnits: 'pixels',
      getFillColor: d => getCongestionColor(d.congestionRatio),
      getLineColor: [11, 15, 22, 255],
      stroked: true,
      lineWidthMinPixels: 1.5,
      pickable: true,
      visible: layerMode === 'scatter',
      transitions: { getFillColor: 600 },
    }),
    new ScatterplotLayer<MetroStation>({
      id: 'metro-stations',
      data: stations,
      getPosition: d => d.position,
      getRadius: 4,
      radiusUnits: 'pixels',
      getFillColor: [240, 244, 250, 255],
      getLineColor: d => [...(lineColors[d.lines[0]] ?? [150, 150, 150]), 255] as RGBA,
      stroked: true,
      lineWidthMinPixels: 2,
      pickable: true,
      visible: showMetro && zoom >= 11.5,
    }),
    new TextLayer<MetroStation>({
      id: 'metro-labels',
      data: stations,
      getPosition: d => d.position,
      getText: d => d.name,
      getSize: 11,
      getColor: [200, 210, 225, 230],
      getPixelOffset: [0, -12],
      characterSet: 'auto',
      fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
      outlineWidth: 3,
      outlineColor: [11, 15, 22, 255],
      fontSettings: { sdf: true },
      visible: showMetro && zoom >= 13.5,
    }),
    new IconLayer<ParkingPoint>({
      id: 'parking-layer',
      data: parking,
      getPosition: d => d.position,
      getIcon: () => PARKING_ICON,
      getSize: 26,
      sizeUnits: 'pixels',
      pickable: true,
      visible: showParking && parking.length > 0 && zoom >= 11,
    }),
    new IconLayer<TrainPoint>({
      id: 'train-layer',
      data: trains,
      getPosition: d => d.position,
      getIcon: d => trainIcon(d.color),
      getSize: 44,
      sizeUnits: 'pixels',
      getAngle: d => -d.bearing,
      billboard: false,
      pickable: true,
      visible: showMetro,
      transitions: { getPosition: { duration: 2000, enter: (v: number[]) => v } },
    }),
    new IconLayer<BusPoint>({
      id: 'bus-layer',
      data: busData,
      getPosition: d => d.position,
      getIcon: () => BUS_ICON,
      getSize: 30,
      sizeUnits: 'pixels',
      getAngle: d => -(d.yon ?? 0),
      billboard: false,
      pickable: true,
      visible: viewMode === 'live' && showBuses,
      // Konum değiştiğinde 28 sn boyunca yumuşak geçiş (30 sn yenilemeye denk)
      transitions: { getPosition: { duration: 28_000, enter: (v: number[]) => v } },
    }),
    new TextLayer<BusPoint>({
      id: 'bus-labels',
      data: busData,
      getPosition: d => d.position,
      getText: d => d.hatNo,
      getSize: 10,
      getColor: [0, 194, 255, 255],
      getPixelOffset: [0, -18],
      characterSet: 'auto',
      fontFamily: 'IBM Plex Mono, monospace',
      outlineWidth: 3,
      outlineColor: [11, 15, 22, 255],
      fontSettings: { sdf: true },
      visible: viewMode === 'live' && showBuses && zoom >= 13,
      transitions: { getPosition: { duration: 28_000, enter: (v: number[]) => v } },
    }),
  ];

  const src = meta?.sources;
  const trafficLive = !reachable ? null : src ? (src.traffic === 'none' ? null : src.traffic === 'tomtom') : null;
  const busesLive   = !reachable ? null : src ? (src.buses === 'none' ? null : src.buses === 'ego') : null;
  const anyDemo = src?.traffic === 'demo' || src?.buses === 'demo';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as ViewState)}
        controller={true}
        layers={layers}
        style={{ width: '100%', height: '100%' }}
        getTooltip={(info: { object?: unknown }) => tooltipFor(info.object, lineColors)}
      >
        <Map mapStyle={CARTO_STYLE} />
      </DeckGL>

      {/* ── Sol üst: başlık + kontroller ── */}
      <div className="top-left">
        <header className="panel brand">
          <div className="brand-row">
            <h1>Ankara Traffic Pulse</h1>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="icon-btn" onClick={resetView} aria-label="Görünümü sıfırla" title="Görünümü sıfırla">⌖</button>
              <button className="icon-btn" onClick={() => setShowAbout(true)} aria-label="Proje hakkında" title="Hakkında">i</button>
              <button
                className="icon-btn"
                onClick={() => setShowControls(s => !s)}
                aria-expanded={showControls}
                aria-label={showControls ? 'Kontrolleri gizle' : 'Kontrolleri göster'}
                title="Kontroller"
              >{showControls ? '▴' : '▾'}</button>
            </div>
          </div>
          <p>Ankara'nın 8 ana koridorunda anlık trafik, EGO otobüsleri ve raylı sistem.</p>
          <div className="badges">
            <span className={`badge ${!reachable ? 'off' : connected ? 'live' : 'demo'}`}>
              <i />{!reachable ? 'sunucu yok' : connected ? 'canlı bağlantı' : 'yedek bağlantı'}
            </span>
            <SourceBadge label="Trafik" live={trafficLive} />
            <SourceBadge label="Otobüs" live={busesLive} />
          </div>
          {anyDemo && (
            <p className="status-line warn" style={{ display: 'block' }}>
              Demo modunda örnek veri gösteriliyor.
            </p>
          )}
        </header>

        {showControls && (
          <section className="panel controls" aria-label="Harita kontrolleri">
            <div className="control-group">
              <span className="panel-title">Zaman</span>
              <div className="segmented" role="group" aria-label="Zaman">
                <button aria-pressed={viewMode === 'live'}    onClick={() => setViewMode('live')}>Canlı</button>
                <button aria-pressed={viewMode === 'history'} onClick={() => setViewMode('history')}>Geçmiş</button>
                <button aria-pressed={viewMode === 'weekly'}  onClick={() => setViewMode('weekly')}>
                  Haftalık{weeklyLoading ? '…' : ''}
                </button>
              </div>
            </div>

            <div className="control-group">
              <span className="panel-title">Gösterim</span>
              <div className="segmented" role="group" aria-label="Gösterim">
                <button aria-pressed={layerMode === 'scatter'} onClick={() => setLayer('scatter')}>Noktalar</button>
                <button aria-pressed={layerMode === 'heat'}    onClick={() => setLayer('heat')}>Isı</button>
                <button aria-pressed={layerMode === 'columns'} onClick={() => setLayer('columns')}>3B sütun</button>
              </div>
            </div>

            <div className="control-group">
              <span className="panel-title">Katmanlar</span>
              <div className="toggles">
                <button aria-pressed={showBuses} onClick={() => setShowBuses(s => !s)}>
                  <img className="ico" src={BUS_ICON.url} alt="" />Otobüs
                </button>
                <button aria-pressed={showMetro} onClick={() => setShowMetro(s => !s)}>
                  <img className="ico" src={trainIcon([220, 50, 50]).url} alt="" />Raylı sistem
                </button>
                {parking.length > 0 && (
                  <button aria-pressed={showParking} onClick={() => setShowParking(s => !s)}>
                    <img className="ico" src={PARKING_ICON.url} alt="" />Otopark
                  </button>
                )}
                {bike.length > 0 && (
                  <button aria-pressed={showBike} onClick={() => setShowBike(s => !s)}><i />Bisiklet</button>
                )}
                <button aria-pressed={showTransit}    onClick={() => setShowTransit(s => !s)}><i />Ulaşım paneli</button>
                <button aria-pressed={showSidebar}    onClick={() => setShowSidebar(s => !s)}><i />Bölgeler</button>
                <button aria-pressed={showPrediction} onClick={() => setShowPrediction(s => !s)}><i />Tahmin</button>
              </div>
            </div>

            <div className="control-group">
              <span className="panel-title">Yoğunluk · hız / serbest akış</span>
              <div className="legend-scale">
                <span style={{ background: LEVEL_COLORS.free }} />
                <span style={{ background: LEVEL_COLORS.slow }} />
                <span style={{ background: LEVEL_COLORS.busy }} />
                <span style={{ background: LEVEL_COLORS.jam }} />
              </div>
              <div className="legend-labels">
                <span>Serbest</span><span>Yavaş</span><span>Yoğun</span><span>Tıkanık</span>
              </div>
              {(showMetro || showBuses) && (
                <div className="legend-lines">
                  {showBuses && <span><img src={BUS_ICON.url} alt="" style={{ height: 14 }} />EGO</span>}
                  {showMetro && Object.entries(lineColors).map(([id, c]) => (
                    <span key={id}><b style={{ background: `rgb(${c.join(',')})` }} />{id === 'A1' ? 'Ankaray' : id}</span>
                  ))}
                </div>
              )}
            </div>

            <StatusLine
              viewMode={viewMode}
              lastUpdate={lastUpdate}
              isStale={isStale}
              dataAgeMs={dataAgeMs}
              empty={activeTraffic.length === 0}
              meta={meta}
            />
          </section>
        )}
      </div>

      {viewMode === 'history' && (
        <TimeSlider
          value={historyHour}
          loading={histLoading}
          count={historyTraffic.length}
          onChange={setHistoryHour}
        />
      )}

      {/* ── Sağ panel sütunu ── */}
      {(showPrediction || showSidebar || showTransit) && (
        <div className={`right-col${viewMode === 'history' ? ' with-slider' : ''}`}>
          {showPrediction && (
            <PredictionPanel data={predData} loading={predLoading} onClose={() => setShowPrediction(false)} />
          )}
          {showTransit && (
            <TransitPanel
              busCount={busData.length}
              busLive={busesLive}
              lines={lines}
              metroSource={meta?.sources.metro}
              parking={parking}
              bikeCount={bike.length}
              openSources={openSources}
              onClose={() => setShowTransit(false)}
            />
          )}
          {showSidebar && <DistrictSidebar onClose={() => setShowSidebar(false)} />}
        </div>
      )}

      {showAbout && <AboutDialog meta={meta} onClose={() => setShowAbout(false)} />}
    </div>
  );
}

function StatusLine({ viewMode, lastUpdate, isStale, dataAgeMs, empty, meta }: {
  viewMode: ViewMode;
  lastUpdate: Date | null;
  isStale: boolean;
  dataAgeMs: number | null;
  empty: boolean;
  meta: Meta | null;
}) {
  if (viewMode !== 'live') {
    if (empty && meta && !meta.db)
      return <div className="status-line warn">Geçmiş veri için PostgreSQL gerekir.</div>;
    if (empty) return <div className="status-line">Bu aralıkta ölçüm yok.</div>;
    return null;
  }
  if (!lastUpdate) return <div className="status-line">Bağlanıyor…</div>;
  return (
    <>
      <div className={`status-line${isStale ? ' warn' : ''}`}>
        Son güncelleme {lastUpdate.toLocaleTimeString('tr-TR')}
        {isStale && ` · ${Math.round(dataAgeMs! / 60_000)} dk önce`}
      </div>
      {empty && <div className="status-line warn">Trafik noktası yok. TOMTOM_API_KEY tanımlı mı?</div>}
    </>
  );
}

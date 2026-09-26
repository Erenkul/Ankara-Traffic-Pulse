import { useEffect, useState } from 'react';
import { Map } from 'react-map-gl/maplibre';
import { DeckGL } from '@deck.gl/react';
import { ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ANKARA_CENTER, CARTO_STYLE } from '../constants';
import { useWebSocket } from '../hooks/useWebSocket';
import { useHistoricalData } from '../hooks/useHistoricalData';
import { useMetroData } from '../hooks/useMetroData';
import { useWeeklyHeatmap } from '../hooks/useWeeklyHeatmap';
import { usePrediction } from '../hooks/usePrediction';
import { TimeSlider } from './TimeSlider';
import DistrictSidebar from './DistrictSidebar';
import PredictionPanel from './PredictionPanel';
import type { TrafficPoint, BusPoint } from '../types';
import type { MetroRoute } from '../hooks/useMetroData';

type ViewMode  = 'live' | 'history' | 'weekly';

// Canlı veri bu süreden eskiyse kullanıcı uyarılır
const STALE_AFTER_MS = 5 * 60_000;
type LayerMode = 'scatter' | 'heat';

function getCongestionColor(ratio: number): [number, number, number, number] {
  if (ratio >= 0.80) return [0, 208, 132, 220];   // yeşil  — serbest
  if (ratio >= 0.60) return [255, 210, 0,   220];  // sarı   — yavaş
  if (ratio >= 0.40) return [255, 120, 0,   230];  // turuncu — yoğun
  return                    [255,  50, 50,  240];  // kırmızı — tıkanık
}

export default function TrafficMap() {
  const [viewState, setViewState]     = useState(ANKARA_CENTER);
  const [viewMode, setViewMode]       = useState<ViewMode>('live');
  const [layerMode, setLayerMode]     = useState<LayerMode>('scatter');
  const [historyHour, setHistoryHour] = useState<number>(8);
  const [showSidebar, setShowSidebar]       = useState(true);
  const [showMetro, setShowMetro]           = useState(true);
  const [showPrediction, setShowPrediction] = useState(false);

  const { trafficData: liveTraffic, busData, lastUpdate, connected } = useWebSocket();
  const { data: historyTraffic, loading: histLoading } = useHistoricalData(
    viewMode === 'history' ? historyHour : null
  );
  const { data: weeklyTraffic, loading: weeklyLoading } = useWeeklyHeatmap(viewMode === 'weekly');
  const { routes: metroRoutes } = useMetroData();
  const { data: predData, loading: predLoading } = usePrediction(showPrediction);

  // "x dk önce" göstergesi için dakikalık saat
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

  // ── Katmanlar ───────────────────────────────────────────────────────────────

  const scatterLayer = new ScatterplotLayer<TrafficPoint>({
    id: 'traffic-scatter',
    data: activeTraffic,
    getPosition: d => d.position,
    getRadius: 300,
    getFillColor: d => getCongestionColor(d.congestionRatio),
    getLineColor: d => getCongestionColor(d.congestionRatio),
    opacity: 0.85,
    stroked: true,
    lineWidthMinPixels: 2,
    radiusMinPixels: 8,
    pickable: true,
    visible: layerMode === 'scatter',
  });

  const heatLayer = new HeatmapLayer<TrafficPoint>({
    id: 'traffic-heat',
    data: activeTraffic,
    getPosition: d => d.position,
    getWeight: d => 1 - d.congestionRatio,
    radiusPixels: 80,
    intensity: 1.2,
    threshold: 0.05,
    colorRange: [
      [0, 208, 132, 0],
      [0, 208, 132, 180],
      [255, 195, 0, 200],
      [255, 130, 0, 220],
      [255, 77, 77, 240],
      [200, 0, 50, 255],
    ],
    visible: layerMode === 'heat',
  });

  const busLayer = new ScatterplotLayer<BusPoint>({
    id: 'bus-layer',
    data: busData,
    getPosition: d => d.position,
    getRadius: 80,
    getFillColor: [0, 194, 255, 230],
    radiusMinPixels: 6,
    pickable: true,
    visible: viewMode === 'live',
    // Otobüs konumları değiştiğinde 28 sn boyunca yumuşak geçiş (30 sn refresh'e denk)
    transitions: {
      getPosition: { duration: 28_000, enter: (v: number[]) => v },
    },
  });

  const metroLayer = new PathLayer<MetroRoute>({
    id: 'metro-layer',
    data: metroRoutes,
    getPath: d => d.geometry.coordinates,
    getColor: d => [...d.properties.color, 220] as [number, number, number, number],
    getWidth: 4,
    widthMinPixels: 3,
    pickable: true,
    visible: showMetro,
  });

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as typeof ANKARA_CENTER)}
        controller={true}
        layers={[heatLayer, scatterLayer, busLayer, metroLayer]}
        style={{ width: '100%', height: '100%' }}
        getTooltip={({ object }) => {
          const o = object as TrafficPoint | BusPoint | MetroRoute | null;
          if (!o) return null;
          if ('congestionRatio' in o) {
            const lines = [`Yoğunluk: ${Math.round((1 - o.congestionRatio) * 100)}%`];
            if (o.currentSpeed !== undefined && o.freeFlowSpeed !== undefined)
              lines.push(`Hız: ${o.currentSpeed} / ${o.freeFlowSpeed} km/s`);
            if (o.closed) lines.push('⚠ Yol kapalı');
            return lines.join('\n');
          }
          if ('hatNo' in o)
            return o.hiz ? `Hat: ${o.hatNo}\nHız: ${o.hiz} km/s` : `Hat: ${o.hatNo}`;
          if ('properties' in o)
            return o.properties.name;
          return null;
        }}
      >
        <Map mapStyle={CARTO_STYLE} />
      </DeckGL>

      {/* ── Sol Alt Kontrol Paneli ── */}
      <div style={{
        position: 'absolute', bottom: 24, left: 24,
        background: 'rgba(13,17,23,0.90)',
        color: '#fff', padding: '12px 16px',
        borderRadius: 10, fontSize: 13,
        border: '1px solid #1E6FE8',
        backdropFilter: 'blur(6px)',
      }}>
        <div style={{ color: '#00C2FF', fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
          ANKARA TRAFFIC PULSE
          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 400, color: connected ? '#00D084' : '#FF4D4D' }}>
            {connected ? '● WS' : '● REST'}
          </span>
        </div>

        {/* Katman */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
          <button onClick={() => setLayerMode('scatter')} style={btn(layerMode === 'scatter')}>Nokta</button>
          <button onClick={() => setLayerMode('heat')}    style={btn(layerMode === 'heat')}>Isı</button>
        </div>

        {/* Mod */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
          <button onClick={() => setViewMode('live')}    style={btn(viewMode === 'live')}>Canlı</button>
          <button onClick={() => setViewMode('history')} style={btn(viewMode === 'history')}>Geçmiş</button>
          <button onClick={() => setViewMode('weekly')}  style={btn(viewMode === 'weekly')}>Haftalık {weeklyLoading ? '…' : ''}</button>
        </div>

        {/* Metro + Bölge + Tahmin toggle */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowMetro(s => !s)}      style={btn(showMetro)}>Metro</button>
          <button onClick={() => setShowSidebar(s => !s)}    style={btn(showSidebar)}>Bölgeler</button>
          <button onClick={() => setShowPrediction(s => !s)} style={btn(showPrediction)}>Tahmin</button>
        </div>

        {/* Lejant */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ color: '#00D084' }}>● Serbest</span>
          <span style={{ color: '#FFD200' }}>● Yavaş</span>
          <span style={{ color: '#FF7800' }}>● Yoğun</span>
          <span style={{ color: '#FF3232' }}>● Tıkanık</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: '#00C2FF' }}>● EGO Otobüs</span>
          {showMetro && (
            <>
              <span style={{ color: '#DC3232' }}>— M1</span>
              <span style={{ color: '#3264DC' }}>— M2</span>
              <span style={{ color: '#1EB464' }}>— Ankaray</span>
              <span style={{ color: '#B450DC' }}>— M3</span>
            </>
          )}
        </div>

        {lastUpdate && (
          <div style={{ color: isStale ? '#FF7800' : '#555', marginTop: 6, fontSize: 11 }}>
            Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
            {isStale && ` · ${Math.round(dataAgeMs! / 60_000)} dk önce — veri bayat`}
          </div>
        )}
        {viewMode === 'live' && lastUpdate && liveTraffic.length === 0 && (
          <div style={{ color: '#FF7800', marginTop: 4, fontSize: 11 }}>
            Trafik noktası yok — TOMTOM_API_KEY tanımlı mı?
          </div>
        )}
      </div>

      {/* ── TimeSlider (Geçmiş modda) ── */}
      {viewMode === 'history' && (
        <TimeSlider
          value={historyHour}
          min={0}
          max={23}
          loading={histLoading}
          onChange={setHistoryHour}
          label="Saate Göre Geçmiş (Son 7 Gün)"
        />
      )}

      {/* ── Sağ panel sütunu: Tahmin + Bölgeler üst üste binmeden alt alta ── */}
      {(showPrediction || showSidebar) && (
        <div style={{
          position: 'absolute', top: 24, right: 24,
          display: 'flex', flexDirection: 'column', gap: 12,
          maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
        }}>
          {showPrediction && (
            <PredictionPanel
              data={predData}
              loading={predLoading}
              onClose={() => setShowPrediction(false)}
            />
          )}
          {showSidebar && <DistrictSidebar />}
        </div>
      )}
    </div>
  );
}

function btn(active: boolean): React.CSSProperties {
  return {
    padding: '3px 10px',
    borderRadius: 5,
    border: `1px solid ${active ? '#1E6FE8' : '#2a3040'}`,
    background: active ? '#1E6FE8' : 'transparent',
    color: active ? '#fff' : '#888',
    cursor: 'pointer',
    fontSize: 12,
  };
}

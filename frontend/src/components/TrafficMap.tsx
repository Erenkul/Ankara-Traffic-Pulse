import { useState } from 'react';
import { Map } from 'react-map-gl/maplibre';
import { DeckGL } from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ANKARA_CENTER, CARTO_STYLE } from '../constants';
import { useWebSocket } from '../hooks/useWebSocket';
import { useHistoricalData } from '../hooks/useHistoricalData';
import { TimeSlider } from './TimeSlider';
import DistrictSidebar from './DistrictSidebar';
import type { TrafficPoint, BusPoint } from '../hooks/useTrafficData';

type ViewMode = 'live' | 'history';
type LayerMode = 'scatter' | 'heat';

function getCongestionColor(ratio: number): [number, number, number, number] {
  if (ratio >= 0.8) return [0, 208, 132, 220];
  if (ratio >= 0.5) return [255, 195, 0, 220];
  return [255, 77, 77, 220];
}

export default function TrafficMap() {
  const [viewState, setViewState] = useState(ANKARA_CENTER);
  const [viewMode, setViewMode]   = useState<ViewMode>('live');
  const [layerMode, setLayerMode] = useState<LayerMode>('scatter');
  const [historyHour, setHistoryHour] = useState<number>(8);
  const [showSidebar, setShowSidebar] = useState(true);

  const { trafficData: liveTraffic, busData, lastUpdate, connected } = useWebSocket();
  const { data: historyTraffic, loading: histLoading } = useHistoricalData(
    viewMode === 'history' ? historyHour : null
  );

  const activeTraffic: TrafficPoint[] = viewMode === 'live' ? liveTraffic : historyTraffic;

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
    getWeight: d => 1 - d.congestionRatio,  // daha tıkanık = daha sıcak
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
  });

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as typeof ANKARA_CENTER)}
        controller={true}
        layers={[heatLayer, scatterLayer, busLayer]}
        style={{ width: '100%', height: '100%' }}
        getTooltip={({ object }) => {
          const o = object as TrafficPoint | BusPoint | null;
          if (!o) return null;
          if ('congestionRatio' in o)
            return `Yoğunluk: ${Math.round((1 - o.congestionRatio) * 100)}%`;
          if ('hatNo' in o) return `Hat: ${o.hatNo}`;
          return null;
        }}
      >
        <Map mapStyle={CARTO_STYLE} />
      </DeckGL>

      {/* ── Sol Alt Bilgi Paneli ── */}
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
          <span style={{
            marginLeft: 8, fontSize: 10, fontWeight: 400,
            color: connected ? '#00D084' : '#FF4D4D',
          }}>
            {connected ? '● WS' : '● REST'}
          </span>
        </div>

        {/* Katman seçici */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button onClick={() => setLayerMode('scatter')} style={btnStyle(layerMode === 'scatter')}>
            Nokta
          </button>
          <button onClick={() => setLayerMode('heat')} style={btnStyle(layerMode === 'heat')}>
            Isı Haritası
          </button>
        </div>

        {/* Mod seçici */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button onClick={() => setViewMode('live')} style={btnStyle(viewMode === 'live')}>
            Canlı
          </button>
          <button onClick={() => setViewMode('history')} style={btnStyle(viewMode === 'history')}>
            Geçmiş
          </button>
          <button onClick={() => setShowSidebar(s => !s)} style={btnStyle(showSidebar)}>
            Bölgeler
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
          <span style={{ color: '#00D084' }}>● Serbest</span>
          <span style={{ color: '#FFC300' }}>● Yavaş</span>
          <span style={{ color: '#FF4D4D' }}>● Tıkanık</span>
        </div>
        <div style={{ color: '#00C2FF' }}>● EGO Otobüs</div>
        {lastUpdate && (
          <div style={{ color: '#555', marginTop: 6, fontSize: 11 }}>
            Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
          </div>
        )}
      </div>

      {/* ── Zaman Kaydırıcı (Geçmiş modda) ── */}
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

      {/* ── Bölge Sidebar ── */}
      {showSidebar && <DistrictSidebar />}
    </div>
  );
}

function btnStyle(active: boolean): React.CSSProperties {
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

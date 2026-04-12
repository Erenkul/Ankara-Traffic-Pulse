import { useState } from 'react';
import { Map } from 'react-map-gl/maplibre';
import { DeckGL } from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ANKARA_CENTER, CARTO_STYLE } from '../constants';
import { useTrafficData, TrafficPoint, BusPoint } from '../hooks/useTrafficData';

function getCongestionColor(ratio: number): [number, number, number, number] {
  if (ratio >= 0.8) return [0, 208, 132, 220];   // yeşil — serbest
  if (ratio >= 0.5) return [255, 195, 0, 220];    // sarı  — yavaş
  return [255, 77, 77, 220];                       // kırmızı — tıkanık
}

export default function TrafficMap() {
  const [viewState, setViewState] = useState(ANKARA_CENTER);
  const { trafficData, busData, lastUpdate } = useTrafficData();

  const trafficLayer = new ScatterplotLayer<TrafficPoint>({
    id: 'traffic-layer',
    data: trafficData,
    getPosition: d => d.position,
    getRadius: 300,
    getFillColor: d => getCongestionColor(d.congestionRatio),
    getLineColor: d => getCongestionColor(d.congestionRatio),
    opacity: 0.8,
    stroked: true,
    lineWidthMinPixels: 2,
    radiusMinPixels: 8,
    pickable: true
  });

  const busLayer = new ScatterplotLayer<BusPoint>({
    id: 'bus-layer',
    data: busData,
    getPosition: d => d.position,
    getRadius: 80,
    getFillColor: [0, 194, 255, 230],
    radiusMinPixels: 6,
    pickable: true
  });

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as typeof ANKARA_CENTER)}
        controller={true}
        layers={[trafficLayer, busLayer]}
        style={{ width: '100%', height: '100%' }}
        getTooltip={({ object }) => {
          const o = object as TrafficPoint | BusPoint | null;
          if (!o) return null;
          if ('congestionRatio' in o)
            return `Yoğunluk: ${Math.round((1 - o.congestionRatio) * 100)}%`;
          if ('hatNo' in o)
            return `Hat: ${o.hatNo}`;
          return null;
        }}
      >
        <Map mapStyle={CARTO_STYLE} />
      </DeckGL>

      {/* Bilgi Paneli */}
      <div style={{
        position: 'absolute', bottom: 24, left: 24,
        background: 'rgba(13, 17, 23, 0.88)',
        color: '#fff', padding: '12px 16px',
        borderRadius: 10, fontSize: 13,
        border: '1px solid #1E6FE8',
        backdropFilter: 'blur(6px)'
      }}>
        <div style={{ color: '#00C2FF', fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
          ANKARA TRAFFIC PULSE
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
          <span style={{ color: '#00D084' }}>● Serbest</span>
          <span style={{ color: '#FFC300' }}>● Yavaş</span>
          <span style={{ color: '#FF4D4D' }}>● Tıkanık</span>
        </div>
        <div style={{ color: '#00C2FF' }}>● EGO Otobüs</div>
        {lastUpdate && (
          <div style={{ color: '#555', marginTop: 8, fontSize: 11 }}>
            Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
          </div>
        )}
      </div>
    </div>
  );
}

import { ScatterplotLayer } from '@deck.gl/layers';
import { BusPoint } from '../hooks/useTrafficData';

export function createBusLayer(data: BusPoint[]) {
  return new ScatterplotLayer<BusPoint>({
    id: 'bus-layer',
    data,
    getPosition: d => d.position,
    getRadius: 80,
    getFillColor: [0, 194, 255, 230],
    radiusMinPixels: 6,
    pickable: true
  });
}

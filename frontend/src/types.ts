export interface TrafficPoint {
  position: [number, number];
  congestionRatio: number;
  closed: boolean;
  currentSpeed?: number;
  freeFlowSpeed?: number;
}

export interface BusPoint {
  position: [number, number];
  hatNo: string;
  hiz?: number;
}

export interface TrafficFeatureCollection {
  features: {
    geometry: { coordinates: [number, number] };
    properties: {
      congestionRatio: number;
      closed?: boolean;
      currentSpeed?: number;
      freeFlowSpeed?: number;
    };
  }[];
}

export interface RawBus {
  hatNo: string;
  enlem: number;
  boylam: number;
  hiz?: number | null;
}

export function toTrafficPoints(fc: TrafficFeatureCollection): TrafficPoint[] {
  return fc.features.map(f => ({
    position: f.geometry.coordinates,
    congestionRatio: f.properties.congestionRatio,
    closed: f.properties.closed ?? false,
    currentSpeed: f.properties.currentSpeed,
    freeFlowSpeed: f.properties.freeFlowSpeed,
  }));
}

export function toBusPoints(buses: RawBus[]): BusPoint[] {
  // hatNo'ya göre sırala → deck.gl transitions için stabil dizi indeksi
  return [...buses]
    .sort((a, b) => a.hatNo.localeCompare(b.hatNo))
    .map(b => ({
      position: [b.boylam, b.enlem] as [number, number],
      hatNo: b.hatNo,
      hiz: b.hiz ?? undefined,
    }));
}

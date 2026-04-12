import { useState, useEffect } from 'react';
import { API_BASE, TRAFFIC_REFRESH_MS } from '../constants';

export interface TrafficPoint {
  position: [number, number];
  congestionRatio: number;
  closed: boolean;
}

export interface BusPoint {
  position: [number, number];
  hatNo: string;
}

export function useTrafficData() {
  const [trafficData, setTrafficData] = useState<TrafficPoint[]>([]);
  const [busData, setBusData] = useState<BusPoint[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const refresh = async () => {
      try {
        const [tr, br] = await Promise.all([
          fetch(`${API_BASE}/traffic/live`),
          fetch(`${API_BASE}/buses/live`)
        ]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const traffic: any = await tr.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const buses: any[] = await br.json();

        setTrafficData(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          traffic.features.map((f: any) => ({
            position: f.geometry.coordinates as [number, number],
            congestionRatio: f.properties.congestionRatio,
            closed: f.properties.closed
          }))
        );

        setBusData(
          buses.map(b => ({
            position: [b.boylam, b.enlem] as [number, number],
            hatNo: b.hatNo
          }))
        );

        setLastUpdate(new Date());
      } catch (e) {
        console.error('Veri çekme hatası:', e);
      }
    };

    refresh();
    const timer = setInterval(refresh, TRAFFIC_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  return { trafficData, busData, lastUpdate };
}

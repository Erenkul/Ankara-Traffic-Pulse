import { useState, useEffect, useRef } from 'react';
import { WS_URL, API_BASE, TRAFFIC_REFRESH_MS } from '../constants';
import type { TrafficPoint, BusPoint } from './useTrafficData';

export function useWebSocket() {
  const [trafficData, setTrafficData] = useState<TrafficPoint[]>([]);
  const [busData, setBusData]         = useState<BusPoint[]>([]);
  const [lastUpdate, setLastUpdate]   = useState<Date | null>(null);
  const [connected, setConnected]     = useState(false);
  const wsRef   = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // REST polling fallback (kullanılır WS bağlanamazsa)
  const pollRest = async () => {
    try {
      const [tr, br] = await Promise.all([
        fetch(`${API_BASE}/traffic/live`),
        fetch(`${API_BASE}/buses/live`),
      ]);
      const traffic = await tr.json();
      const buses: { boylam: number; enlem: number; hatNo: string }[] = await br.json();
      applyTraffic(traffic);
      applyBuses(buses);
    } catch { /* sessiz hata */ }
  };

  const applyTraffic = (traffic: { features: { geometry: { coordinates: [number, number] }; properties: { congestionRatio: number; closed: boolean } }[] }) => {
    setTrafficData(traffic.features.map(f => ({
      position: f.geometry.coordinates,
      congestionRatio: f.properties.congestionRatio,
      closed: f.properties.closed,
    })));
    setLastUpdate(new Date());
  };

  const applyBuses = (buses: { boylam: number; enlem: number; hatNo: string }[]) => {
    // hatNo'ya göre sırala → deck.gl transitions için stabil dizi indeksi
    const sorted = [...buses].sort((a, b) => a.hatNo.localeCompare(b.hatNo));
    setBusData(sorted.map(b => ({
      position: [b.boylam, b.enlem] as [number, number],
      hatNo: b.hatNo,
    })));
  };

  useEffect(() => {
    let dead = false;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (dead) return ws.close();
        setConnected(true);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string);
          if (msg.type === 'snapshot' || msg.type === 'traffic') applyTraffic(msg.traffic);
          if (msg.type === 'snapshot' || msg.type === 'buses')   applyBuses(msg.buses);
        } catch { /* ignore */ }
      };

      ws.onerror = () => {
        setConnected(false);
        // WS başarısız — REST polling'e geç
        if (!timerRef.current) {
          pollRest();
          timerRef.current = setInterval(pollRest, TRAFFIC_REFRESH_MS);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!dead && !timerRef.current) {
          pollRest();
          timerRef.current = setInterval(pollRest, TRAFFIC_REFRESH_MS);
        }
      };
    };

    connect();
    return () => {
      dead = true;
      wsRef.current?.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { trafficData, busData, lastUpdate, connected };
}

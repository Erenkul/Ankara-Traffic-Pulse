import { useState, useEffect } from 'react';
import { WS_URL, API_BASE, TRAFFIC_REFRESH_MS } from '../constants';
import {
  toTrafficPoints, toBusPoints,
  type TrafficPoint, type BusPoint, type TrafficFeatureCollection, type RawBus,
} from '../types';

const HEARTBEAT_MS     = 25_000;
const RECONNECT_MIN_MS = 2_000;
const RECONNECT_MAX_MS = 60_000;

/**
 * WebSocket ile canlı veri. Bağlantı koptuğunda REST polling'e düşer ve
 * üstel geri çekilmeyle (2s → 60s) yeniden bağlanmayı dener.
 */
export function useWebSocket() {
  const [trafficData, setTrafficData] = useState<TrafficPoint[]>([]);
  const [busData, setBusData]         = useState<BusPoint[]>([]);
  const [lastUpdate, setLastUpdate]   = useState<Date | null>(null);
  const [connected, setConnected]     = useState(false);

  useEffect(() => {
    let dead = false;
    let ws: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = RECONNECT_MIN_MS;

    const applyTraffic = (traffic: TrafficFeatureCollection) => {
      setTrafficData(toTrafficPoints(traffic));
      setLastUpdate(new Date());
    };
    const applyBuses = (buses: RawBus[]) => setBusData(toBusPoints(buses));

    const pollRest = async () => {
      try {
        const [tr, br] = await Promise.all([
          fetch(`${API_BASE}/traffic/live`),
          fetch(`${API_BASE}/buses/live`),
        ]);
        const traffic: TrafficFeatureCollection = await tr.json();
        const buses: RawBus[] = await br.json();
        if (dead) return;
        applyTraffic(traffic);
        applyBuses(buses);
      } catch { /* sessiz hata */ }
    };

    const startPolling = () => {
      if (pollTimer) return;
      pollRest();
      pollTimer = setInterval(pollRest, TRAFFIC_REFRESH_MS);
    };
    const stopPolling = () => {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    };

    const scheduleReconnect = () => {
      if (dead || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
    };

    const connect = () => {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setConnected(true);
        reconnectDelay = RECONNECT_MIN_MS;
        stopPolling();
        heartbeat = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) ws.send('ping');
        }, HEARTBEAT_MS);
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string);
          if (msg.type === 'snapshot' || msg.type === 'traffic') applyTraffic(msg.traffic);
          if (msg.type === 'snapshot' || msg.type === 'buses')   applyBuses(msg.buses);
        } catch { /* ignore */ }
      };

      // onerror her zaman onclose ile takip edilir; kurtarma orada yapılır
      ws.onclose = () => {
        if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
        if (dead) return;
        setConnected(false);
        startPolling();
        scheduleReconnect();
      };
    };

    connect();
    return () => {
      dead = true;
      ws?.close();
      stopPolling();
      if (heartbeat) clearInterval(heartbeat);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return { trafficData, busData, lastUpdate, connected };
}

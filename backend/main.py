import settings  # noqa: F401 — .env diğer importlardan önce yüklenmeli

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from scheduler import start_scheduler
from cache import get_traffic_data, get_bus_data, cache_status, get_sources
from database import init_db
from ws_manager import manager
from districts import district_stats_from_features
from services.history import get_traffic_history, get_district_stats_db, get_weekly_heatmap
from services.metro import get_metro_routes, get_metro_stations
from services.predict import get_traffic_prediction
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    scheduler = start_scheduler()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Ankara Traffic Pulse API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ── Faz 1 endpoint'leri ─────────────────────────────────────────────────────

@app.get("/api/v1/traffic/live")
async def traffic_live():
    return get_traffic_data()


@app.get("/api/v1/buses/live")
async def buses_live():
    return get_bus_data()


@app.get("/api/v1/health")
async def health():
    from database import DB_AVAILABLE
    return {
        "status": "ok",
        "db": DB_AVAILABLE,
        "wsClients": len(manager.active),
        "tomtomKey": bool(os.getenv("TOMTOM_API_KEY")),
        "cache": cache_status(),
        "sources": _sources(),
    }


def _sources() -> dict:
    return {**get_sources(), "metro": get_metro_routes().get("source", "static")}


@app.get("/api/v1/meta")
async def meta():
    """Arayüz için veri kaynakları: traffic tomtom|demo, buses ego|demo, metro osm|static."""
    from database import DB_AVAILABLE
    return {"sources": _sources(), "db": DB_AVAILABLE}


# ── Faz 2 endpoint'leri ─────────────────────────────────────────────────────

@app.get("/api/v1/traffic/history")
async def traffic_history(hour: int = Query(default=8, ge=0, le=23)):
    """Son 7 günde verilen saate (Ankara yerel saati) ait trafik anlık görüntüleri (GeoJSON)."""
    features = await get_traffic_history(hour)
    return {"type": "FeatureCollection", "features": features}


@app.get("/api/v1/traffic/districts")
async def traffic_districts():
    """Bölge bazında yoğunluk istatistikleri.

    DB varsa: son 24 saatin ortalaması.
    DB yoksa: anlık cache'den hesaplanır.
    """
    from database import DB_AVAILABLE
    if DB_AVAILABLE:
        stats = await get_district_stats_db()
        if stats:
            return stats

    # Fallback: anlık trafik verisinden hesapla
    data = get_traffic_data()
    return district_stats_from_features(data.get("features", []))


# ── Faz 3 endpoint'leri ─────────────────────────────────────────────────────

@app.get("/api/v1/metro/routes")
async def metro_routes():
    """M1, M2, M3, Ankaray hat güzergahları (GeoJSON)."""
    return get_metro_routes()


@app.get("/api/v1/metro/stations")
async def metro_stations():
    """Metro ve Ankaray istasyon noktaları (GeoJSON)."""
    return get_metro_stations()


@app.get("/api/v1/traffic/weekly")
async def traffic_weekly():
    """Son 7 günün saatlik ortalama yoğunluğu — haftalık ısı haritası."""
    return await get_weekly_heatmap()


@app.get("/api/v1/traffic/predict")
async def traffic_predict(hours: int = Query(default=4, ge=1, le=12)):
    """Önümüzdeki N saat için trafik yoğunluk tahmini (ML veya heuristic)."""
    return await get_traffic_prediction(hours_ahead=hours)


# ── WebSocket ────────────────────────────────────────────────────────────────

@app.websocket("/ws/traffic")
async def ws_traffic(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # İlk bağlantıda anlık veriyi gönder
        await websocket.send_json({
            "type": "snapshot",
            "traffic": get_traffic_data(),
            "buses": get_bus_data(),
            "sources": _sources(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)

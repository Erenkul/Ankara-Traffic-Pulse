from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from scheduler import start_scheduler
from cache import get_traffic_data, get_bus_data
from database import init_db
from ws_manager import manager
from districts import district_stats_from_features
from services.history import get_traffic_history, get_district_stats_db
import os

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    start_scheduler()
    yield


app = FastAPI(title="Ankara Traffic Pulse API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "http://localhost:5173")],
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
    return {"status": "ok", "db": DB_AVAILABLE}


# ── Faz 2 endpoint'leri ─────────────────────────────────────────────────────

@app.get("/api/v1/traffic/history")
async def traffic_history(hour: int = Query(default=8, ge=0, le=23)):
    """Son 7 günde verilen saate ait trafik anlık görüntüleri (GeoJSON)."""
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


# ── WebSocket ────────────────────────────────────────────────────────────────

@app.websocket("/ws/traffic")
async def ws_traffic(websocket: WebSocket):
    await manager.connect(websocket)
    # İlk bağlantıda anlık veriyi gönder
    await websocket.send_json({
        "type": "snapshot",
        "traffic": get_traffic_data(),
        "buses": get_bus_data(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    try:
        while True:
            await websocket.receive_text()  # ping/pong için açık tut
    except WebSocketDisconnect:
        manager.disconnect(websocket)

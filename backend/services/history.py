"""Geçmiş trafik verilerini PostgreSQL'e kaydeder ve sorgular."""
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, extract, and_
from sqlalchemy import func as sqlfunc
import logging

import database
from db_models import TrafficSnapshot
from districts import classify_district

logger = logging.getLogger(__name__)


async def save_traffic_snapshot(features: list[dict]):
    if not database.DB_AVAILABLE or database.AsyncSessionLocal is None:
        return
    try:
        async with database.AsyncSessionLocal() as session:
            for f in features:
                props = f["properties"]
                lng, lat = f["geometry"]["coordinates"]
                session.add(TrafficSnapshot(
                    lat=lat,
                    lng=lng,
                    district=classify_district(lat, lng),
                    current_speed=props["currentSpeed"],
                    free_flow_speed=props["freeFlowSpeed"],
                    congestion_ratio=props["congestionRatio"],
                    closed=props["closed"],
                ))
            await session.commit()
    except Exception as e:
        logger.error(f"Snapshot kaydetme hatası: {e}")


async def get_traffic_history(hour: int) -> list[dict]:
    """Son 7 günde verilen saate ait snapshot'ları döner."""
    if not database.DB_AVAILABLE or database.AsyncSessionLocal is None:
        return []
    try:
        since = datetime.now(timezone.utc) - timedelta(days=7)
        async with database.AsyncSessionLocal() as session:
            result = await session.execute(
                select(TrafficSnapshot).where(
                    and_(
                        TrafficSnapshot.recorded_at >= since,
                        extract("hour", TrafficSnapshot.recorded_at) == hour,
                    )
                ).order_by(TrafficSnapshot.recorded_at.desc()).limit(500)
            )
            rows = result.scalars().all()
        return [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r.lng, r.lat]},
                "properties": {
                    "congestionRatio": r.congestion_ratio,
                    "currentSpeed": r.current_speed,
                    "freeFlowSpeed": r.free_flow_speed,
                    "closed": r.closed,
                    "district": r.district,
                    "recordedAt": r.recorded_at.isoformat(),
                },
            }
            for r in rows
        ]
    except Exception as e:
        logger.error(f"Geçmiş sorgulama hatası: {e}")
        return []


async def get_district_stats_db() -> list[dict]:
    """Son 24 saatin bölge bazında ortalama yoğunluğunu döner."""
    if not database.DB_AVAILABLE or database.AsyncSessionLocal is None:
        return []
    try:
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        async with database.AsyncSessionLocal() as session:
            result = await session.execute(
                select(
                    TrafficSnapshot.district,
                    sqlfunc.avg(TrafficSnapshot.congestion_ratio).label("avg_ratio"),
                    sqlfunc.count(TrafficSnapshot.id).label("count"),
                )
                .where(TrafficSnapshot.recorded_at >= since)
                .group_by(TrafficSnapshot.district)
                .order_by(TrafficSnapshot.district)
            )
            rows = result.all()
        return [
            {
                "district": r.district,
                "avgCongestionRatio": round(float(r.avg_ratio), 3),
                "congestionPct": round((1 - float(r.avg_ratio)) * 100, 1),
                "sampleCount": r.count,
            }
            for r in rows
        ]
    except Exception as e:
        logger.error(f"Bölge istatistik hatası: {e}")
        return []

from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from services.tomtom import fetch_ankara_traffic
from services.ego import fetch_ego_buses
from services.history import save_traffic_snapshot, purge_old_snapshots
from services.metro import refresh_metro_from_osm
from services import opendata
import os
from cache import update_traffic, update_buses, set_source
from services import ego
from services.demo import demo_traffic
from settings import TRAFFIC_REFRESH_SECONDS, BUS_REFRESH_SECONDS, RETENTION_DAYS, TRAFFIC_DEMO
from ws_manager import manager


def start_scheduler() -> AsyncIOScheduler:
    now = datetime.now(timezone.utc)
    scheduler = AsyncIOScheduler(job_defaults={"coalesce": True, "max_instances": 1})
    scheduler.add_job(refresh_traffic, 'interval', seconds=TRAFFIC_REFRESH_SECONDS, next_run_time=now)
    scheduler.add_job(refresh_buses,   'interval', seconds=BUS_REFRESH_SECONDS,     next_run_time=now)
    scheduler.add_job(refresh_metro_from_osm, 'interval', hours=24, next_run_time=now)
    scheduler.add_job(purge_old, 'interval', hours=24, next_run_time=now)
    # Açık veri katmanları: her biri kendi yenileme aralığıyla (otopark sık, yollar nadiren)
    # Genel Overpass sunucuları eşzamanlı sorguyu sınırlar; başlangıçları 20 sn arayla kaydır
    for i, (key, layer) in enumerate(opendata.LAYERS.items(), start=1):
        scheduler.add_job(opendata.refresh_layer, 'interval', args=[key],
                          minutes=layer["refresh_minutes"], id=f"opendata-{key}",
                          next_run_time=now + timedelta(seconds=20 * i))
    scheduler.start()
    return scheduler


def _use_demo_traffic() -> bool:
    if TRAFFIC_DEMO == "on":
        return True
    return TRAFFIC_DEMO == "auto" and not os.getenv("TOMTOM_API_KEY")


async def refresh_traffic():
    if _use_demo_traffic():
        data = demo_traffic()
        update_traffic(data)
        set_source("traffic", "demo")
    else:
        data = await fetch_ankara_traffic()
        update_traffic(data)
        set_source("traffic", "tomtom")
        # DB'ye yalnızca gerçek veri yazılır (DB yoksa sessizce atla)
        await save_traffic_snapshot(data.get("features", []))

    # WebSocket istemcilerine yayınla
    await manager.broadcast({
        "type": "traffic",
        "traffic": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


async def refresh_buses():
    data = await fetch_ego_buses()
    update_buses(data)
    set_source("buses", ego.last_source)

    await manager.broadcast({
        "type": "buses",
        "buses": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


async def purge_old():
    await purge_old_snapshots(RETENTION_DAYS)

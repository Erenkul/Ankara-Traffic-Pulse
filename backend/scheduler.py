from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from services.tomtom import fetch_ankara_traffic
from services.ego import fetch_ego_buses
from services.history import save_traffic_snapshot
from cache import update_traffic, update_buses
from settings import TRAFFIC_REFRESH_SECONDS, BUS_REFRESH_SECONDS
from ws_manager import manager


def start_scheduler() -> AsyncIOScheduler:
    now = datetime.now(timezone.utc)
    scheduler = AsyncIOScheduler(job_defaults={"coalesce": True, "max_instances": 1})
    scheduler.add_job(refresh_traffic, 'interval', seconds=TRAFFIC_REFRESH_SECONDS, next_run_time=now)
    scheduler.add_job(refresh_buses,   'interval', seconds=BUS_REFRESH_SECONDS,     next_run_time=now)
    scheduler.start()
    return scheduler


async def refresh_traffic():
    data = await fetch_ankara_traffic()
    update_traffic(data)

    # DB'ye kaydet (DB yoksa sessizce atla)
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

    await manager.broadcast({
        "type": "buses",
        "buses": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

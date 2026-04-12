from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from services.tomtom import fetch_ankara_traffic
from services.ego import fetch_ego_buses
from cache import update_traffic, update_buses


def start_scheduler():
    now = datetime.now(timezone.utc)
    scheduler = AsyncIOScheduler()
    scheduler.add_job(refresh_traffic, 'interval', seconds=60, next_run_time=now)
    scheduler.add_job(refresh_buses,   'interval', seconds=30, next_run_time=now)
    scheduler.start()


async def refresh_traffic():
    data = await fetch_ankara_traffic()
    update_traffic(data)


async def refresh_buses():
    data = await fetch_ego_buses()
    update_buses(data)

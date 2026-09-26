from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
import os
import logging

import settings  # noqa: F401 — .env'yi DATABASE_URL okunmadan önce yükler

logger = logging.getLogger(__name__)

def _async_url(url: str) -> str:
    """Railway/Heroku tarzı postgres:// adreslerini asyncpg sürücüsüne çevirir."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+asyncpg://" + url[len(prefix):]
    return url


_DATABASE_URL = _async_url(os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://traffic:traffic_pass@localhost:5432/ankara_traffic"
))

engine = None
AsyncSessionLocal = None
DB_AVAILABLE = False


class Base(DeclarativeBase):
    pass


async def init_db():
    global engine, AsyncSessionLocal, DB_AVAILABLE
    try:
        engine = create_async_engine(_DATABASE_URL, echo=False, pool_timeout=5)
        AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            from db_models import TrafficSnapshot  # noqa: F401
            await conn.run_sync(Base.metadata.create_all)
        DB_AVAILABLE = True
        logger.info("Veritabanı bağlantısı kuruldu.")
    except Exception as e:
        DB_AVAILABLE = False
        logger.warning(f"Veritabanı yok, in-memory modda çalışılıyor: {e}")

"""OpenStreetMap Overpass API istemcisi — birden fazla sunucuyu sırayla dener."""
from __future__ import annotations

import asyncio
import logging
import os

import httpx

logger = logging.getLogger(__name__)

_DEFAULT_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# Ankara kent merkezi ve çevresi: güney, batı, kuzey, doğu
ANKARA_BBOX = "39.75,32.50,40.10,33.05"


def endpoints() -> list[str]:
    env = os.getenv("OVERPASS_URLS")
    return [u.strip() for u in env.split(",") if u.strip()] if env else _DEFAULT_ENDPOINTS


async def overpass_query(query: str, timeout: float = 120, attempts: int = 2) -> dict:
    """Sorguyu sunuculara sırayla gönderir; ilk başarılı JSON yanıtını döner.

    Genel Overpass sunucuları yoğunken 429/504 döndürebilir; her sunucu
    kısa bir beklemeyle `attempts` kez denenir.
    """
    last_error: Exception | None = None
    async with httpx.AsyncClient(timeout=timeout) as client:
        for url in endpoints():
            for attempt in range(attempts):
                try:
                    r = await client.post(url, data={"data": query})
                    r.raise_for_status()
                    return r.json()
                except Exception as e:  # tekrar dene ya da sonraki sunucu
                    last_error = e
                    logger.debug(f"Overpass {url} başarısız ({attempt + 1}): {e}")
                    await asyncio.sleep(3 * (attempt + 1))
    raise RuntimeError(f"Hiçbir Overpass sunucusu yanıt vermedi: {last_error}")

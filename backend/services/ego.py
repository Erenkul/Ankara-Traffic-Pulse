import httpx
import os
import logging

logger = logging.getLogger(__name__)

# Tespit edilen endpoint'leri sırayla dene
_CANDIDATE_PATHS = [
    "/HatSefer/GetHatKonum",
    "/araclar",
    "/api/GetAraclar",
]


async def fetch_ego_buses():
    base = os.getenv("EGO_API_BASE", "")
    if not base:
        return _mock_buses()

    async with httpx.AsyncClient(timeout=10) as client:
        for path in _CANDIDATE_PATHS:
            try:
                r = await client.get(f"{base}{path}")
                if r.status_code == 200:
                    data = r.json()
                    if data:
                        logger.info(f"EGO veri alındı: {path} ({len(data)} araç)")
                        return _normalize(data)
            except Exception as e:
                logger.debug(f"EGO {path} denendi, hata: {e}")

    logger.warning("EGO API ulaşılamadı, mock veri kullanılıyor.")
    return _mock_buses()


def _normalize(raw: list) -> list:
    """Farklı EGO yanıt formatlarını standartlaştırır."""
    result = []
    for item in raw:
        # Format A: {Enlem, Boylam, HatNo}
        if "Enlem" in item:
            result.append({
                "hatNo": str(item.get("HatNo", item.get("hatNo", "?"))),
                "enlem": float(item["Enlem"]),
                "boylam": float(item["Boylam"]),
                "hiz": item.get("Hiz", item.get("hiz", 0)),
            })
        # Format B: {enlem, boylam, hatNo}
        elif "enlem" in item:
            result.append({
                "hatNo": str(item.get("hatNo", "?")),
                "enlem": float(item["enlem"]),
                "boylam": float(item["boylam"]),
                "hiz": item.get("hiz", 0),
            })
    return result if result else _mock_buses()


def _mock_buses() -> list:
    return [
        {"hatNo": "135", "enlem": 39.9334, "boylam": 32.8597, "hiz": 35},
        {"hatNo": "Ç1",  "enlem": 39.9010, "boylam": 32.8650, "hiz": 28},
        {"hatNo": "487", "enlem": 39.9490, "boylam": 32.8580, "hiz": 42},
        {"hatNo": "19",  "enlem": 39.9560, "boylam": 32.8598, "hiz": 30},
        {"hatNo": "76",  "enlem": 39.9750, "boylam": 32.8150, "hiz": 38},
    ]

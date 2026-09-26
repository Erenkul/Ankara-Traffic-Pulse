import httpx
import os
import logging

logger = logging.getLogger(__name__)

# Son çağrının kaynağı: "ego" (gerçek) veya "demo" (örnek veri)
last_source = "demo"

# Tespit edilen endpoint'leri sırayla dene
_CANDIDATE_PATHS = [
    "/HatSefer/GetHatKonum",
    "/araclar",
    "/api/GetAraclar",
]


async def fetch_ego_buses():
    global last_source
    base = os.getenv("EGO_API_BASE", "")
    if not base:
        last_source = "demo"
        return _mock_buses()

    async with httpx.AsyncClient(timeout=10) as client:
        for path in _CANDIDATE_PATHS:
            try:
                r = await client.get(f"{base}{path}")
                if r.status_code == 200:
                    data = r.json()
                    if isinstance(data, list) and data:
                        normalized = _normalize(data)
                        if normalized:
                            logger.info(f"EGO veri alındı: {path} ({len(normalized)} araç)")
                            last_source = "ego"
                            return normalized
            except Exception as e:
                logger.debug(f"EGO {path} denendi, hata: {e}")

    logger.warning("EGO API ulaşılamadı, demo veri kullanılıyor.")
    last_source = "demo"
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
    return result


def _mock_buses() -> list:
    from services.demo import demo_buses
    return demo_buses()

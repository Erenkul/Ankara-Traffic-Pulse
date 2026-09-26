"""API anahtarı olmadan çalışan demo verisi.

Trafik: TomTom'un sorguladığı 32 noktanın her biri için Ankara saatlik
profilinden türetilmiş yoğunluk. Otobüs: EGO'ya ulaşılamadığında araçlar
koridorlar boyunca gidip gelir. Demo verisi veritabanına yazılmaz.
"""
from __future__ import annotations

import math
import random
from datetime import datetime, timezone

from settings import ANKARA_TZ
from services.predict import _heuristic_congestion
from services.tomtom import ANKARA_GROUPS

# Koridor bazında yoğunluk çarpanı (merkez daha yoğun)
_GROUP_FACTOR = [1.15, 1.05, 0.85, 0.95, 0.75, 1.10, 1.00, 0.80]
_FREE_FLOW = [50, 82, 95, 78, 90, 55, 50, 85]


def demo_traffic(now: datetime | None = None) -> dict:
    local = (now or datetime.now(timezone.utc)).astimezone(ANKARA_TZ)
    base = _heuristic_congestion(local.hour, local.weekday())
    # Aynı 5 dk içinde aynı değerler — ekranda titreme olmasın
    rng = random.Random(int(local.timestamp() // 300))
    features = []
    for gi, group in enumerate(ANKARA_GROUPS):
        for lat, lng in group:
            congestion = min(0.97, max(0.02, base * _GROUP_FACTOR[gi] + rng.uniform(-0.12, 0.12)))
            ratio = round(1 - congestion, 2)
            free = _FREE_FLOW[gi]
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lng, lat]},
                "properties": {
                    "currentSpeed": round(free * ratio),
                    "freeFlowSpeed": free,
                    "congestionRatio": ratio,
                    "closed": False,
                },
            })
    return {"type": "FeatureCollection", "features": features}


# Örnek hatlar: her biri bir trafik koridorunda gidip gelir
_DEMO_LINES = [("135", 0), ("Ç1", 3), ("487", 5), ("19", 6), ("76", 1), ("220", 2), ("442", 4), ("111", 7)]
_TRIP_SECONDS = 20 * 60  # bir yön 20 dk


def demo_buses(now: datetime | None = None) -> list[dict]:
    t = (now or datetime.now(timezone.utc)).timestamp()
    buses = []
    for i, (hat, gi) in enumerate(_DEMO_LINES):
        path = ANKARA_GROUPS[gi]
        phase = ((t / _TRIP_SECONDS) + i * 0.37) % 2
        frac = phase if phase <= 1 else 2 - phase  # ileri-geri
        pos = frac * (len(path) - 1)
        k = min(int(pos), len(path) - 2)
        u = pos - k
        (la1, ln1), (la2, ln2) = path[k], path[k + 1]
        heading = math.degrees(math.atan2(ln2 - ln1, la2 - la1)) % 360
        buses.append({
            "hatNo": hat,
            "enlem": round(la1 + (la2 - la1) * u, 6),
            "boylam": round(ln1 + (ln2 - ln1) * u, 6),
            "hiz": 25 + (i * 7) % 20,
            "yon": round(heading if phase <= 1 else (heading + 180) % 360),
        })
    return buses

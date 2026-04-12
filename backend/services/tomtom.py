import httpx
import os
import asyncio

ANKARA_GROUPS = [
    [(39.9334, 32.8597), (39.9560, 32.8598), (39.9010, 32.8650), (39.9490, 32.8580)],
    [(39.9750, 32.8150), (39.8700, 32.7500), (40.0300, 32.9000), (39.8600, 32.8200)],
]
_group_index = 0
BASE = "https://api.tomtom.com/traffic/services/4/flowSegmentData"


async def fetch_ankara_traffic():
    global _group_index
    key = os.getenv("TOMTOM_API_KEY")
    group = ANKARA_GROUPS[_group_index % len(ANKARA_GROUPS)]
    _group_index += 1
    features = []
    async with httpx.AsyncClient() as client:
        for lat, lng in group:
            url = f"{BASE}/absolute/10/json?point={lat},{lng}&unit=KMPH&key={key}"
            try:
                r = await client.get(url, timeout=10)
                if r.status_code == 200:
                    d = r.json()["flowSegmentData"]
                    ratio = d["currentSpeed"] / max(d["freeFlowSpeed"], 1)
                    features.append({
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [lng, lat]},
                        "properties": {
                            "currentSpeed": d["currentSpeed"],
                            "freeFlowSpeed": d["freeFlowSpeed"],
                            "congestionRatio": round(ratio, 2),
                            "closed": d["roadClosure"]
                        }
                    })
            except Exception as e:
                print(f"TomTom hata ({lat},{lng}): {e}")
            await asyncio.sleep(0.5)
    return {"type": "FeatureCollection", "features": features}
